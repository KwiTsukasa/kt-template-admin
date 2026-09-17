import type { BpmnElement } from '#/api/workflow-engine/bpmn';

import { describe, expect, it } from 'vitest';

import { arrangeBpmnScope } from '#/views/workflow-engine/designer/bpmn-layout';
import { bpmnPlane, bpmnProcess, emptyBpmnWorkflow, indexBpmnShapes } from '#/views/workflow-engine/designer/bpmn-model';

describe('批量 BPMN 布局的遍历开销', () => {
  it.each([100, 1000])('%i 个泳道、活动与边界只做线性索引和移动', (size) => {
    const document = emptyBpmnWorkflow();
    const process = bpmnProcess(document);
    const plane = bpmnPlane(document);
    const lanes: BpmnElement[] = [];
    let shapeReads = 0;
    let flowReads = 0;
    const flow = (source: string, target: string): BpmnElement => {
      const element = { $type: 'bpmn:SequenceFlow', id: `${source}_${target}`, targetRef: { $ref: target } };
      Object.defineProperty(element, 'sourceRef', { enumerable: true, get: () => { flowReads++; return { $ref: source }; } });
      return element;
    };
    process.flowElements = [{ $type: 'bpmn:StartEvent', id: 'start' }];
    for (let index = 0; index < size; index++) {
      const id = `task_${index}`;
      const boundary = `boundary_${index}`;
      const lane = `lane_${index}`;
      let previous = 'start';
      if (index > 0) previous = `task_${index - 1}`;
      process.flowElements.push({ $type: 'bpmn:ServiceTask', id }, { $type: 'bpmn:BoundaryEvent', id: boundary, attachedToRef: { $ref: id } }, flow(previous, id));
      lanes.push({ $type: 'bpmn:Lane', id: lane, flowNodeRef: [{ $ref: id }, { $ref: boundary }] });
      const shape = { $type: 'bpmndi:BPMNShape', id: `${lane}_shape`, bounds: { $type: 'dc:Bounds', x: 30, y: index * 240, width: 890, height: 240 } };
      Object.defineProperty(shape, 'bpmnElement', { enumerable: true, get: () => { shapeReads++; return { $ref: lane }; } });
      plane.planeElement.push(shape);
    }
    process.flowElements.push({ $type: 'bpmn:EndEvent', id: 'end' }, flow(`task_${size - 1}`, 'end'));
    process.laneSets = [{ $type: 'bpmn:LaneSet', id: 'lanes', lanes }];
    const membership = lanes.map((lane) => structuredClone(lane.flowNodeRef));
    arrangeBpmnScope(document, '', true);
    expect(shapeReads).toBeLessThan(size * 15);
    expect(flowReads).toBeLessThan(size * 15);
    expect(lanes.map((lane) => lane.flowNodeRef)).toEqual(membership);
    const shapes = indexBpmnShapes(document);
    for (let index = 0; index < size; index++) {
      const host = shapes.get(`task_${index}`)?.bounds;
      const boundary = shapes.get(`boundary_${index}`)?.bounds;
      expect(boundary.y + boundary.height / 2).toBe(host.y + host.height);
    }
    expect(shapes.get('task_0_task_1')?.waypoint).toHaveLength(2);
  });
});
