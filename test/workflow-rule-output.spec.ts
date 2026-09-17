import type { RuleDefinition, RuleScalar } from '#/api/rule-engine';

import { expect, it } from 'vitest';

import { ruleOutputSchema } from '#/views/rule-engine/rule-output';

it.each([false, 12, 'accepted', null])('设计器按决策表固定结果 %p 展示可绑定类型', (value: RuleScalar) => {
  const definition: RuleDefinition = { schemaVersion: 1, factSchema: { fields: [] }, testCases: [], mode: 'decision-table', rows: [], defaultResult: value };
  const schema = ruleOutputSchema(definition);
  if (value === null) expect(schema.fields).toEqual([]);
  else expect(schema.fields[0]).toEqual({ key: 'result', label: '规则结果', type: typeof value, required: true });
});
