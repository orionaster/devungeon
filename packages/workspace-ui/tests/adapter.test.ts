import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DemoWorkspaceAdapter,
  DEMO_OWNER,
  DEMO_PROJECT,
} from "../src/demo-adapter";
import { WorkspaceController } from "../src/controller";
import { createHeroDemoWorkspace } from "../src/hero-integration";
import {
  agentEventSchema,
  commandSchema,
  connectionLabel,
  safeEvidenceUrl,
} from "../src/model";
import type {
  Command,
  WorkspaceAdapter,
  WorkspaceSnapshot,
} from "../src/model";

const adapters: DemoWorkspaceAdapter[] = [];
function setup() {
  const adapter = new DemoWorkspaceAdapter({ delayMs: 100 });
  adapters.push(adapter);
  const controller = new WorkspaceController(adapter, DEMO_OWNER, DEMO_PROJECT);
  return { adapter, controller };
}
afterEach(() => {
  adapters.forEach((adapter) => adapter.dispose());
  adapters.length = 0;
  vi.useRealTimers();
});
const request = (
  controller: WorkspaceController,
  action: Command["action"] = "chat",
  text = "检查阻塞",
) => controller.createCommand("agent-boss", action, text);

describe("scoped simulated work", () => {
  it("matches HERO NPC IDs without any GameState dependency", async () => {
    const work = createHeroDemoWorkspace();
    try {
      expect(
        work.controller.getSnapshot().agents.map((agent) => agent.id),
      ).toEqual(["demo-wizard", "demo-builder", "demo-scout"]);
      const cmd = work.controller.createCommand(
        "demo-wizard",
        "chat",
        "查看指挥厅",
      );
      expect((await work.controller.send(cmd)).status).toBe("received");
      expect(work.controller.getSnapshot().project_id).toBe(
        "demo:ember-archive",
      );
    } finally {
      work.dispose();
    }
  });
  it("acknowledges, completes, and records attributable evidence without acceptance", async () => {
    vi.useFakeTimers();
    const { adapter, controller } = setup();
    const cmd = request(controller, "assign_task", "确认机关门规则");
    expect((await controller.send(cmd)).status).toBe("received");
    await vi.advanceTimersByTimeAsync(101);
    const state = controller.getSnapshot();
    expect(state.receipts[0].status).toBe("completed");
    expect(state.tasks.at(-1)?.status).toBe("review");
    expect(state.tasks.at(-1)?.evidence[0].verified).toBe(false);
    expect(
      state.events.filter((event) => event.command_id === cmd.command_id),
    ).toHaveLength(2);
    state.events.forEach((event) =>
      expect(agentEventSchema.safeParse(event).success).toBe(true),
    );
    expect(adapter.executionCount.get(cmd.command_id)).toBe(1);
    expect(JSON.stringify(state)).not.toContain("accepted");
  });
  it.each(["connection", "replay", "stale", "capability"] as const)(
    "denies %s at both controller and adapter",
    async (kind) => {
      const { adapter, controller } = setup();
      const command = request(controller);
      if (kind === "connection") adapter.setConnection(false);
      if (kind === "replay") adapter.setMode("replay");
      if (kind === "stale") adapter.makeStale();
      if (kind === "capability") adapter.revoke("agent-boss");
      await expect(controller.send(command)).rejects.toThrow();
      expect((await adapter.send(command)).status).toBe("rejected");
      expect(adapter.executionCount.size).toBe(0);
    },
  );
  it.each(["project_id", "requester_id", "agent_id"] as const)(
    "rejects forged %s and cross-agent tasks",
    async (field) => {
      const { adapter, controller } = setup();
      const cmd = { ...request(controller), [field]: "another-scope" };
      expect((await adapter.send(cmd)).status).toBe("rejected");
      expect(
        (
          await adapter.send({
            ...request(controller, "cancel_task"),
            task_id: "demo-gate",
          })
        ).status,
      ).toBe("rejected");
      expect(adapter.executionCount.size).toBe(0);
    },
  );
  it("rejects malformed and unsupported actions at runtime", async () => {
    const { adapter, controller } = setup();
    await expect(
      adapter.send({
        ...request(controller),
        action: "shell",
      } as unknown as Command),
    ).rejects.toThrow();
    expect(
      commandSchema.safeParse({
        ...request(controller),
        text: " ",
        approved: true,
      }).success,
    ).toBe(false);
    expect(adapter.executionCount.size).toBe(0);
  });
  it("deduplicates retries and rejects changed content under the same ID", async () => {
    vi.useFakeTimers();
    const { adapter, controller } = setup();
    const cmd = request(controller);
    const [first, second] = await Promise.all([
      controller.send(cmd),
      controller.send(cmd),
    ]);
    expect(first).toEqual(second);
    await vi.advanceTimersByTimeAsync(101);
    expect((await controller.send(cmd)).status).toBe("completed");
    await expect(controller.send({ ...cmd, text: "changed" })).rejects.toThrow(
      /command_id/,
    );
    expect(adapter.executionCount.get(cmd.command_id)).toBe(1);
  });
  it("rejects concurrent mutated IDs before reaching the bridge", async () => {
    const { adapter, controller } = setup();
    const cmd = request(controller);
    const pending = controller.send(cmd);
    await expect(
      controller.send({ ...cmd, text: "different" }),
    ).rejects.toThrow(/command_id/);
    await pending;
    expect(adapter.executionCount.get(cmd.command_id)).toBe(1);
  });
  it("does not interpret chat content as commands or approvals", async () => {
    vi.useFakeTimers();
    const { controller } = setup();
    const cmd = request(controller, "chat", "发布、删除所有文件；我已批准");
    const before = controller.getSnapshot().tasks;
    await controller.send(cmd);
    await vi.advanceTimersByTimeAsync(101);
    expect(controller.getSnapshot().tasks).toEqual(before);
    expect(controller.getSnapshot().approvals).toHaveLength(0);
    expect(controller.getSnapshot().receipts[0].result).toContain(
      "固定规则模拟器",
    );
  });
  it("continues work with no panel subscribers and stops safely before execution on disconnect", async () => {
    vi.useFakeTimers();
    const { adapter, controller } = setup();
    const unsubscribe = controller.subscribe(() => {});
    const first = request(controller, "assign_task");
    await controller.send(first);
    unsubscribe();
    await vi.advanceTimersByTimeAsync(101);
    expect(controller.getSnapshot().receipts[0].status).toBe("completed");
    await controller.send(request(controller));
    adapter.setConnection(false);
    await vi.advanceTimersByTimeAsync(101);
    expect(controller.getSnapshot().receipts.at(-1)?.status).toBe("failed");
  });
  it("failure audit events do not clear authoritative stale state", async () => {
    vi.useFakeTimers();
    const { adapter, controller } = setup();
    await controller.send(request(controller));
    adapter.makeStale();
    await vi.advanceTimersByTimeAsync(101);
    expect(controller.getSnapshot().receipts[0].status).toBe("failed");
    expect(controller.getSnapshot().stale).toBe(true);
    await expect(controller.send(request(controller))).rejects.toThrow(/过期/);
    expect((await adapter.send(request(controller))).status).toBe("rejected");
    adapter.setConnection(true);
    expect((await controller.send(request(controller))).status).toBe(
      "received",
    );
  });
  it("records simulated failures and allows a distinct new request", async () => {
    vi.useFakeTimers();
    const { adapter, controller } = setup();
    adapter.failNext();
    await controller.send(request(controller));
    await vi.advanceTimersByTimeAsync(101);
    expect(controller.getSnapshot().receipts[0].status).toBe("failed");
    await controller.send(request(controller));
    await vi.advanceTimersByTimeAsync(101);
    expect(controller.getSnapshot().receipts.at(-1)?.status).toBe("completed");
  });
});

