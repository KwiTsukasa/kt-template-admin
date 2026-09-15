import type { DataSchema } from '#/api/automation/definition';

import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export type RuleScalar = boolean | null | number | string;
export type RuleCondition =
  | {
      operator:
        | 'contains'
        | 'eq'
        | 'exists'
        | 'gt'
        | 'gte'
        | 'in'
        | 'lt'
        | 'lte'
        | 'ne';
      path: string;
      type: 'compare';
      value: RuleScalar | RuleScalar[];
    }
  | { rule: RuleCondition; type: 'not' }
  | { rules: RuleCondition[]; type: 'all' | 'any' };
export type RuleDefinition = {
  factSchema: DataSchema;
  schemaVersion: 1;
  testCases: {
    expected: RuleScalar;
    facts: Record<string, unknown>;
    name: string;
  }[];
} & (
  | { condition: RuleCondition; mode: 'condition' }
  | {
      defaultResult: RuleScalar;
      mode: 'decision-table';
      rows: { condition: RuleCondition; id: string; result: RuleScalar }[];
    }
);
export type RuleConditionTrace = {
  field?: string;
  location: string;
  matched: boolean;
  operator?: string;
  type: RuleCondition['type'];
};
export type RulePreview = {
  cases: {
    actual: RuleScalar;
    expected: RuleScalar;
    name: string;
    passed: boolean;
  }[];
  matchedRowId: null | string;
  result: RuleScalar;
  trace: RuleConditionTrace[];
};
export const ruleApi = {
  ...createDefinitionClient<RuleDefinition>('rules'),
  preview: (definition: RuleDefinition, facts: Record<string, unknown>) =>
    requestClient.post<RulePreview>('/automation/rules/preview', {
      definition,
      facts,
    }),
};
export const emptyRule = (): RuleDefinition => ({
  schemaVersion: 1,
  mode: 'condition',
  factSchema: {
    fields: [{ key: 'amount', label: '金额', type: 'number', required: true }],
  },
  condition: { type: 'compare', path: 'amount', operator: 'gte', value: 0 },
  testCases: [],
});
