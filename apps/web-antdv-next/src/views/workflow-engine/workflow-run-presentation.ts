import type {
  WorkflowNodeRun,
  WorkflowNodeVisit,
  WorkflowRun,
} from '#/api/workflow-engine';

export type WorkflowRunNodeState = Pick<WorkflowNodeRun, 'nodeId' | 'status'>;

/**
 * 将标准事件、步骤账本与当前活动合成画布状态，活动令牌优先于较早完成的并行实例。
 * @param run - 同一次刷新返回的流程运行快照。
 * @returns 可用于画布着色和节点选择的状态，不为事件伪造脚本执行记录。
 */
export function workflowRunNodeStates(
  run: WorkflowRun,
): WorkflowRunNodeState[] {
  const states = new Map<string, WorkflowRunNodeState>();
  const events: Record<string, WorkflowNodeRun['status']> = {
    'activity.end': 'succeeded',
    'activity.error': 'failed',
    'activity.discard': 'skipped',
  };
  for (const transition of run.transitions ?? []) {
    const status = events[transition.event];
    if (status)
      states.set(transition.elementId, {
        nodeId: transition.elementId,
        status,
      });
  }
  for (const node of run.nodes)
    states.set(node.nodeId, { nodeId: node.nodeId, status: node.status });
  if (['pending', 'running', 'waiting'].includes(run.status)) {
    for (const activity of run.activeActivities ?? []) {
      states.set(activity.nodeId, {
        nodeId: activity.nodeId,
        status: 'waiting',
      });
    }
  }
  return [...states.values()];
}

/**
 * 保留并行多实例的全部已加载轮次，当前等待实例序号较小时也不会丢掉较晚完成的实例。
 * @param current - 页面当前展示的节点账本。
 * @param history - 已加载的倒序分页记录。
 * @returns 按轮次倒序排列且当前状态已更新的执行记录。
 */
export function workflowNodeVisits(
  current: WorkflowNodeRun,
  history: WorkflowNodeVisit[],
): WorkflowNodeVisit[] {
  const records = new Map(history.map((item) => [item.visit, item]));
  records.set(current.visit, {
    startedAt: null,
    finishedAt: null,
    ...records.get(current.visit),
    ...current,
  });
  return [...records.values()].toSorted(
    (left, right) => right.visit - left.visit,
  );
}
