export const zhSample = {
  "sample.title": "公开项目观测室",
  "sample.feature": "让真实项目进展有据可查",
  "sample.summary":
    "从公开 GitHub 项目读取工作条目，保留来源和时间。这里的地图桌负责读取，档案柜保存证据，检验台演示两种不同的 Agent 工作。",
  "sample.project": "当前项目",
  "sample.object.source-desk": "项目地图桌",
  "sample.object.evidence-cabinet": "来源档案柜",
  "sample.object.test-bench": "Agent 检验台",
  "sample.object.source-desk.purpose":
    "查看公开项目的最近一次观测。读取只经过本地桥接，不修改 GitHub。",
  "sample.object.evidence-cabinet.purpose":
    "核对条目原文、出处与观测时间。关闭 Issue 和合并 PR 仍不能证明功能已经验收。",
  "sample.object.test-bench.purpose":
    "让同一位 DEMO 伙伴分别侦查地图桌、检验工作台。动作来自明确的模拟任务，不会调用真实 AI。",
  "sample.implemented": "已实现",
  "sample.implemented.detail":
    "只读公开仓库及 Issue / PR；显示来源、时间和断线；历史事件与实时事件分开。",
  "sample.missing": "尚缺什么",
  "sample.missing.detail":
    "尚不能从条目判断完整功能、依赖或产品验收。这里没有接通真实模型，也没有自动开发或发布。",
  "sample.acceptance": "功能验收：未知 · 等待产品负责人核对",
  "sample.gameOnly":
    "这是可游玩的功能样板。击败敌人、开宝箱和演示动作都不会修改项目进度。",
  "sample.close": "回到游戏",
  "sample.read": "读取公开项目",
  "sample.reading": "正在读取…",
  "sample.readHelp":
    "读取本地桥接保存的最近一次公开观测，不强制刷新 GitHub。这是真实的只读程序操作，不是 Agent 或模型执行。",
  "sample.sourceState": "项目来源状态",
  "sample.items": "观测到 {count} 个工作条目；功能完成情况未知。",
  "sample.noSource": "还没有可用的公开项目观测。可重试读取，或先游玩样板房。",
  "sample.sourceError":
    "来源暂不可用，保留上次观测。当前不能判断新的项目进展。",
  "sample.invalidSource": "来源格式或项目范围不符，已拒绝这次读取。",
  "sample.readFailure": "本地桥接或公开来源不可用，读取没有成功。可以重试。",
  "sample.receipt": "最近一次真实读取",
  "sample.receiptTime": "本地读取 {time}",
  "sample.observed": "来源观测 {time}",
  "sample.original": "原始条目与证据",
  "sample.originalHelp": "下面保留 GitHub 原文。条目状态不等于功能验收。",
  "sample.events": "最近来源事件",
  "sample.eventFallback":
    "该事件没有受支持的任务动作元数据；仅展示证据，不表演 Agent 工作。",
  "sample.codeEvidence": "实现依据",
  "sample.metadata": "映射与原始活动记录",
  "sample.demoTitle": "DEMO · 不调用真实模型",
  "sample.agentName": "Moss · 观测室伙伴",
  "sample.agentIdentity":
    "本地脚本驱动的 DEMO 角色。身份不会因为读取真实 GitHub 数据而变成真实 AI。",
  "sample.agentTask": "伙伴与当前任务",
  "sample.demoScan": "演示侦查地图",
  "sample.demoTest": "演示检验工作台",
  "sample.demoRunning": "伙伴正在执行 DEMO，稍后可切换动作。",
  "sample.demoHelp":
    "侦查会转向地图并扫描；检验会在工作台敲击。六秒后任务结束，历史或过期记录不会继续工作。",
  "sample.replay": "查看上次演示记录",
  "sample.replayHelp": "REPLAY 是历史记录，不会重新播放为实时工作。",
  "sample.action.scan": "侦查地图 · DEMO",
  "sample.action.test": "检验工作台 · DEMO",
  "sample.action.read": "读取公开项目 · 本地程序",
  "sample.phase.running": "执行中",
  "sample.phase.completed": "已结束 · 不代表验收通过",
  "sample.phase.failed": "读取失败",
  "sample.phase.expired": "已过期 · 不再显示工作动作",
  "sample.noActivity": "尚无任务动作。可选择一个 DEMO，或读取公开项目。",
  "sample.mode.LIVE": "LIVE · 真实来源",
  "sample.mode.DEMO": "DEMO · 模拟任务",
  "sample.mode.REPLAY": "REPLAY · 历史记录",
  "sample.mode.STALE": "STALE · 来源已过期",
  "sample.mode.DISCONNECTED": "DISCONNECTED · 来源未连接",
} as const;

