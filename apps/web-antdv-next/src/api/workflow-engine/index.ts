import type { WorkflowDocument } from './bpmn';

import type {
  DataScalar,
  DataSchema,
  PublishedReference,
} from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';
import type { RuleScalar } from '#/api/rule-engine';

import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export type ValueReference =
  | { field: string; nodeId: string; type: 'node' }
  | { field: string; type: 'input' };
export type ValueBinding =
  | ValueReference
  | { sources: ValueReference[]; type: 'first' }
  | { type: 'iteration' }
  | { type: 'literal'; value: DataScalar };
export type WorkflowNode = { id: string; name: string } & (
  | {
      branches: { port: string; value: RuleScalar }[];
      facts: Record<string, ValueBinding>;
      ruleRef: PublishedReference;
      type: 'rule';
    }
  | {
      condition: null | {
        continueOn: boolean;
        facts: Record<string, ValueBinding>;
        ruleRef: PublishedReference;
      };
      maxIterations: number;
      type: 'loop';
    }
  | { durationMs: number; type: 'wait' }
  | { forkId: string; type: 'join' }
  | {
      input: Record<string, ValueBinding>;
      scripts: WorkflowScriptCall[];
      stepKey: string;
      type: 'business';
    }
  | {
      input: Record<string, ValueBinding>;
      taskRef: PublishedReference;
      type: 'task';
    }
  | { joinId: string; type: 'fork' }
  | { outcome?: 'cancelled' | 'failed' | 'succeeded'; type: 'end' }
  | { type: 'start' }
);
export type WorkflowEdge = {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
};
export type WorkflowGraph = {
  edges: WorkflowEdge[];
  formMapping: Record<string, string>;
  formRef: null | PublishedReference;
  inputSchema: DataSchema;
  nodes: WorkflowNode[];
  output: Record<string, ValueBinding>;
  outputSchema: DataSchema;
  processRef?: null | { key: string; version: number };
  schemaVersion: 1;
  timeoutMs: number;
};
export type WorkflowPortSide = 'bottom' | 'left' | 'right' | 'top';
export type WorkflowNodeLayout = {
  height?: number;
  inputSide?: WorkflowPortSide;
  outputSide?: WorkflowPortSide;
  shape?: 'capsule' | 'diamond' | 'rectangle' | 'rounded';
  width?: number;
  x: number;
  y: number;
};
export type GraphLayout = {
  direction?: 'horizontal' | 'vertical';
  edges: Record<string, { vertices: { x: number; y: number }[] }>;
  nodes: Record<string, WorkflowNodeLayout>;
  schemaVersion: 1;
  viewport: { x: number; y: number; zoom: number };
};
export type WorkflowDefinition = { graph: WorkflowGraph; layout: GraphLayout };
export type WorkflowIssue = {
  code: string;
  edgeId?: string;
  fieldPath?: string;
  message: string;
  nodeId?: string;
};
export type WorkflowRunStatus =
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'waiting';
export type WorkflowNodeStatus =
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'skipped'
  | 'succeeded'
  | 'waiting';
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
  status: 'cancelled' | 'failed' | 'running' | 'succeeded' | 'unconfirmed';
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
  protocol: 'kt.workflow.script.v1';
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
  ...createDefinitionClient<WorkflowDefinition>('workflows'),
  processes: () =>
    requestClient.get<WorkflowProcessCapability[]>(
      '/automation/workflows/processes',
    ),
  scripts: () =>
    requestClient.get<WorkflowScriptCapability[]>(
      '/automation/workflows/scripts',
    ),
  inspectScript: (filename: string, source: string) =>
    requestClient.post<WorkflowScriptDeclaration>(
      '/automation/workflows/scripts/inspect',
      { filename, source },
    ),
  uploadScript: (filename: string, source: string, target: 'local' | 'nas') =>
    requestClient.post<WorkflowScriptCapability>(
      '/automation/workflows/scripts',
      { filename, source, target },
    ),
  validate: (definition: WorkflowDefinition) =>
    requestClient.post<{
      issues: WorkflowIssue[];
      order: string[];
      valid: boolean;
    }>('/automation/workflows/validate', { definition }),
  version: (id: string, version: number) =>
    requestClient.get<WorkflowDefinition>(
      `/automation/workflows/${id}/versions/${version}`,
    ),
  run: (runId: string) =>
    requestClient.get<WorkflowRun>(`/automation/workflows/runs/${runId}`),
  nodeVisits: (runId: string, nodeId: string, beforeVisit?: number) =>
    requestClient.get<{
      items: WorkflowNodeVisit[];
      nextBeforeVisit: null | number;
    }>(
      `/automation/workflows/runs/${runId}/nodes/${encodeURIComponent(nodeId)}/visits`,
      { params: { beforeVisit } },
    ),
  cancel: (runId: string) =>
    requestClient.post<WorkflowRun>(
      `/automation/workflows/runs/${runId}/cancel`,
      {},
    ),
  runSchema: (runId: string) =>
    requestClient.get<{
      definition: WorkflowDocument;
      form: FormDefinition | null;
    }>(`/automation/workflows/runs/${runId}/schema`),
};
export const emptyWorkflow = (): WorkflowDefinition => ({
  graph: {
    schemaVersion: 1,
    nodes: [
      { id: 'start', name: '开始', type: 'start' },
      { id: 'end', name: '结束', type: 'end' },
    ],
    edges: [],
    inputSchema: { fields: [] },
    outputSchema: { fields: [] },
    output: {},
    formRef: null,
    formMapping: {},
    timeoutMs: 300_000,
  },
  layout: {
    schemaVersion: 1,
    nodes: { start: { x: 80, y: 160 }, end: { x: 420, y: 160 } },
    edges: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  },
});
