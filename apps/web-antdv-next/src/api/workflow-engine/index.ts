import type { BpmnDefinition } from './bpmn';

import type { DataScalar, DataSchema } from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';

import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';
import { RUN_STATUS } from '#/constants/automation/run-status';
import {
  WORKFLOW_PATH,
  WORKFLOW_RESOURCE,
  WORKFLOW_SCRIPT_PROTOCOL,
} from '#/constants/automation/workflow';

export type ValueReference =
  | { field: string; nodeId: string; type: 'node' }
  | { field: string; type: 'input' };
export type ValueBinding =
  | ValueReference
  | { sources: ValueReference[]; type: 'first' }
  | { type: 'iteration' }
  | { type: 'literal'; value: DataScalar };
export type WorkflowIssue = {
  code: string;
  edgeId?: string;
  fieldPath?: string;
  message: string;
  nodeId?: string;
};
export type WorkflowRunStatus =
  | typeof RUN_STATUS.cancelled
  | typeof RUN_STATUS.failed
  | typeof RUN_STATUS.pending
  | typeof RUN_STATUS.running
  | typeof RUN_STATUS.succeeded
  | typeof RUN_STATUS.waiting;
export type WorkflowNodeStatus =
  | typeof RUN_STATUS.cancelled
  | typeof RUN_STATUS.failed
  | typeof RUN_STATUS.pending
  | typeof RUN_STATUS.skipped
  | typeof RUN_STATUS.succeeded
  | typeof RUN_STATUS.waiting;
export type WorkflowNodeRun = {
  businessReceipt?: null | string;
  error: null | string;
  loopIteration: number;
  loopPath: Record<string, number>;
  nodeId: string;
  output: Record<string, unknown>;
  scriptAttempts: WorkflowScriptAttempt[];
  selectedPorts: string[];
  status: WorkflowNodeStatus;
  taskRunId: null | string;
  visit: number;
  wakeAt: null | string;
};
export type WorkflowScriptAttempt = {
  attempt: number;
  executionId: string;
  exitCode: null | number;
  finishedAt: null | string;
  index: number;
  output: Record<string, unknown>;
  retryable?: boolean;
  script: { key: string; sha256: string; version: number };
  startedAt: string;
  status:
    | typeof RUN_STATUS.cancelled
    | typeof RUN_STATUS.failed
    | typeof RUN_STATUS.running
    | typeof RUN_STATUS.succeeded
    | typeof RUN_STATUS.unconfirmed;
};
export type WorkflowNodeVisit = Pick<
  WorkflowNodeRun,
  | 'businessReceipt'
  | 'error'
  | 'loopPath'
  | 'nodeId'
  | 'output'
  | 'scriptAttempts'
  | 'status'
  | 'taskRunId'
  | 'visit'
> & {
  finishedAt: null | string;
  startedAt: null | string;
};
export type WorkflowRun = {
  activeActivities?: {
    executionId: string;
    name: string;
    nodeId: string;
    type: string;
  }[];
  activities?: {
    error: null | string;
    executionId: string;
    nodeId: string;
    output: Record<string, unknown>;
    status: WorkflowNodeStatus;
    visit: number;
  }[];
  business?: null | {
    actorId: string;
    bindingRevision: number;
    processRef: { key: string; version: number };
    revision: number;
    scopeId: string;
    subjectId: string;
  };
  error: null | string;
  formValues: null | Record<string, unknown>;
  input: Record<string, unknown>;
  nodes: WorkflowNodeRun[];
  output: Record<string, unknown>;
  runId: string;
  status: WorkflowRunStatus;
  transitions?: {
    elementId: string;
    event: string;
    executionId: string;
    type: string;
  }[];
  workflowId: string;
  workflowVersion: number;
};
export type WorkflowProcessCapability = {
  humanSteps?: { key: string; name: string; outputSchema: DataSchema }[];
  inputSchema: DataSchema;
  key: string;
  launchSchema?: DataSchema;
  name: string;
  outputSchema: DataSchema;
  steps: {
    description: string;
    inputSchema: DataSchema;
    key: string;
    name: string;
    outputSchema: DataSchema;
  }[];
  version: number;
};
export type WorkflowScriptDeclaration = {
  defaults: Record<string, DataScalar>;
  description: string;
  idempotent: boolean;
  key: string;
  maxTimeoutMs: number;
  name: string;
  paramsSchema: DataSchema;
  processKey: string;
  protocol: typeof WORKFLOW_SCRIPT_PROTOCOL;
  resultSchema: DataSchema;
  runtime: 'bash' | 'node' | 'python';
  sha256: string;
  stepKey: string;
};
export type WorkflowScriptCapability = WorkflowScriptDeclaration & {
  target: 'local' | 'nas';
  version: number;
};
export type WorkflowScriptCall = {
  key: string;
  maxAttempts: number;
  params: Record<string, ValueBinding>;
  retryBackoffMs: number;
  sha256: string;
  timeoutMs: number;
  version: number;
};
export const workflowApi = {
  ...createDefinitionClient<BpmnDefinition>(WORKFLOW_RESOURCE),
  processes: () =>
    requestClient.get<WorkflowProcessCapability[]>(
      `${WORKFLOW_PATH}/processes`,
    ),
  scripts: () =>
    requestClient.get<WorkflowScriptCapability[]>(`${WORKFLOW_PATH}/scripts`),
  inspectScript: (filename: string, source: string) =>
    requestClient.post<WorkflowScriptDeclaration>(
      `${WORKFLOW_PATH}/scripts/inspect`,
      { filename, source },
    ),
  uploadScript: (filename: string, source: string, target: 'local' | 'nas') =>
    requestClient.post<WorkflowScriptCapability>(`${WORKFLOW_PATH}/scripts`, {
      filename,
      source,
      target,
    }),
  validate: (definition: BpmnDefinition) =>
    requestClient.post<{
      issues: WorkflowIssue[];
      order: string[];
      valid: boolean;
    }>(`${WORKFLOW_PATH}/validate`, { definition }),
  export: (definition: BpmnDefinition) =>
    requestClient.post<Blob>(
      `${WORKFLOW_PATH}/export`,
      { definition },
      { responseType: 'blob', responseReturn: 'body' },
    ),
  run: (runId: string) =>
    requestClient.get<WorkflowRun>(`${WORKFLOW_PATH}/runs/${runId}`),
  nodeVisits: (runId: string, nodeId: string, beforeVisit?: number) =>
    requestClient.get<{
      items: WorkflowNodeVisit[];
      nextBeforeVisit: null | number;
    }>(
      `${WORKFLOW_PATH}/runs/${runId}/nodes/${encodeURIComponent(nodeId)}/visits`,
      { params: { beforeVisit } },
    ),
  cancel: (runId: string) =>
    requestClient.post<WorkflowRun>(
      `${WORKFLOW_PATH}/runs/${runId}/cancel`,
      {},
    ),
  runSchema: (runId: string) =>
    requestClient.get<{
      definition: BpmnDefinition;
      form: FormDefinition | null;
    }>(`${WORKFLOW_PATH}/runs/${runId}/schema`),
};
