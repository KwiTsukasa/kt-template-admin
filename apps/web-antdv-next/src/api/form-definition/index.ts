import type { DataSchema } from '#/api/automation/definition';
import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export type FormControl = 'Input' | 'Textarea' | 'InputNumber' | 'Switch' | 'Select' | 'RadioGroup' | 'DatePicker';
export type FormDefinition = {
  schemaVersion: 1;
  dataSchema: DataSchema;
  uiSchema: { columns: 1 | 2 | 3; fields: { key: string; component: FormControl; span: number; placeholder: string; help: string }[] };
};
export const formApi = {
  ...createDefinitionClient<FormDefinition>('forms'),
  preview: (definition: FormDefinition, values: Record<string, unknown>) => requestClient.post<{ values: Record<string, unknown> }>('/automation/forms/preview', { definition, values }),
};
export const emptyForm = (): FormDefinition => ({ schemaVersion: 1, dataSchema: { fields: [] }, uiSchema: { columns: 2, fields: [] } });
