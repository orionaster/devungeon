import type { TranslationKey } from "./i18n/catalogues";
import type { WorkspaceSnapshot } from "./model";
type Task = WorkspaceSnapshot["tasks"][number];
const fixtures = {
  "demo-plan": {
    title: "为下一段旅程拟定计划",
    detail: "等待你的目标。主管可派遣合成任务，也可以说明目前的阻塞。",
    titleKey: "demo.task.planTitle",
    detailKey: "demo.task.planDetail",
  },
  "demo-gate": {
    title: "修复北侧机关门",
    detail: "缺少门锁规则的确认。此处是合成场景；没有改动真实代码。",
    titleKey: "demo.task.gateTitle",
    detailKey: "demo.task.gateDetail",
  },
  "demo-review": {
    title: "核对指挥厅事件记录",
    detail: "证据已备好，等待独立核对。审查结束不会自动验收项目。",
    titleKey: "demo.task.reviewTitle",
    detailKey: "demo.task.reviewDetail",
  },
} as const;
/** Only authored fixtures pass both identity and exact-copy checks. No user task
 * text or arbitrary source data is translated; the snapshot is never mutated. */
export function taskCopy(
  task: Task,
  isDemo: boolean,
  t: (key: TranslationKey) => string,
) {
  const fixture = Object.prototype.hasOwnProperty.call(fixtures, task.id)
    ? fixtures[task.id as keyof typeof fixtures]
    : undefined;
  if (
    !isDemo ||
    !fixture ||
    task.title !== fixture.title ||
    task.detail !== fixture.detail
  )
    return { title: task.title, detail: task.detail, localized: false };
  return {
    title: t(fixture.titleKey),
    detail: t(fixture.detailKey),
    localized: true,
  };
}
