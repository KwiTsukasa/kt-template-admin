import type { BpmnElement } from '#/api/workflow-engine/bpmn';

import { BPMN_KIND_GROUPS } from '#/constants/automation/bpmn';
import { BPMN_LAYOUT } from '#/constants/automation/workflow-canvas';

/**
 * 为渲染、自动排布和边界附着提供统一尺寸，已有 DI 的宽高分别优先于默认值。
 * @param element - 标准活动、事件、网关或容器节点。
 * @param bounds - 已保存的可选图形尺寸，部分缺失时只补缺失字段。
 * @returns 当前节点应使用的宽高，不修改输入模型或保存的 DI。
 */
export function bpmnNodeSize(
  element: BpmnElement,
  bounds?: Partial<{ height: number; width: number }>,
): { height: number; width: number } {
  let width: number = BPMN_LAYOUT.activityWidth;
  let height: number = BPMN_LAYOUT.activityHeight;
  if (BPMN_KIND_GROUPS.containers.has(element.$type)) {
    width = BPMN_LAYOUT.containerWidth;
    height = BPMN_LAYOUT.containerHeight;
  } else if (element.$type.endsWith('Event')) {
    width = BPMN_LAYOUT.eventSize;
    height = BPMN_LAYOUT.eventSize;
  } else if (element.$type.endsWith('Gateway')) {
    width = BPMN_LAYOUT.gatewaySize;
    height = BPMN_LAYOUT.gatewaySize;
  }
  return { width: bounds?.width ?? width, height: bounds?.height ?? height };
}
