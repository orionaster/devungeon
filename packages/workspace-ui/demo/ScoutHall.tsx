import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AgentWorkspace,
  connectScoutStream,
  PixelAgent,
  ScoutWorkspaceAdapter,
  WorkspaceController,
  connectionLabel,
  agentConnectionLabel,
} from "../src";

const scout = new ScoutWorkspaceAdapter("github:orionaster/devungeon");
const controller = new WorkspaceController(
  scout,
  "local-viewer",
  scout.projectId,
);

export function ScoutHall() {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(
    () => connectScoutStream(scout, "/scout-read/v1/stream", setError),
    [],
  );
  return (
    <main className="hall">
      <header className="hall-header">
        <div className="hall-brand">
          <span className="hall-rune">◈</span>
          <strong>DEVUNGEON</strong>
          <span>SCOUT 观察席</span>
        </div>
        <span className="hall-connection">{connectionLabel(snapshot)}</span>
      </header>
      <div className="scout-intro">
        <p>真实来源 · 只读连接</p>
        <h1>工作留下的痕迹。</h1>
        <p>
          从 SCOUT
          的本地事件桥观察角色。点击角色可核对原始时间、任务关联与证据。
        </p>
        <p>当前桥仅支持观察；真实聊天、调度与审批均不可用。</p>
        <p>GitHub 工作项不会被绘成正在工作的 Agent。</p>
      </div>
      <section className="scout-room" aria-label="SCOUT 只读角色观察区">
        {snapshot.agents.length === 0 ? (
          <p>{error || "等待 Agent 事件。公开项目事件不会创建 Agent 角色。"}</p>
        ) : (
          snapshot.agents.map((agent) => (
            <button
              key={agent.id}
              className="scout-agent"
              onClick={() => setSelected(agent.id)}
            >
              <span>{agentConnectionLabel(snapshot, agent)}</span>
              <PixelAgent role={agent.role} />
              <strong>{agent.name}</strong>
              <small>点击核对来源与证据</small>
            </button>
          ))
        )}
      </section>
      <footer className="hall-footer">
        <span>{snapshot.source}</span>
        <p>2D 工作台集成宿主 · 非完整游戏</p>
      </footer>
      <AgentWorkspace
        adapter={controller}
        selectedAgentId={selected}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}