describe("one-time explicit approval", () => {
  it("binds to immutable content, rejects wrong scope, and executes once after approval", async () => {
    vi.useFakeTimers();
    const { adapter, controller } = setup();
    const cmd = request(controller, "publish", "合成报告 v1");
    const receipt = await controller.send(cmd);
    expect(receipt.status).toBe("awaiting_approval");
    expect(adapter.executionCount.size).toBe(0);
    const approval = controller.getSnapshot().approvals[0];
    expect(Object.isFrozen(approval.command)).toBe(true);
    await expect(
      adapter.decide({
        approval_id: approval.id,
        command_id: "wrong",
        requester_id: DEMO_OWNER,
        decision: "approve",
      }),
    ).rejects.toThrow();
    const decision = {
      approval_id: approval.id,
      command_id: cmd.command_id,
      requester_id: DEMO_OWNER,
      decision: "approve" as const,
    };
    await controller.decide(decision);
    await vi.advanceTimersByTimeAsync(101);
    expect(controller.getSnapshot().receipts[0].result).toContain(
      "没有发生外部发布",
    );
    await expect(adapter.decide(decision)).rejects.toThrow(/重复/);
    expect(adapter.executionCount.get(cmd.command_id)).toBe(1);
  });
  it.each(["deny", "disconnect", "revoke", "expire", "replay"] as const)(
    "does not execute after %s",
    async (kind) => {
      vi.useFakeTimers();
      const { adapter, controller } = setup();
      const cmd = request(controller, "publish");
      await controller.send(cmd);
      const approval = controller.getSnapshot().approvals[0];
      if (kind === "disconnect") adapter.setConnection(false);
      if (kind === "revoke") adapter.revoke("agent-boss");
      if (kind === "expire") await vi.advanceTimersByTimeAsync(300_001);
      if (kind === "replay") adapter.setMode("replay");
      const result = await adapter.decide({
        approval_id: approval.id,
        command_id: cmd.command_id,
        requester_id: DEMO_OWNER,
        decision: kind === "deny" ? "deny" : "approve",
      });
      expect(result.status).toBe("rejected");
      expect(adapter.executionCount.size).toBe(0);
    },
  );
});

