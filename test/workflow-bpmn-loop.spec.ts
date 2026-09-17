import { describe, expect, it } from 'vitest';

import { readBpmnExpression } from '#/views/workflow-engine/designer/bpmn-expression';
import { createBpmnLoop } from '#/views/workflow-engine/designer/bpmn-loop';

describe('标准循环配置', () => {
  it('每次创建独立条件对象，切换为不循环时清除旧配置', () => {
    const first = createBpmnLoop('bpmn:StandardLoopCharacteristics');
    const second = createBpmnLoop('bpmn:StandardLoopCharacteristics');
    if (!first || !second) throw new Error('应当创建标准循环');
    first.loopCondition.body = '{"value":false}';
    expect(second.loopCondition.body).toBe('{"value":true}');
    expect(second).toMatchObject({ testBefore: false, loopMaximum: 3 });
    expect(createBpmnLoop('none')).toBeUndefined();
    expect(
      createBpmnLoop('bpmn:MultiInstanceLoopCharacteristics'),
    ).toMatchObject({ isSequential: false, loopCardinality: { body: '3' } });
  });

  it.each([
    'oops',
    '{"op":"not"}',
    '{"op":"eq","left":3,"right":{}}',
    '{"op":"and","values":[]}',
    '[]',
    'null',
    '{"value":{}}',
  ])('保留不可视化的条件原文并拒绝直接渲染：%s', (body) => {
    expect(readBpmnExpression(body)).toBeUndefined();
  });

  it('支持嵌套有效条件，超深条件不递归到栈溢出', () => {
    const body =
      '{"op":"eq","left":{"path":"input.amount"},"right":{"value":3}}';
    expect(readBpmnExpression(body)).toEqual(JSON.parse(body));
    let tree: unknown = { value: true };
    for (let index = 0; index < 34; index++) tree = { op: 'not', value: tree };
    expect(readBpmnExpression(JSON.stringify(tree))).toBeUndefined();
  });
});
