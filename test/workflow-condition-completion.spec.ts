import { expect, it } from 'vitest';

import { BPMN_EXPRESSION_LANGUAGE } from '#/constants/automation/workflow';
import { readBpmnExpression } from '#/views/workflow-engine/designer/bpmn-expression';
import { bpmnPath } from '#/views/workflow-engine/designer/bpmn-expression';
import {
  readBpmnCountBinding,
  writeBpmnCountBinding,
} from '#/views/workflow-engine/designer/bpmn-count-binding';
import { hasBpmnCondition } from '#/views/workflow-engine/designer/bpmn-model';

const flow = (expression: unknown, language = BPMN_EXPRESSION_LANGUAGE) => ({
  $type: 'bpmn:SequenceFlow',
  conditionExpression: {
    $type: 'bpmn:FormalExpression',
    language,
    body: JSON.stringify(expression),
  },
});

it('未填写字段、非布尔常量、未知语言和非法路径保持未配置状态', () => {
  expect(readBpmnExpression('{"path":""}')).toEqual({ path: '' });
  for (const expression of [
    { path: '' },
    { path: 'input.__proto__.value' },
    { value: 3 },
    { op: 'sum', values: [{ value: 1 }] },
    { op: 'eq', left: { path: '' }, right: { value: true } },
  ])
    expect(hasBpmnCondition(flow(expression))).toBe(false);
  expect(hasBpmnCondition(flow({ value: true }, 'javascript'))).toBe(false);
});

it('完整条件复用编辑器的深度和操作数校验，求和作为比较操作数可以被识别', () => {
  expect(
    hasBpmnCondition(
      flow({
        op: 'gt',
        left: { op: 'sum', values: [{ path: 'input.count' }, { value: 1 }] },
        right: { value: 2 },
      }),
    ),
  ).toBe(true);
  expect(hasBpmnCondition(flow({ value: false }))).toBe(true);
  let expression: unknown = { value: true };
  for (let depth = 0; depth < 17; depth++)
    expression = { op: 'not', value: expression };
  expect(hasBpmnCondition(flow(expression))).toBe(false);
});

it('点号和 Unicode 节点在条件、数量绑定中共用无歧义编码，空白草稿仍可继续编辑', () => {
  const binding = {
    type: 'node' as const,
    nodeId: '来源.检查',
    field: 'count',
  };
  const body = writeBpmnCountBinding(binding);
  expect(readBpmnCountBinding(body ?? '')).toEqual(binding);
  expect(JSON.parse(body ?? '').path).toBe('/outputs/来源.检查/count');
  expect(
    hasBpmnCondition(
      flow({
        op: 'gt',
        left: { path: bpmnPath(['outputs', binding.nodeId, 'count']) },
        right: { value: 0 },
      }),
    ),
  ).toBe(true);
  expect(
    readBpmnCountBinding(
      writeBpmnCountBinding({ type: 'input', field: '' }) ?? '',
    ),
  ).toEqual({ type: 'input', field: '' });
});
