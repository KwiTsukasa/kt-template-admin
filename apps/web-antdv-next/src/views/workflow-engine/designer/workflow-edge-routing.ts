import type { EdgeView, RouterDefinition } from '@antv/x6';

import type {
  WorkflowNode,
  WorkflowNodeLayout,
  WorkflowPortSide,
} from '#/api/workflow-engine';

import { routerPresets } from '@antv/x6';

import { resolveNodeLayout } from './workflow-layout';

const sides: WorkflowPortSide[] = ['top', 'right', 'bottom', 'left'];

/**
 * 将循环返回与退出分配到主入口、循环体以外的两侧，旋转主端口时同步旋转。
 * @param layout - 节点保存的主入口和主出口方向。
 * @returns 循环的返回侧与退出侧，不与两个主端口共用一侧。
 */
export function loopPortSides(layout: Partial<WorkflowNodeLayout>) {
  const { inputSide, outputSide } = resolveNodeLayout(layout);
  const candidates = [
    sides[(sides.indexOf(outputSide) + 3) % 4],
    sides[(sides.indexOf(outputSide) + 1) % 4],
    ...sides,
  ].filter((side): side is WorkflowPortSide =>
    Boolean(side && side !== inputSide && side !== outputSide),
  );
  const available = [...new Set(candidates)];
  return { repeat: available[0] || 'top', done: available[1] || 'bottom' };
}

/**
 * 读取端口实际展示方向，使连线从端口所在边向外延伸，避免贴着节点边缘折返。
 * @param view - 当前连线视图。
 * @param terminal - 要读取的连线起点或终点。
 * @returns 端口存在时的方向，拖动到空白时为空。
 */
function portSide(view: EdgeView, terminal: 'source' | 'target') {
  const edge = view.cell;
  let node = edge.getSourceCell();
  let port = edge.getSourcePortId();
  if (terminal === 'target') {
    node = edge.getTargetCell();
    port = edge.getTargetPortId();
  }
  if (!node?.isNode() || !port) return undefined;
  const layout = resolveNodeLayout(node.getProp('presentation'));
  if (node.getData<WorkflowNode>().type === 'loop') {
    if (port === 'repeat') return loopPortSides(layout).repeat;
    if (port === 'done') return loopPortSides(layout).done;
  }
  if (port === 'in') return layout.inputSide;
  return layout.outputSide;
}

export const workflowEdgeRouter: RouterDefinition<Record<string, unknown>> = (
  vertices,
  _options,
  view,
) => {
  const start = portSide(view, 'source');
  const end = portSide(view, 'target');
  let startDirections = sides;
  let endDirections = sides;
  if (start) startDirections = [start];
  if (end) endDirections = [end];
  let clearance = 24;
  if (view.cell.getTargetPortId() === 'repeat') clearance = 48;
  return routerPresets.manhattan.call(
    view,
    vertices,
    {
      step: 8,
      snapToGrid: false,
      padding: {
        top: clearance,
        right: clearance,
        bottom: clearance,
        left: clearance,
      },
      maxLoopCount: 4000,
      startDirections,
      endDirections,
    },
    view,
  );
};
