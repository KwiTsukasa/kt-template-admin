import type {
  CoordinationSnapshot,
  CoordinationTask,
} from '#/api/system/workflow-coordination';

export const RECENT_WINDOW_MS = 15 * 60_000;
export const CONNECTION_STALE_MS = 150_000;
export const TASK_STATUS_FILTERS = ['进行中', '状态待确认', '已暂停', '已完成'];
export const TASK_STATUS_COLORS: Record<string, string> = {
  进行中: 'processing',
  状态待确认: 'warning',
  已暂停: 'default',
  已完成: 'success',
};
export const OPERATION_LABELS: Record<string, string> = {
  claim: '声明资源',
  conflict: '资源冲突',
  release: '释放资源',
  report: '协调记录',
};

/**
 * 用所有者、动作、资源和获取时间生成声明身份，保留重复申请的每条记录。
 * @param claim - 需要在列表中稳定区分的资源声明。
 * @returns 无分隔符歧义的声明身份。
 */
export function claimIdentity(claim: CoordinationSnapshot['claims'][number]) {
  return JSON.stringify([
    claim.workstreamId,
    claim.actionId,
    claim.kind,
    claim.key,
    claim.acquiredAt,
  ]);
}

/**
 * 使用资源所有者索引筛选近期任务，保留当前任务和未知状态的资源所有者。
 * @param snapshot - 当前只读协调快照，尚未加载时可省略。
 * @param currentId - 当前入口绑定的任务身份。
 * @param query - 按任务名称或身份匹配的搜索文本。
 * @param includeHistory - 是否包含已完成和超过近期窗口的任务。
 * @param now - 用于判定近期窗口的当前毫秒时间。
 * @param status - 精确匹配的展示状态，空值表示全部状态。
 * @returns 当前任务优先、其余按更新时间倒序排列的匹配任务。
 */
export function selectCoordinationTasks(
  snapshot: CoordinationSnapshot | undefined,
  currentId: string,
  query: string,
  includeHistory: boolean,
  now: number,
  status = '',
) {
  if (!snapshot) return [];
  const owners = new Set(snapshot.claims.map((claim) => claim.workstreamId));
  const keyword = query.trim().toLowerCase();
  return snapshot.tasks
    .filter((task) => {
      const historical =
        task.status === 'completed' ||
        now - Date.parse(task.updatedAt) > RECENT_WINDOW_MS;
      if (
        !includeHistory &&
        historical &&
        task.workstreamId !== currentId &&
        !owners.has(task.workstreamId)
      )
        return false;
      if (status && taskStatus(task, now) !== status) return false;
      return `${task.objective} ${task.workstreamId}`
        .toLowerCase()
        .includes(keyword);
    })
    .toSorted((left, right) => {
      if (left.workstreamId === right.workstreamId) return 0;
      if (left.workstreamId === currentId) return -1;
      if (right.workstreamId === currentId) return 1;
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
}

/**
 * 将暂停与完成状态保留为原状态，仅对超时的活动任务提示待确认。
 * @param task - 持久化任务摘要。
 * @param now - 当前时间的毫秒值。
 * @returns 供列表和资源所有者共用的中文状态。
 */
export function taskStatus(task: CoordinationTask, now: number) {
  if (task.status === 'completed') return '已完成';
  if (task.status === 'paused') return '已暂停';
  if (now - Date.parse(task.updatedAt) > RECENT_WINDOW_MS) return '状态待确认';
  return '进行中';
}

/**
 * 汇总近期活动和冲突，只把当前任务或持有资源的超时活动任务计入待确认。
 * @param snapshot - 已验证的共享协调快照。
 * @param currentId - 当前页面绑定的任务标识。
 * @param now - 用于计算十五分钟窗口的当前时间。
 * @returns 与搜索和历史开关无关的工作区统计。
 */
export function summarizeCoordination(
  snapshot: CoordinationSnapshot,
  currentId: string,
  now: number,
) {
  const owners = new Set(snapshot.claims.map((claim) => claim.workstreamId));
  return {
    active: snapshot.tasks.filter((task) => taskStatus(task, now) === '进行中')
      .length,
    resources: snapshot.claims.length,
    conflicts: snapshot.events.filter((event) => {
      const age = now - Date.parse(event.at);
      return (
        event.operation === 'conflict' && age >= 0 && age <= RECENT_WINDOW_MS
      );
    }).length,
    pending: snapshot.tasks.filter(
      (task) =>
        taskStatus(task, now) === '状态待确认' &&
        (task.workstreamId === currentId || owners.has(task.workstreamId)),
    ).length,
  };
}

/**
 * 标注声明所有者与当前动作的关系，保留需要所有者核对的声明。
 * @param claim - 尚未释放的资源声明。
 * @param owner - 可读的所有者任务，缺失时保持未知。
 * @param now - 判断所有者更新是否超时的当前时间。
 * @returns 资源声明的核对提示。
 */
export function claimStatus(
  claim: CoordinationSnapshot['claims'][number],
  owner: CoordinationTask | undefined,
  now: number,
) {
  if (!owner) return '所有者状态不可读，保留占用';
  if (owner.status === 'completed') return '任务已完成，声明尚未释放';
  if (owner.actionId !== claim.actionId) return '旧动作声明，等待所有者核对';
  if (owner.status === 'paused') return '任务已暂停，保留占用';
  if (taskStatus(owner, now) === '状态待确认')
    return '所有者状态待确认，保留占用';
  return '当前动作占用';
}
