import type { BpmnDefinition, BpmnElement } from '#/api/workflow-engine/bpmn';

import { BPMN_KIND_GROUPS, BPMN_TYPE } from '#/constants/automation/bpmn';
import { BPMN_LAYOUT } from '#/constants/automation/workflow-canvas';

import { bpmnNodeSize } from './bpmn-geometry';
import {
  bpmnProcess,
  indexBpmnDiagram,
  setBpmnBounds,
  setBpmnWaypoints,
} from './bpmn-model';
import {
  bpmnLanes,
  bpmnVisibleElements,
  fitBpmnContainers,
  positionBpmnBoundaries,
} from './bpmn-structure';

/**
 * 按顺序流一次分层排布，保留已声明的泳道归属，边界事件按宿主批量调整。
 * @param draft - 待更新坐标的标准模型副本。
 * @param scopeId - 子流程身份，空值表示主流程。
 * @param vertical - 是否沿纵向排列执行层级。
 */
export function arrangeBpmnScope(
  draft: BpmnDefinition,
  scopeId: string,
  vertical: boolean,
): void {
  const diagram = indexBpmnDiagram(draft);
  const current = diagram.elements.get(scopeId)?.element ?? bpmnProcess(draft);
  const elements: BpmnElement[] = (current.flowElements ?? []).filter(
    (item: BpmnElement) =>
      !BPMN_KIND_GROUPS.excludedLayoutNodes.has(item.$type),
  );
  const outgoing = new Map<string, BpmnElement[]>();
  const boundaries = new Map<string, BpmnElement[]>();
  for (const element of current.flowElements ?? []) {
    if (element.$type === BPMN_TYPE.SequenceFlow) {
      const rows = outgoing.get(element.sourceRef?.$ref) ?? [];
      rows.push(element);
      outgoing.set(element.sourceRef?.$ref, rows);
    }
    if (element.attachedToRef?.$ref) {
      const rows = boundaries.get(element.attachedToRef.$ref) ?? [];
      rows.push(element);
      boundaries.set(element.attachedToRef.$ref, rows);
    }
  }
  const laneByNode = new Map<string, BpmnElement>();
  for (const lane of bpmnLanes(current)) {
    for (const reference of lane.flowNodeRef ?? []) {
      if (!laneByNode.has(reference.$ref)) laneByNode.set(reference.$ref, lane);
    }
  }
  const queue = elements
    .filter((element) => element.$type === BPMN_TYPE.StartEvent)
    .map((element) => element.id ?? '');
  const ranks = new Map(queue.map((id) => [id, 0]));
  for (let position = 0; position < queue.length; position++) {
    const id = queue[position] ?? '';
    for (const flow of outgoing.get(id) ?? []) {
      const target = flow.targetRef?.$ref;
      if (!target || ranks.has(target)) continue;
      ranks.set(target, (ranks.get(id) ?? 0) + 1);
      queue.push(target);
    }
  }
  const offsets = new Map<number, number>();
  for (const element of elements) {
    const rank = ranks.get(element.id ?? '') ?? 0;
    const offset = offsets.get(rank) ?? 0;
    offsets.set(rank, offset + 1);
    const { width, height } = bpmnNodeSize(element);
    let x = BPMN_LAYOUT.origin + rank * BPMN_LAYOUT.columnSpacing;
    let y = BPMN_LAYOUT.origin + offset * BPMN_LAYOUT.rowSpacing;
    if (vertical) {
      x = BPMN_LAYOUT.origin + offset * BPMN_LAYOUT.columnSpacing;
      y = BPMN_LAYOUT.origin + rank * BPMN_LAYOUT.rowSpacing;
    }
    x += (BPMN_LAYOUT.activityWidth - width) / 2;
    y += (BPMN_LAYOUT.activityHeight - height) / 2;
    const lane = laneByNode.get(element.id ?? '');
    const laneBox = diagram.shapes.get(lane?.id ?? '')?.bounds;
    if (laneBox) {
      x += laneBox.x;
      y += laneBox.y;
    }
    setBpmnBounds(draft, element.id ?? '', { x, y, width, height }, diagram);
  }
  for (const [activityId, events] of boundaries)
    positionBpmnBoundaries(draft, activityId, events, diagram);
  fitBpmnContainers(draft, scopeId, diagram);
  const flows = new Set(
    bpmnVisibleElements(draft, scopeId)
      .filter((item: BpmnElement) =>
        BPMN_KIND_GROUPS.connections.has(item.$type),
      )
      .map((item: BpmnElement) => item.id),
  );
  diagram.plane.planeElement = diagram.plane.planeElement.filter(
    (item: BpmnElement) => !flows.has(item.bpmnElement?.$ref),
  );
  for (const id of flows) diagram.shapes.delete(id ?? '');
  for (const flow of current.flowElements ?? []) {
    if (flow.$type !== BPMN_TYPE.SequenceFlow) continue;
    const source = diagram.shapes.get(flow.sourceRef?.$ref)?.bounds;
    const target = diagram.shapes.get(flow.targetRef?.$ref)?.bounds;
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
    setBpmnWaypoints(draft, flow.id, [start, end], diagram);
  }
}
