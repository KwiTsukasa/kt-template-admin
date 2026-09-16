import type { DataScalar, DataSchema } from '#/api/automation/definition';

import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export type FormControl =
  | 'DatePicker'
  | 'Input'
  | 'InputNumber'
  | 'RadioGroup'
  | 'Select'
  | 'Switch'
  | 'Textarea';
export type FormDefinition = {
  dataSchema: DataSchema;
  schemaVersion: 1;
  uiSchema: {
    columns: 1 | 2 | 3;
    fields: {
      component: FormControl;
      help: string;
      key: string;
      placeholder: string;
      requiredWhen?: { equals: DataScalar; field: string };
      span: number;
    }[];
  };
};
export const formApi = {
  ...createDefinitionClient<FormDefinition>('forms'),
  preview: (definition: FormDefinition, values: Record<string, unknown>) =>
    requestClient.post<{ values: Record<string, unknown> }>(
      '/automation/forms/preview',
      { definition, values },
    ),
};
export const emptyForm = (): FormDefinition => ({
  schemaVersion: 1,
  dataSchema: { fields: [] },
  uiSchema: { columns: 2, fields: [] },
});
