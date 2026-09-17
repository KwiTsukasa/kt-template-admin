import type { BpmnElement } from '#/api/workflow-engine/bpmn';

import { describe, expect, it, vi } from 'vitest';

import {
  bpmnEventReferenceValue,
  eventSubprocessRestriction,
  setBpmnEventReference,
  setBpmnEventSubprocess,
  setBpmnEventType,
} from '#/views/workflow-engine/designer/bpmn-events';
import {
  bpmnProcess,
  emptyBpmnWorkflow,
  indexBpmn,
} from '#/views/workflow-engine/designer/bpmn-model';
import {
  attachBpmnBoundary,
  bpmnConnectionType,
} from '#/views/workflow-engine/designer/bpmn-structure';
import { nodeMetadata } from '#/views/workflow-engine/designer/BpmnCanvas';

// 图形数据在这里回归，X6 的实际 SVG 渲染另在浏览器验收。
vi.mock('../apps/web-antdv-next/node_modules/@antv/x6', () => ({}));

const fixture = () => {
  const document = emptyBpmnWorkflow();
  const process = bpmnProcess(document);
  const start: BpmnElement = { $type: 'bpmn:StartEvent', id: 'start' };
  const subprocess: BpmnElement = {
    $type: 'bpmn:SubProcess',
    id: 'sub',
    flowElements: [start, { $type: 'bpmn:UserTask', id: 'human' }],
  };
  process.flowElements.push(subprocess, { $type: 'bpmn:UserTask', id: 'main' });
  return { document, process, start, subprocess };
};

