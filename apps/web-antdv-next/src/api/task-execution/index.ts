import type {
  DataSchema,
  PublishedReference,
} from '#/api/automation/definition';
import { requestClient } from '#/api/request';
import { createDefinitionClient } from '#/api/automation/definition';

export type TaskCapability = {
  id: string;
  version: number;
  name: string;
  key: string;
  ownerKind: string;
  available: boolean;
  idempotent: boolean;
  timeoutMs: number;
  inputSchema: DataSchema;
  outputSchema: DataSchema;
};
export const getTaskCapabilities = () =>
  requestClient.get<TaskCapability[]>('/automation/tasks/capabilities');
export const getTaskCapability = (reference: PublishedReference) =>
  requestClient.get<TaskCapability>(
    `/automation/tasks/${reference.id}/versions/${reference.version}/capability`,
  );

export type TaskHandler = Omit<TaskCapability, 'id'>;
export type AtomicTaskDefinition = {
  schemaVersion: 1;
  handler: { key: string; version: number };
  contract: {
    inputSchema: DataSchema;
    outputSchema: DataSchema;
    idempotent: boolean;
    ownerKind: string;
  };
  timeoutMs: number;
  maxAttempts: number;
  retryBackoffMs: number;
};
export type AtomicTaskRun = {
  runId: string;
  taskId: string;
  taskVersion: number;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  output: Record<string, unknown>;
  error: string | null;
  requiresReview: boolean;
  attempts?: {
    id: string;
    attemptNo: number;
    status: AtomicTaskRun['status'];
    runtimeIdentity: string;
    handlerKey: string;
    handlerVersion: number;
    errorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
  }[];
  review?: {
    reviewedBy: string;
    resolution: TaskReviewResolution;
    reason: string;
    reviewedAt: string;
  } | null;
};
export type TaskReviewResolution = 'effect-confirmed' | 'no-effect' | 'compensated';
export const taskApi = {
  ...createDefinitionClient<AtomicTaskDefinition>('tasks'),
  handlers: () =>
    requestClient.get<TaskHandler[]>('/automation/tasks/handlers'),
  start: (body: {
    taskRef: PublishedReference;
    executionKey: string;
    input: Record<string, unknown>;
    deadlineAt: number;
  }) => requestClient.post<AtomicTaskRun>('/automation/tasks/runs', body),
  run: (id: string) =>
    requestClient.get<AtomicTaskRun>(`/automation/tasks/runs/${id}`),
  cancel: (id: string) =>
    requestClient.post<AtomicTaskRun>(`/automation/tasks/runs/${id}/cancel`),
  review: (id: string, body: { resolution: TaskReviewResolution; reason: string }) =>
    requestClient.post<AtomicTaskRun>(`/automation/tasks/runs/${id}/review`, body),
};

/**
 * 从实际注册的能力冻结任务数据契约，触发和流程配置由各自资源维护。
 * @param handler - 当前可用的固定处理器版本。
 * @returns 仅包含执行约束的初始任务草稿。
 */
export function taskFromHandler(handler: TaskHandler): AtomicTaskDefinition {
  return {
    schemaVersion: 1,
    handler: { key: handler.key, version: handler.version },
    contract: {
      inputSchema: JSON.parse(JSON.stringify(handler.inputSchema)),
      outputSchema: JSON.parse(JSON.stringify(handler.outputSchema)),
      idempotent: handler.idempotent,
      ownerKind: handler.ownerKind,
    },
    timeoutMs: handler.timeoutMs,
    maxAttempts: 1,
    retryBackoffMs: 1000,
  };
}
