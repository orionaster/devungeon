/** First-party read-only projection explanations; no source fact translation. */
export const zhScout = {
  "scout.task.observedAssociation":
    "仅观察到此任务关联，任务完成度未知。工具结束不等于任务结束或项目验收。",
  "scout.task.activityEvidence": "原始活动来源",
} as const;
export const enScout: { [K in keyof typeof zhScout]: string } = {
  "scout.task.observedAssociation":
    "Only this task association was observed; completion is unknown. A tool finishing does not establish task completion or project acceptance.",
  "scout.task.activityEvidence": "Original activity source",
};
