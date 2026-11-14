export const zhForge = {
  "forge.project": "选择项目世界",
  "forge.tiny": "小型落地页 · DEMO",
  "forge.workbench": "模块化 Agent 工作台 · DEMO",
  "forge.public": "Devungeon · 公开 GitHub",
  "forge.pack": "首个世界包 · 像素地牢",
  "forge.add": "增量扩建 · DEMO",
  "forge.refresh": "刷新公开项目",
  "forge.pendingMap": "项目事实已更新；当前副本保留原地图版本。",
  "forge.applyMap": "应用新地图 · 重开本地副本",
  "forge.switchNotice":
    "切换项目或扩建地图会重新开始本地副本；Agent 工作与审批保留。",
  "forge.source": "项目事实与来源",
  "forge.demo": "DEMO · 合成项目；对话、任务与审批均为本地模拟。",
  "forge.publicNotice":
    "只读公开来源。Issue / PR 是观察到的工作项，功能依赖与实际验收仍未知。",
  "forge.acceptance": "关闭 Issue、完成工具或赢得战斗均不构成功能验收。",
  "forge.loading": "等待公开快照，可先选择 DEMO 项目游玩。",
  "forge.invalid": "地图生成失败，下面保留事实视图与原始诊断。",
  "forge.original": "原始来源文本（未翻译）",
  "forge.features": "功能 / 工作项 {count} · 依赖 {dependencies}",
  "forge.revision": "来源版本",
  "forge.projectConnection": "项目来源",
  "forge.agentConnection": "Agent 来源",
  "forge.transport": "本地桥接",
  "forge.connected": "已连接",
  "forge.disconnected": "DISCONNECTED · 连接断开",
  "forge.stale": "STALE · 来源已过期",
  "forge.live": "LIVE · 新近真实观测",
  "forge.replay": "REPLAY · 历史记录",
  "forge.demoMode": "DEMO · 模拟来源",
  "forge.noAgent": "尚无 Agent 事件。GitHub 项目事件不会生成虚构 Agent。",
  "forge.agentReadonly":
    "观察到的 Agent 只支持检查；没有真实对话、指令或审批权限。",
  "forge.events": "来源事件 {count}",
  "forge.projectEvent": "项目观测",
  "forge.agentEvent": "Agent 观测",
  "forge.evidence": "来源证据",
  "forge.unknown": "未知 · 没有独立验收证据",
  "forge.noEvidence": "暂无来源证据",
  "forge.facts": "查看全部功能、状态与证据",
  "forge.gameOnly": "大厅中的敌人属于独立娱乐副本，与项目状态无关。",
  "forge.error": "来源暂不可用；保留最近快照和历史，自动尝试重连。",
} as const;
export const enForge: Record<keyof typeof zhForge, string> = {
  "forge.project": "Select project world",
  "forge.tiny": "Tiny landing page · DEMO",
  "forge.workbench": "Modular Agent workbench · DEMO",
  "forge.public": "Devungeon · Public GitHub",
  "forge.pack": "First world pack · Pixel dungeon",
  "forge.add": "Extend map · DEMO",
  "forge.refresh": "Refresh public project",
  "forge.pendingMap":
    "Project facts updated; the current encounter retains its map revision.",
  "forge.applyMap": "Apply updated map · Restart local encounter",
  "forge.switchNotice":
    "Switching projects or extending the map restarts the local encounter; Agent work and approvals are retained.",
  "forge.source": "Project facts and sources",
  "forge.demo":
    "DEMO · Synthetic project; chat, tasks and approvals are simulated locally.",
  "forge.publicNotice":
    "Read-only public source. Issues / PRs are observed work items; feature dependencies and actual acceptance remain unknown.",
  "forge.acceptance":
    "Closing an Issue, finishing a tool or winning a battle never proves feature acceptance.",
  "forge.loading":
    "Waiting for the public snapshot. You can play a DEMO project meanwhile.",
  "forge.invalid":
    "World generation failed. Facts and original diagnostics remain available below.",
  "forge.original": "Original source text (untranslated)",
  "forge.features":
    "Features / work items {count} · Dependencies {dependencies}",
  "forge.revision": "Source revision",
  "forge.projectConnection": "Project source",
  "forge.agentConnection": "Agent source",
  "forge.transport": "Local bridge",
  "forge.connected": "Connected",
  "forge.disconnected": "DISCONNECTED · Connection lost",
  "forge.stale": "STALE · Source expired",
  "forge.live": "LIVE · Recent real observation",
  "forge.replay": "REPLAY · Recorded history",
  "forge.demoMode": "DEMO · Simulated source",
  "forge.noAgent":
    "No Agent events yet. GitHub project observations never create fictional Agents.",
  "forge.agentReadonly":
    "Observed Agents support inspection only; real chat, commands and approvals are unavailable.",
  "forge.events": "Source events {count}",
  "forge.projectEvent": "Project observation",
  "forge.agentEvent": "Agent observation",
  "forge.evidence": "Source evidence",
  "forge.unknown": "Unknown · No independent acceptance evidence",
  "forge.noEvidence": "No source evidence yet",
  "forge.facts": "View all features, status and evidence",
  "forge.gameOnly":
    "Enemies in the foyer belong to a separate entertainment encounter, independent of project status.",
  "forge.error":
    "Source unavailable; latest snapshot and history retained. Reconnecting automatically.",
};