describe('事件配置与 BPMN 图形', () => {
  it('转换事件子流程保留活动，JSON 往返仍为独立事件入口且不能接外部顺序流', () => {
    const { document, subprocess, start } = fixture();
    expect(setBpmnEventSubprocess(document, subprocess, true)).toBe(true);
    start.isInterrupting = false;
    setBpmnEventReference(document, start.eventDefinitions[0], '资料更新');
    const persisted = JSON.stringify(document);
    const restored = JSON.parse(persisted);
    const elements = indexBpmn(restored);
    expect(elements.get('sub')?.element.triggeredByEvent).toBe(true);
    expect(elements.get('human')?.parent?.id).toBe('sub');
    expect(elements.get('start')?.element.isInterrupting).toBe(false);
    expect(
      bpmnEventReferenceValue(
        restored,
        elements.get('start')?.element.eventDefinitions[0],
      ),
    ).toBe('资料更新');
    expect(bpmnConnectionType(restored, 'main', 'sub')).toBeNull();
    expect(bpmnConnectionType(restored, 'sub', 'main')).toBeNull();
    expect(bpmnConnectionType(restored, 'start', 'human')).toBe(
      'bpmn:SequenceFlow',
    );
  });

  it.each(['incoming', 'outgoing', 'boundary', 'starts'])(
    '阻止 %s 冲突的转换且不删除用户现有模型',
    (kind) => {
      const { document, process, subprocess } = fixture();
      if (kind === 'incoming')
        process.flowElements.push({
          $type: 'bpmn:SequenceFlow',
          sourceRef: { $ref: 'main' },
          targetRef: { $ref: 'sub' },
        });
      if (kind === 'outgoing')
        process.flowElements.push({
          $type: 'bpmn:SequenceFlow',
          sourceRef: { $ref: 'sub' },
          targetRef: { $ref: 'main' },
        });
      if (kind === 'boundary')
        process.flowElements.push({
          $type: 'bpmn:BoundaryEvent',
          attachedToRef: { $ref: 'sub' },
        });
      if (kind === 'starts')
        subprocess.flowElements.push({ $type: 'bpmn:StartEvent', id: 'other' });
      const before = JSON.stringify(document);
      expect(eventSubprocessRestriction(document, subprocess)).not.toBe('');
      expect(setBpmnEventSubprocess(document, subprocess, true)).toBe(false);
      expect(JSON.stringify(document)).toBe(before);
    },
  );

  it('事件子流程不能附着边界，切回普通子流程后恢复可连接的无触发开始事件', () => {
    const { document, process, subprocess, start } = fixture();
    setBpmnEventSubprocess(document, subprocess, true);
    const boundary: BpmnElement = {
      $type: 'bpmn:BoundaryEvent',
      id: 'boundary',
    };
    process.flowElements.push(boundary);
    attachBpmnBoundary(document, 'boundary', 'sub');
    expect(boundary.attachedToRef).toBeUndefined();
    setBpmnEventSubprocess(document, subprocess, false);
    expect(start.eventDefinitions).toEqual([]);
    expect(start.isInterrupting).toBeUndefined();
    expect(bpmnConnectionType(document, 'main', 'sub')).toBe(
      'bpmn:SequenceFlow',
    );
  });

  it('同名升级事件共享引用，单独修改或清空不会更改另一节点的捕获代码', () => {
    const { document, process, start } = fixture();
    const throwing: BpmnElement = {
      $type: 'bpmn:IntermediateThrowEvent',
      id: 'throw',
    };
    process.flowElements.push(throwing);
    for (const node of [start, throwing]) {
      setBpmnEventType(node, 'bpmn:EscalationEventDefinition');
      setBpmnEventReference(document, node.eventDefinitions[0], 'CHECK');
    }
    expect(start.eventDefinitions[0].escalationRef).toEqual(
      throwing.eventDefinitions[0].escalationRef,
    );
    setBpmnEventReference(document, throwing.eventDefinitions[0], 'REVIEW');
    expect(bpmnEventReferenceValue(document, start.eventDefinitions[0])).toBe(
      'CHECK',
    );
    setBpmnEventReference(document, throwing.eventDefinitions[0], 'RETRY');
    expect(
      document.model.rootElements
        .filter((item: BpmnElement) => item.$type === 'bpmn:Escalation')
        .map((item: BpmnElement) => item.escalationCode),
    ).toEqual(['CHECK', 'RETRY']);
    setBpmnEventReference(document, throwing.eventDefinitions[0], '');
    expect(throwing.eventDefinitions[0].escalationRef).toBeUndefined();
    expect(bpmnEventReferenceValue(document, start.eventDefinitions[0])).toBe(
      'CHECK',
    );
  });

  it('同类型选择不重置参数，错误事件强制中断且补偿边界保持非中断', () => {
    const { document, start } = fixture();
    start.isInterrupting = false;
    setBpmnEventType(start, 'bpmn:ErrorEventDefinition');
    expect(start.isInterrupting).toBe(true);
    setBpmnEventReference(
      document,
      start.eventDefinitions[0],
      'SOURCE_INVALID',
    );
    const before = JSON.stringify(start);
    setBpmnEventType(start, 'bpmn:ErrorEventDefinition');
    expect(JSON.stringify(start)).toBe(before);
    const boundary: BpmnElement = {
      $type: 'bpmn:BoundaryEvent',
      cancelActivity: false,
    };
    setBpmnEventType(boundary, 'bpmn:ErrorEventDefinition');
    expect(boundary.cancelActivity).toBe(true);
    setBpmnEventType(boundary, 'bpmn:CompensateEventDefinition');
    expect(boundary.cancelActivity).toBe(false);
  });

  it('事件子流程显示点线框和开始标记，升级捕获为空心而抛出为实心', () => {
    const { document, subprocess, start } = fixture();
    setBpmnEventSubprocess(document, subprocess, true);
    setBpmnEventType(start, 'bpmn:EscalationEventDefinition');
    start.isInterrupting = false;
    const metadata = nodeMetadata(subprocess);
    expect(metadata.attrs?.body?.strokeDasharray).toBe('2 3');
    expect(metadata.attrs?.start_body?.strokeDasharray).toBe('4 3');
    expect(metadata.attrs?.start_marker?.d).toBeTruthy();
    expect(metadata.attrs?.start_marker?.fill).toBe('none');
    expect(
      nodeMetadata({ ...start, $type: 'bpmn:EndEvent' }).attrs?.marker?.fill,
    ).not.toBe('none');
    expect(
      nodeMetadata({ ...subprocess, triggeredByEvent: false }).attrs?.body
        ?.strokeDasharray,
    ).toBeUndefined();
  });
});
