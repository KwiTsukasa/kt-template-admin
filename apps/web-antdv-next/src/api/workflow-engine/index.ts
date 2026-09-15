import type {
  DataScalar,
  DataSchema,
  PublishedReference,
} from '#/api/automation/definition';
import type { RuleScalar } from '#/api/rule-engine';
import type { FormDefinition } from '#/api/form-definition';
import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export type ValueBinding =
  | { type: 'literal'; value: DataScalar }
  | { type: 'input'; field: string }
  | { type: 'node'; nodeId: string; field: string };
export type WorkflowNode = { id: string; name: string } & (
  | { type: 'start' | 'end' }
  | {
      type: 'task';
      taskRef: PublishedReference;
      input: Record<string, ValueBinding>;
    }
  | {
      type: 'rule';
      ruleRef: PublishedReference;
      facts: Record<string, ValueBinding>;
      branches: { port: string; value: RuleScalar }[];
    }
  | { type: 'fork'; joinId: string }
  | { type: 'join'; forkId: string }
  | { type: 'wait'; durationMs: number }
);
export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourcePort: string;
  targetPort: string;
};
export type WorkflowGraph = {
  schemaVersion: 1;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  inputSchema: DataSchema;
  outputSchema: DataSchema;
  output: Record<string, ValueBinding>;
  formRef: PublishedReference | null;
  formMapping: Record<string, string>;
  timeoutMs: number;
};
export type GraphLayout = {
  schemaVersion: 1;
  nodes: Record<string, { x: number; y: number }>;
  edges: Record<string, { vertices: { x: number; y: number }[] }>;
  viewport: { x: number; y: number; zoom: number };
};
export type WorkflowDefinition = { graph: WorkflowGraph; layout: GraphLayout };
export type WorkflowIssue = {
  nodeId?: string;
  edgeId?: string;
  fieldPath?: string;
  code: string;
  message: string;
};
export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
export type WorkflowNodeStatus =
  | 'pending'
  | 'waiting'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'cancelled';
export type WorkflowNodeRun = {
  nodeId: string;
  status: WorkflowNodeStatus;
  taskRunId: string | null;
  output: Record<string, unknown>;
  selectedPorts: string[];
  wakeAt: string | null;
  error: string | null;
};
export type WorkflowRun = {
  runId: string;
  workflowId: string;
  workflowVersion: number;
  status: WorkflowRunStatus;
  input: Record<string, unknown>;
  formValues: Record<string, unknown> | null;
  output: Record<string, unknown>;
  error: string | null;
  nodes: WorkflowNodeRun[];
};
export const workflowApi = {
  ...createDefinitionClient<WorkflowDefinition>('workflows'),
  validate: (definition: WorkflowDefinition) =>
    requestClient.post<{
      valid: boolean;
      issues: WorkflowIssue[];
      order: string[];
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
    timeoutMs: 300000,
  },
  layout: {
    schemaVersion: 1,
    nodes: { start: { x: 80, y: 160 }, end: { x: 420, y: 160 } },
    edges: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  },
});
