import type { DataSchema } from '#/api/automation/definition';
import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export type RuleScalar = boolean | null | number | string;
export type RuleCondition =
  | { type: 'all' | 'any'; rules: RuleCondition[] }
  | { type: 'not'; rule: RuleCondition }
  | { type: 'compare'; path: string; operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'exists'; value: RuleScalar | RuleScalar[] };
export type RuleDefinition = {
  schemaVersion: 1;
  factSchema: DataSchema;
  testCases: { name: string; facts: Record<string, unknown>; expected: RuleScalar }[];
} & (
  | { mode: 'condition'; condition: RuleCondition }
  | { mode: 'decision-table'; rows: { id: string; condition: RuleCondition; result: RuleScalar }[]; defaultResult: RuleScalar }
);
export type RuleConditionTrace = { location: string; type: RuleCondition['type']; matched: boolean; field?: string; operator?: string };
export type RulePreview = { result: RuleScalar; matchedRowId: string | null; trace: RuleConditionTrace[]; cases: { name: string; expected: RuleScalar; actual: RuleScalar; passed: boolean }[] };
export const ruleApi = {
  ...createDefinitionClient<RuleDefinition>('rules'),
  preview: (definition: RuleDefinition, facts: Record<string, unknown>) => requestClient.post<RulePreview>('/automation/rules/preview', { definition, facts }),
};
export const emptyRule = (): RuleDefinition => ({ schemaVersion: 1, mode: 'condition', factSchema: { fields: [{ key: 'amount', label: '金额', type: 'number', required: true }] }, condition: { type: 'compare', path: 'amount', operator: 'gte', value: 0 }, testCases: [] });
