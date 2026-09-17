import { describe, expect, it } from 'vitest';

import { bpmnNodeSize } from '#/views/workflow-engine/designer/bpmn-geometry';
import { arrangeBpmnScope } from '#/views/workflow-engine/designer/bpmn-layout';
import {
  bpmnProcess,
  emptyBpmnWorkflow,
  setBpmnBounds,
} from '#/views/workflow-engine/designer/bpmn-model';
import { nodeMetadata } from '#/views/workflow-engine/designer/bpmn-node-presentation';
import {
  attachBpmnBoundary,
  bpmnBounds,
} from '#/views/workflow-engine/designer/bpmn-structure';

describe('bPMN 图形尺寸与渲染契约', () => {
  it.each([
    ['bpmn:ServiceTask', 160, 76],
    ['bpmn:StartEvent', 40, 40],
    ['bpmn:ExclusiveGateway', 56, 56],
    ['bpmn:Lane', 920, 240],
  ])('默认 %s 在排布和图形渲染中使用相同尺寸', (type, width, height) => {
    const element = { $type: String(type), id: 'node' };
    expect(bpmnNodeSize(element)).toEqual({ width, height });
    expect(nodeMetadata(element)).toMatchObject({ width, height });
  });

  it('保留导入 DI 的局部宽高，计算不回写原对象', () => {
    const bounds = Object.freeze({ width: 90 });
    expect(bpmnNodeSize({ $type: 'bpmn:StartEvent' }, bounds)).toEqual({
      width: 90,
      height: 40,
    });
    expect(nodeMetadata({ $type: 'bpmn:StartEvent' }, bounds)).toMatchObject({
      width: 90,
      height: 40,
    });
  });

  it('边界中心位于宿主下沿，切换排布方向后仍保持附着关系', () => {
    const document = emptyBpmnWorkflow();
    const process = bpmnProcess(document);
    process.flowElements = [
      { $type: 'bpmn:ServiceTask', id: 'task' },
      {
        $type: 'bpmn:BoundaryEvent',
        id: 'boundary',
        attachedToRef: { $ref: 'task' },
      },
    ];
    setBpmnBounds(document, 'task', { x: 200, y: 100, width: 160, height: 76 });
    for (const vertical of [false, true]) {
      arrangeBpmnScope(document, '', vertical);
      attachBpmnBoundary(document, 'boundary', 'task');
      const task = bpmnBounds(document, 'task');
      const boundary = bpmnBounds(document, 'boundary');
      if (!task || !boundary) throw new Error('排布必须保留宿主和边界图形');
      expect(boundary.x + boundary.width / 2).toBe(task.x + task.width / 2);
      expect(boundary.y + boundary.height / 2).toBe(task.y + task.height);
    }
  });

  it('抛出与捕获标记、非中断轮廓和端口透明填充保持标准区别', () => {
    const eventDefinitions = [{ $type: 'bpmn:SignalEventDefinition' }];
    const catchEvent = nodeMetadata({
      $type: 'bpmn:BoundaryEvent',
      cancelActivity: false,
      eventDefinitions,
    });
    const throwEvent = nodeMetadata({
      $type: 'bpmn:EndEvent',
      eventDefinitions,
    });
    expect(catchEvent.attrs?.body?.strokeDasharray).toBe('4 3');
    expect(catchEvent.attrs?.marker?.fill).toBe('none');
    expect(throwEvent.attrs?.marker?.fill).not.toBe('none');
    expect(throwEvent.attrs?.body?.strokeWidth).toBe(3.5);
    expect(JSON.stringify(catchEvent.ports)).toContain('18%, transparent');
    expect(nodeMetadata({ $type: 'bpmn:Lane' }).ports).toMatchObject({
      items: [],
    });
  });
});
