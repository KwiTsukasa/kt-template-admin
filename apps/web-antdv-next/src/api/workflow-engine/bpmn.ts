import type { ValueBinding, WorkflowScriptCall } from './index';

import type {
  DataSchema,
  PublishedReference,
} from '#/api/automation/definition';

import { BPMN_FORMAT } from '#/constants/automation/workflow';

export interface BpmnElement {
  $type: string;
  id?: string;
  name?: string;
  [property: string]: any;
}
export interface BpmnDefinition {
  format: typeof BPMN_FORMAT;
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
