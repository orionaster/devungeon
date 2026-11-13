import { describe, expect, it } from "vitest";
import { taskCopy } from "../src/demo-task-copy";
import { translate } from "../src/i18n/core";
import { connectionLabel, snapshotSchema } from "../src/model";
import { WorkspaceFault } from "../src/errors";

const task = {
  id: "demo-plan",
  agent_id: "demo-wizard",
  title: "为下一段旅程拟定计划",
  detail: "等待你的目标。主管可派遣合成任务，也可以说明目前的阻塞。",
  status: "active" as const,
  evidence: [],
};
describe("locale presentation cannot rewrite source or authorization data", () => {
  it("provides authored fixture display without changing the original record", () => {
    const original = structuredClone(task);
    const view = taskCopy(Object.freeze(task), true, (key) =>
      translate("en-US", key),
    );
    expect(view.title).toBe("Plan the next part of the journey");
    expect(task).toEqual(original);
  });
  it("keeps same-text user tasks and changed source text untouched", () => {
    for (const raw of [
      { ...task, id: "user-task" },
      { ...task, title: "Private original text" },
      { ...task, detail: "Source was changed" },
    ]) {
      expect(
        taskCopy(raw, true, (key) => translate("en-US", key)),
      ).toMatchObject({
        title: raw.title,
        detail: raw.detail,
        localized: false,
      });
    }
    expect(
      taskCopy(task, false, (key) => translate("en-US", key)).localized,
    ).toBe(false);
  });
  it("localizes freshness labels while retaining authoritative stale state", () => {
    const raw = snapshotSchema.parse({
      project_id: "public:test",
      revision: 1,
      mode: "live",
      connected: true,
      stale: true,
      observed_at: new Date().toISOString(),
      source: "Original",
      agents: [],
      tasks: [],
      events: [],
      receipts: [],
      approvals: [],
    });
    const before = structuredClone(raw);
    expect(connectionLabel(raw, Date.now(), "en-US")).toContain(
      "Stale observation",
    );
    expect(connectionLabel(raw, Date.now(), "zh-CN")).toContain("状态已过期");
    expect(raw).toEqual(before);
  });
  it("carries a stable local error key and preserves the original diagnostic", () => {
    const error = new WorkspaceFault("errors.command.disconnected");
    const original = error.message;
    expect(translate("en-US", error.key)).toBe(
      "Disconnected; nothing was sent.",
    );
    expect(error.message).toBe(original);
  });
});
