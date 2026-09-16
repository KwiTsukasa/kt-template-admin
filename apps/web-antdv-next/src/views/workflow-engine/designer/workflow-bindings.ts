import type { WorkflowGraph } from '#/api/workflow-engine';

/**
 * 按当前轮次筛选可引用结果，返回控制器后只沿结束出口查找，避免把下一轮结果当作上游。
 * @param graph - 当前编辑的执行图。
 * @param source - 提供结果的节点身份。
 * @param target - 接收参数的节点身份。
 * @returns 来源能够先于目标完成时返回真。
 */
export function canReferenceWorkflowNode(
  graph: WorkflowGraph,
  source: string,
  target: string,
): boolean {
  if (source === target) return false;
  const visited = new Set<string>();
  const pending = [{ id: source, returning: false }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    if (current.id === target) return true;
    const key = `${current.id}:${current.returning}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const edge of graph.edges) {
      if (edge.source !== current.id) continue;
      if (current.returning && edge.sourcePort !== 'done') continue;
      pending.push({
        id: edge.target,
        returning: edge.targetPort === 'repeat',
      });
    }
  }
  return false;
}
