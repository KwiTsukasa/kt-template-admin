import type { BpmnDefinition, BpmnElement } from '#/api/workflow-engine/bpmn';

import {
  bpmnPlane,
  bpmnProcess,
  indexBpmn,
  setBpmnBounds,
  setBpmnWaypoints,
} from './bpmn-model';
import {
  assignBpmnLane,
  attachBpmnBoundary,
  bpmnBounds,
  bpmnLanes,
  bpmnVisibleElements,
  fitBpmnContainers,
} from './bpmn-structure';

/**
 * 按顺序流分层排布当前作用域，回环不重复展开，边界事件和泳道随活动调整。
 * @param draft - 待更新坐标的标准模型副本。
 * @param scopeId - 子流程身份，空值表示主流程。
 * @param vertical - 是否沿纵向排列执行层级。
 */
export function arrangeBpmnScope(
  draft: BpmnDefinition,
  scopeId: string,
  vertical: boolean,
): void {
  const current = indexBpmn(draft).get(scopeId)?.element ?? bpmnProcess(draft);
  const elements: BpmnElement[] = (current.flowElements ?? []).filter(
    (item: BpmnElement) =>
      !['bpmn:BoundaryEvent', 'bpmn:SequenceFlow'].includes(item.$type),
  );
  const queue = elements
    .filter((element) => element.$type === 'bpmn:StartEvent')
    .map((element) => element.id ?? '');
  const ranks = new Map<string, number>();
  for (const id of queue) ranks.set(id, 0);
  for (let position = 0; position < queue.length; position++) {
    for (const flow of current.flowElements ?? []) {
      if (
        flow.$type !== 'bpmn:SequenceFlow' ||
        flow.sourceRef?.$ref !== queue[position] ||
        ranks.has(flow.targetRef?.$ref)
      )
        continue;
      ranks.set(
        flow.targetRef.$ref,
        (ranks.get(queue[position] ?? '') ?? 0) + 1,
      );
      queue.push(flow.targetRef.$ref);
    }
  }
  const offsets = new Map<number, number>();
  for (const element of elements) {
    const rank = ranks.get(element.id ?? '') ?? 0;
    const offset = offsets.get(rank) ?? 0;
    offsets.set(rank, offset + 1);
    let height = 76;
    let width = 160;
    let x = 90 + rank * 230;
    let y = 90 + offset * 140;
    if (vertical) {
      x = 90 + offset * 230;
      y = 90 + rank * 140;
    }
    if (element.$type.endsWith('Event')) {
      width = 40;
      height = 40;
    }
    if (element.$type.endsWith('Gateway')) {
      width = 56;
      height = 56;
    }
    x += (160 - width) / 2;
    y += (76 - height) / 2;
    const lane = bpmnLanes(current).find((item) =>
      item.flowNodeRef?.some(
        (reference: { $ref: string }) => reference.$ref === element.id,
      ),
    );
    const laneBox = lane && bpmnBounds(draft, lane.id);
    if (laneBox) {
      x += laneBox.x;
      y += laneBox.y;
    }
    setBpmnBounds(draft, element.id ?? '', { x, y, width, height });
    if (!lane) assignBpmnLane(draft, element.id ?? '');
  }
  for (const item of current.flowElements ?? [])
    if (item.attachedToRef)
      attachBpmnBoundary(draft, item.id, item.attachedToRef.$ref);
  fitBpmnContainers(draft, scopeId);
  const flows = new Set(
    bpmnVisibleElements(draft, scopeId)
      .filter((item: BpmnElement) =>
        ['bpmn:Association', 'bpmn:MessageFlow', 'bpmn:SequenceFlow'].includes(
          item.$type,
        ),
      )
      .map((item: BpmnElement) => item.id),
  );
  bpmnPlane(draft).planeElement = bpmnPlane(draft).planeElement.filter(
    (item: BpmnElement) => !flows.has(item.bpmnElement?.$ref),
  );
  for (const flow of current.flowElements ?? []) {
    if (flow.$type !== 'bpmn:SequenceFlow') continue;
    const source = bpmnBounds(draft, flow.sourceRef?.$ref);
    const target = bpmnBounds(draft, flow.targetRef?.$ref);
    if (!source || !target) continue;
    let start = { x: source.x + source.width, y: source.y + source.height / 2 };
    let end = { x: target.x, y: target.y + target.height / 2 };
    if (vertical) {
      start = { x: source.x + source.width / 2, y: source.y + source.height };
      end = { x: target.x + target.width / 2, y: target.y };
      if (target.y <= source.y) {
        start = { x: source.x + source.width, y: source.y + source.height / 2 };
        end = { x: target.x + target.width, y: target.y + target.height / 2 };
      }
    } else if (target.x <= source.x) {
      start = { x: source.x + source.width / 2, y: source.y + source.height };
      end = { x: target.x + target.width / 2, y: target.y + target.height };
    }
    setBpmnWaypoints(draft, flow.id, [start, end]);
  }
}
