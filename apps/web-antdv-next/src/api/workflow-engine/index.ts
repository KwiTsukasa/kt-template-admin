import type {
  DataScalar,
  DataSchema,
  PublishedReference,
} from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';
import type { RuleScalar } from '#/api/rule-engine';

import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export type ValueBinding =
  | { field: string; nodeId: string; type: 'node' }
  | { field: string; type: 'input' }
  | { type: 'literal'; value: DataScalar };
export type WorkflowNode = { id: string; name: string } & (
  | {
      branches: { port: string; value: RuleScalar }[];
      facts: Record<string, ValueBinding>;
      ruleRef: PublishedReference;
      type: 'rule';
    }
  | { durationMs: number; type: 'wait' }
  | { forkId: string; type: 'join' }
  | {
      input: Record<string, ValueBinding>;
      taskRef: PublishedReference;
      type: 'task';
    }
  | { joinId: string; type: 'fork' }
  | { type: 'end' | 'start' }
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
  schemaVersion: 1;
  timeoutMs: number;
};
export type GraphLayout = {
  edges: Record<string, { vertices: { x: number; y: number }[] }>;
  nodes: Record<string, { x: number; y: number }>;
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
  error: null | string;
  nodeId: string;
  output: Record<string, unknown>;
  selectedPorts: string[];
  status: WorkflowNodeStatus;
  taskRunId: null | string;
  wakeAt: null | string;
};
export type WorkflowRun = {
  error: null | string;
  formValues: null | Record<string, unknown>;
  input: Record<string, unknown>;
  nodes: WorkflowNodeRun[];
  output: Record<string, unknown>;
  runId: string;
  status: WorkflowRunStatus;
  workflowId: string;
  workflowVersion: number;
};
export const workflowApi = {
  ...createDefinitionClient<WorkflowDefinition>('workflows'),
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
  start: (
    workflowRef: PublishedReference,
    values: Record<string, unknown>,
    executionKey: string,
  ) =>
    requestClient.post<{ runId: string }>('/automation/workflows/runs', {
      workflowRef,
      values,
      executionKey,
    }),
  run: (runId: string) =>
    requestClient.get<WorkflowRun>(`/automation/workflows/runs/${runId}`),
  cancel: (runId: string) =>
    requestClient.post<WorkflowRun>(
      `/automation/workflows/runs/${runId}/cancel`,
      {},
    ),
  launch: (id: string, version: number) =>
    requestClient.get<{
      definition: WorkflowDefinition;
      form: FormDefinition | null;
    }>(`/automation/workflows/${id}/versions/${version}/launch`),
  runSchema: (runId: string) =>
    requestClient.get<{
      definition: WorkflowDefinition;
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
    edges: [
      {
        id: 'initial',
        source: 'start',
        target: 'end',
        sourcePort: 'out',
        targetPort: 'in',
      },
    ],
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
