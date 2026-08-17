import type { MediaGovernanceApi } from '#/api/media-governance';

export interface MediaGovernanceTaskEventCursor {
  observedAt: string;
  revision: number;
  runId: null | string;
  runSequence: null | number;
}

export type MediaGovernanceTaskEventMergeResult =
  | 'applied'
  | 'deleted'
  | 'gap'
  | 'ignored'
  | 'missing';

/**
 * 按任务与运行游标合并一条实时事件，并识别重复或断档。
 *
 * @param current - 事件合并前的任务快照；缺行时允许为 undefined。
 * @param event - 服务端推送的任务修订、运行游标与任务补丁。
 * @param cursors - 按任务标识保存的事件修订号与运行事件序号。
 * @returns 事件处理结果及合并后的任务；删除或缺行时任务为 undefined。
 */
export function mergeMediaGovernanceTaskEvent(
  current: MediaGovernanceApi.Task | undefined,
  event: MediaGovernanceApi.TaskChangedEvent,
  cursors: Map<string, MediaGovernanceTaskEventCursor>,
) {
  if (event.changeType === 'deleted') {
    cursors.delete(event.taskId);
    return { result: 'deleted' as const, task: undefined };
  }
  if (!event.task) return { result: 'gap' as const, task: current };
  if (current && event.revision < current.revision) {
    return { result: 'ignored' as const, task: current };
  }
  if (current && event.revision > current.revision + 1) {
    return { result: 'gap' as const, task: current };
  }
  const cursor = cursors.get(event.taskId);
  const runSequenceGap =
    event.runId !== null &&
    event.runSequence !== null &&
    cursor?.runId === event.runId &&
    cursor.runSequence !== null &&
    event.runSequence > cursor.runSequence + 1;
  if (runSequenceGap) {
    return { result: 'gap' as const, task: current };
  }
  const repeatedRunEvent =
    event.runId !== null &&
    event.runSequence !== null &&
    cursor?.runId === event.runId &&
    cursor.runSequence !== null &&
    event.runSequence <= cursor.runSequence;
  if (repeatedRunEvent) {
    return { result: 'ignored' as const, task: current };
  }
  const repeatedRevision =
    cursor &&
    event.runSequence === null &&
    event.revision === cursor.revision &&
    event.observedAt <= cursor.observedAt;
  if (repeatedRevision) {
    return { result: 'ignored' as const, task: current };
  }
  if (!current && event.changeType !== 'created') {
    cursors.set(event.taskId, {
      observedAt: event.observedAt,
      revision: event.revision,
      runId: event.runId,
      runSequence: event.runSequence,
    });
    return { result: 'missing' as const, task: undefined };
  }
  const nextTask = current ?? projectCreatedTask(event.task);
  if (current) Object.assign(current, event.task);
  cursors.set(event.taskId, {
    observedAt: event.observedAt,
    revision: event.revision,
    runId: event.runId,
    runSequence: event.runSequence,
  });
  return { result: 'applied' as const, task: nextTask };
}

/**
 * 将任务事件合并到当前页行集，并维持筛选与分页边界。
 *
 * @param rows - 要原位合并、删除或插入事件任务的当前分页行集合。
 * @param event - 服务端推送的任务修订、运行游标与任务补丁。
 * @param cursors - 按任务标识保存的事件修订号与运行事件序号。
 * @param include - 判断事件合并后的任务是否应留在当前列表的筛选函数。
 * @param pageSize - 当前页容量；任务事件合并时用它限制页内记录数。
 * @returns applied、deleted、gap、ignored 或 missing 合并状态。
 */
export function mergeMediaGovernanceTaskRows(
  rows: MediaGovernanceApi.Task[],
  event: MediaGovernanceApi.TaskChangedEvent,
  cursors: Map<string, MediaGovernanceTaskEventCursor>,
  include: (task: MediaGovernanceApi.Task) => boolean,
  pageSize: number,
): MediaGovernanceTaskEventMergeResult {
  const index = rows.findIndex((task) => task.id === event.taskId);
  let current: MediaGovernanceApi.Task | undefined;
  if (index !== -1) {
    current = rows[index];
  }
  const merged = mergeMediaGovernanceTaskEvent(current, event, cursors);
  if (merged.result === 'deleted') {
    if (index !== -1) rows.splice(index, 1);
    return merged.result;
  }
  if (merged.result !== 'applied' || !merged.task) return merged.result;
  if (!include(merged.task)) {
    if (index !== -1) rows.splice(index, 1);
    return merged.result;
  }
  if (index === -1) rows.unshift(merged.task);
  if (rows.length > pageSize) rows.splice(pageSize);
  return merged.result;
}

/**
 * 将创建事件的安全任务补丁补齐为页面任务结构。
 *
 * @param task - 创建事件提供的安全任务补丁，至少包含任务标识与修订号。
 * @returns 补齐空 payloadSeal 与 sealedPlan 的页面任务结构。
 */
function projectCreatedTask(
  task: Partial<Omit<MediaGovernanceApi.Task, 'payloadSeal' | 'sealedPlan'>> &
    Pick<MediaGovernanceApi.Task, 'id' | 'revision'>,
): MediaGovernanceApi.Task {
  return {
    ...task,
    payloadSeal: null,
    sealedPlan: null,
  } as MediaGovernanceApi.Task;
}