export const enSample: Record<keyof typeof zhSample, string> = {
  "sample.title": "Public project observatory",
  "sample.feature": "Project progress you can trace",
  "sample.summary":
    "Read work items from a public GitHub project with their sources and timestamps. The map desk reads, the archive keeps evidence, and the bench demonstrates two distinct Agent tasks.",
  "sample.project": "Current project",
  "sample.object.source-desk": "Project map desk",
  "sample.object.evidence-cabinet": "Source archive",
  "sample.object.test-bench": "Agent test bench",
  "sample.object.source-desk.purpose":
    "Inspect the latest public project observation. Reads use the local bridge and never modify GitHub.",
  "sample.object.evidence-cabinet.purpose":
    "Check original work items, sources and timestamps. Closed issues and merged PRs do not prove product acceptance.",
  "sample.object.test-bench.purpose":
    "Ask one DEMO companion to scan the map desk or inspect the test bench. Explicit scripted tasks drive these actions, without calling real AI.",
  "sample.implemented": "Implemented",
  "sample.implemented.detail":
    "Read-only public repository and issue / PR observations, source links, timestamps and disconnect states; history stays separate from live events.",
  "sample.missing": "Still missing",
  "sample.missing.detail":
    "Work items cannot establish complete features, dependencies or product acceptance. No real model, autonomous development or publishing is connected here.",
  "sample.acceptance": "Feature acceptance: unknown · awaiting product review",
  "sample.gameOnly":
    "This is a playable feature sample. Combat, loot and scripted actions never change project progress.",
  "sample.close": "Return to game",
  "sample.read": "Read public project",
  "sample.reading": "Reading…",
  "sample.readHelp":
    "Read the latest public observation saved by the local bridge; this does not force a GitHub refresh. It is a real read-only program operation, not Agent or model execution.",
  "sample.sourceState": "Project source state",
  "sample.items":
    "Observed {count} work items; feature completion remains unknown.",
  "sample.noSource":
    "No public project observation is available yet. Retry the read, or play the sample room first.",
  "sample.sourceError":
    "The source is unavailable. The last observation is retained; new project progress is unknown.",
  "sample.invalidSource":
    "Source format or project scope did not match. This read was rejected.",
  "sample.readFailure":
    "The local bridge or public source was unavailable. The read failed; you can retry.",
  "sample.receipt": "Last real read",
  "sample.receiptTime": "Local read {time}",
  "sample.observed": "Source observed {time}",
  "sample.original": "Original work items and evidence",
  "sample.originalHelp":
    "GitHub text is preserved below. Work-item status is not feature acceptance.",
  "sample.events": "Recent source events",
  "sample.eventFallback":
    "This event has no supported task-action metadata. Evidence is shown without inventing Agent work.",
  "sample.codeEvidence": "Implementation evidence",
  "sample.metadata": "Mapping and original activity records",
  "sample.demoTitle": "DEMO · no real model calls",
  "sample.agentName": "Moss · observatory companion",
  "sample.agentIdentity":
    "A DEMO character driven by local scripts. Reading real GitHub data never turns this companion into a real AI.",
  "sample.agentTask": "Companion and current task",
  "sample.demoScan": "Demo map scan",
  "sample.demoTest": "Demo bench inspection",
  "sample.demoRunning":
    "The companion is running a DEMO. You can switch actions when it finishes.",
  "sample.demoHelp":
    "Scanning turns toward the map; inspection taps at the bench. Tasks end after six seconds. Historical or expired records never keep working.",
  "sample.replay": "View last demo record",
  "sample.replayHelp": "REPLAY is history and never restarts live work.",
  "sample.action.scan": "Map scan · DEMO",
  "sample.action.test": "Bench inspection · DEMO",
  "sample.action.read": "Read public project · local program",
  "sample.phase.running": "Running",
  "sample.phase.completed": "Ended · not product acceptance",
  "sample.phase.failed": "Read failed",
  "sample.phase.expired": "Expired · no work action",
  "sample.noActivity":
    "No task actions yet. Choose a DEMO or read the public project.",
  "sample.mode.LIVE": "LIVE · real source",
  "sample.mode.DEMO": "DEMO · scripted task",
  "sample.mode.REPLAY": "REPLAY · history",
  "sample.mode.STALE": "STALE · source expired",
  "sample.mode.DISCONNECTED": "DISCONNECTED · source offline",
};
