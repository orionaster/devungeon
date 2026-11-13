import { freezeSnapshot, receiptSchema, snapshotSchema } from "./model";
import type { ApprovalDecision, Command, Receipt, WorkspaceAdapter, WorkspaceSnapshot } from "./model";

export const CODEX_TEXT_PROJECT = "local:codex-text-check";
export const CODEX_TEXT_REQUESTER = "local-owner";
/** Same-origin text trial. Provider credentials/config never enter client JS. */
export class CodexTextAdapter implements WorkspaceAdapter {
  private state: WorkspaceSnapshot = freezeSnapshot(snapshotSchema.parse({
    project_id: CODEX_TEXT_PROJECT, revision: 0, mode: "live", connected: false,
    observed_at: new Date(0).toISOString(), source: "Codex 文本试验 · 尚未连接",
    agents: [], tasks: [], events: [], receipts: [], approvals: [],
  }));
  private listeners = new Set<() => void>();
  private disposed = false;
  private abort = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  constructor() { void this.poll(); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(patch: WorkspaceSnapshot) {
    if (this.disposed) return;
    this.state = freezeSnapshot({ ...patch, revision: this.state.revision + 1 });
    this.listeners.forEach((listener) => listener());
  }
  private async poll() {
    try {
      const response = await fetch("/codex-text/snapshot", { signal: this.abort.signal, cache: "no-store", credentials: "omit" });
      if (!response.ok) throw new Error("Native connector unavailable");
      const state = snapshotSchema.parse(await response.json());
      if (state.project_id !== CODEX_TEXT_PROJECT || state.mode !== "live" ||
        state.agents.some((agent) => agent.id !== "native-codex" || agent.is_demo ||
          agent.capabilities.some((capability) => capability !== "chat"))) throw new Error("Native scope mismatch");
      this.publish(state);
    } catch {
      this.publish({ ...this.state, connected: false, source: "Codex 文本试验 · 本地桥接不可用；未自动重发指令" });
    } finally {
      if (!this.disposed) this.timer = setTimeout(() => void this.poll(), 1000);
    }
  }
  send = async (command: Command): Promise<Receipt> => {
    const response = await fetch("/codex-text/commands", {
      method: "POST", credentials: "omit", headers: { "Content-Type": "application/json", "X-Devungeon-Intent": "codex-text" },
      body: JSON.stringify(command),
    });
    if (!response.ok) throw new Error("桥接拒绝或回执未知；请核对活动。默认关闭、至多两次 turn、每条最多 1000 字。");
    return receiptSchema.parse(await response.json());
  };
  decide = async (_decision: ApprovalDecision): Promise<Receipt> => {
    throw new Error("文本试验不支持审批或工具授权；没有发送。");
  };
  dispose() {
    this.disposed = true;
    this.abort.abort();
    clearTimeout(this.timer);
    this.listeners.clear();
  }
}