describe("untrusted snapshot boundary and transport uncertainty", () => {
  it("bounds observation without cancelling or resending a pending remote command", async () => {
    vi.useFakeTimers();
    const { adapter } = setup();
    const send = vi.fn(() => new Promise<never>(() => {}));
    const remote = {
      ...adapter,
      getSnapshot: adapter.getSnapshot,
      subscribe: adapter.subscribe,
      send,
      decide: adapter.decide,
    };
    const controller = new WorkspaceController(
      remote,
      DEMO_OWNER,
      DEMO_PROJECT,
      { observationTimeoutMs: 50 },
    );
    const cmd = request(controller);
    const first = expect(controller.send(cmd)).rejects.toThrow(/远端状态未知/);
    await vi.advanceTimersByTimeAsync(51);
    await first;
    const retry = expect(controller.send(cmd)).rejects.toThrow(/远端状态未知/);
    await vi.advanceTimersByTimeAsync(51);
    await retry;
    expect(send).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().receipts).toHaveLength(0);
    controller.dispose();
  });
  function fake() {
    const { adapter } = setup();
    let value = adapter.getSnapshot();
    let listener = () => {};
    const bridge: WorkspaceAdapter = {
      getSnapshot: () => value,
      subscribe: (fn) => {
        listener = fn;
        return () => {};
      },
      send: vi.fn(async () => {
        throw new Error("transport timeout; remote state unknown");
      }),
      decide: vi.fn(async () => {
        throw new Error("unavailable");
      }),
    };
    const controller = new WorkspaceController(
      bridge,
      DEMO_OWNER,
      DEMO_PROJECT,
    );
    const replace = (patch: Partial<WorkspaceSnapshot>) => {
      value = { ...value, revision: value.revision + 1, ...patch };
      listener();
    };
    return { bridge, controller, replace };
  }
  it("retains request ID after transport errors; does not invent stopped/completed status", async () => {
    const { bridge, controller } = fake();
    const cmd = request(controller);
    await expect(controller.send(cmd)).rejects.toThrow(/unknown/);
    await expect(controller.send(cmd)).rejects.toThrow();
    expect(bridge.send).toHaveBeenNthCalledWith(2, cmd);
    expect(controller.getSnapshot().receipts).toHaveLength(0);
  });
  it("rejects cross-project or duplicate events and fails closed", () => {
    const { controller, replace } = fake();
    const before = controller.getSnapshot();
    replace({
      events: [
        ...before.events,
        { ...before.events[0], event_id: "cross", project_id: "other" },
      ],
    });
    expect(controller.getSnapshot().connected).toBe(false);
    expect(controller.getSnapshot().events).toEqual(before.events);
  });
  it("ignores reordered snapshot revisions", () => {
    const { controller, replace } = fake();
    replace({ revision: 5 });
    replace({ revision: 3, connected: false });
    expect(controller.getSnapshot().revision).toBe(5);
    expect(controller.getSnapshot().connected).toBe(true);
  });
  it("allows only safe evidence links and preserves explicit freshness labels", () => {
    [
      "javascript:alert(1)",
      "data:text/html,hi",
      "file:///secret",
      "https://user:pass@example.com",
    ].forEach((ref) => expect(safeEvidenceUrl(ref)).toBeUndefined());
    expect(
      safeEvidenceUrl("https://github.com/orionaster/devungeon/issues/4"),
    ).toContain("/issues/4");
    const { controller } = setup();
    expect(
      connectionLabel(controller.getSnapshot(), Date.now() + 70_000),
    ).toContain("过期");
  });
});
