import type {
  ValueBinding,
  WorkflowDefinition,
  WorkflowIssue,
  WorkflowScriptCall,
} from './index';

import type {
  DataSchema,
  PublishedReference,
} from '#/api/automation/definition';

import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export const bpmnNamespace = 'https://kwitsukasa.top/schema/workflow/bpmn/1';
export interface BpmnElement {
  $type: string;
  id?: string;
  name?: string;
  [property: string]: any;
}
export interface BpmnDefinition {
  format: 'bpmn20';
  model: BpmnElement;
  processRef?: null | { key: string; version: number };
}
export interface BpmnContract {
  processRef: null | { key: string; version: number };
  inputSchema: DataSchema;
  outputSchema: DataSchema;
  output: Record<string, ValueBinding>;
  formRef: null | PublishedReference;
  formMapping: Record<string, string>;
  timeoutMs: number;
}
export type BpmnStep =
  | {
      businessKey?: string;
      formRef: null | PublishedReference;
      input: Record<string, ValueBinding>;
      kind: 'human';
      writableFields: string[];
    }
  | {
      input: Record<string, ValueBinding>;
      kind: 'action';
      taskRef: PublishedReference;
    }
  | {
      input: Record<string, ValueBinding>;
      kind: 'business' | 'script';
      scripts: WorkflowScriptCall[];
      stepKey: string;
    }
  | {
      input: Record<string, ValueBinding>;
      kind: 'rule';
      ruleRef: PublishedReference;
    };
export type WorkflowDocument = BpmnDefinition | WorkflowDefinition;
export const workflowDocumentApi =
  createDefinitionClient<WorkflowDocument>('workflows');
export const bpmnWorkflowApi = {
  ...createDefinitionClient<BpmnDefinition>('workflows'),
  validate: (definition: BpmnDefinition) =>
    requestClient.post<{ issues: WorkflowIssue[]; valid: boolean }>(
      '/automation/workflows/validate',
      { definition },
    ),
  export: (definition: BpmnDefinition) =>
    requestClient.post<Blob>(
      '/automation/workflows/export',
      { definition },
      { responseType: 'blob', responseReturn: 'body' },
    ),
};

/**
 * 识别内部结构化 BPMN 定义，使历史版本可以保留独立的读取路径。
 * @param definition - 已保存的两代工作流定义。
 * @returns 当前定义是否使用标准结构化模型。
 */
export function isBpmnDefinition(
  definition: unknown,
): definition is BpmnDefinition {
  return (
    !!definition &&
    typeof definition === 'object' &&
    (definition as BpmnDefinition).format === 'bpmn20'
  );
}
