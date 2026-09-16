import type {
  WorkflowGraph,
  WorkflowNodeLayout,
  WorkflowPortSide,
} from '#/api/workflow-engine';

/**
 * 保留已保存的节点外观，为缺少尺寸的旧布局补齐圆角矩形，并按画布方向确定默认端口。
 * @param layout - 已保存的节点展示配置。
 * @param direction - 整张画布的新节点默认方向。
 * @returns 具备完整尺寸与端口信息的节点布局。
 */
export function resolveNodeLayout(
  layout: Partial<WorkflowNodeLayout> = {},
  direction: 'horizontal' | 'vertical' = 'horizontal',
): Required<WorkflowNodeLayout> {
  let inputSide: WorkflowPortSide = 'left';
  let outputSide: WorkflowPortSide = 'right';
  if (direction === 'vertical') {
    inputSide = 'top';
    outputSide = 'bottom';
  }
  return {
    x: 0,
    y: 0,
    width: 190,
    height: 76,
    shape: 'rounded',
    inputSide,
    outputSide,
    ...layout,
  };
}

/**
 * 按执行层次排布节点，回环返回边不参与分层，分支按各自尺寸避让。
 * @param graph - 需要排布的执行图。
 * @param layouts - 当前节点的尺寸和形态。
 * @param direction - 从左至右或从上至下的排布方向。
 * @returns 保留形态与尺寸、更新坐标和端口方向的布局字典。
 */
export function arrangeWorkflow(
  graph: WorkflowGraph,
  layouts: Record<string, WorkflowNodeLayout>,
  direction: 'horizontal' | 'vertical',
): Record<string, WorkflowNodeLayout> {
  const edges = graph.edges.filter((edge) => edge.targetPort !== 'repeat');
  const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  const ranks = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of edges)
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
  const pending = graph.nodes
    .filter((node) => !indegree.get(node.id))
    .map((node) => node.id);
  const visited = new Set<string>();
  while (pending.length > 0) {
    const id = pending.shift();
    if (!id) break;
    visited.add(id);
    for (const edge of edges.filter((edge) => edge.source === id)) {
      ranks.set(
        edge.target,
        Math.max(ranks.get(edge.target) || 0, (ranks.get(id) || 0) + 1),
      );
      indegree.set(edge.target, (indegree.get(edge.target) || 0) - 1);
      if (!indegree.get(edge.target)) pending.push(edge.target);
    }
  }
  let fallbackRank = Math.max(0, ...ranks.values());
  for (const node of graph.nodes)
    if (!visited.has(node.id)) ranks.set(node.id, ++fallbackRank);
  const levels = new Map<number, string[]>();
  for (const node of graph.nodes) {
    const rank = ranks.get(node.id) || 0;
    const level = levels.get(rank) || [];
    level.push(node.id);
    levels.set(rank, level);
  }
  const result: Record<string, WorkflowNodeLayout> = {};
  let primary = 80;
  for (const [, ids] of [...levels].toSorted(([a], [b]) => a - b)) {
    let secondary = 80;
    let depth = 0;
    for (const id of ids) {
      const layout = resolveNodeLayout(layouts[id], direction);
      if (direction === 'vertical') {
        result[id] = {
          ...layout,
          x: secondary,
          y: primary,
          inputSide: 'top',
          outputSide: 'bottom',
        };
        secondary += layout.width + 72;
        depth = Math.max(depth, layout.height);
      } else {
        result[id] = {
          ...layout,
          x: primary,
          y: secondary,
          inputSide: 'left',
          outputSide: 'right',
        };
        secondary += layout.height + 72;
        depth = Math.max(depth, layout.width);
      }
    }
    primary += depth + 112;
  }
  return result;
}
