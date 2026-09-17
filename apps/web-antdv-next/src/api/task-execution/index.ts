import type {
  DataSchema,
  PublishedReference,
} from '#/api/automation/definition';

import { cloneDeep } from '@vben/utils';

import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';
import { AUTOMATION_PATH } from '#/constants/automation/resources';
import { RUN_STATUS } from '#/constants/automation/run-status';

export type TaskCapability = {
  available: boolean;
  id: string;
  idempotent: boolean;
  inputSchema: DataSchema;
  key: string;
  name: string;
  outputSchema: DataSchema;
  ownerKind: string;
  timeoutMs: number;
  version: number;
};
export const getTaskCapabilities = () =>
  requestClient.get<TaskCapability[]>(`${AUTOMATION_PATH.tasks}/capabilities`);
export const getTaskCapability = (reference: PublishedReference) =>
  requestClient.get<TaskCapability>(
    `${AUTOMATION_PATH.tasks}/${reference.id}/versions/${reference.version}/capability`,
  );

export type TaskHandler = Omit<TaskCapability, 'id'>;
export type AtomicTaskDefinition = {
  contract: {
    idempotent: boolean;
    inputSchema: DataSchema;
    outputSchema: DataSchema;
    ownerKind: string;
  };
  handler: { key: string; version: number };
  maxAttempts: number;
  retryBackoffMs: number;
  schemaVersion: 1;
  timeoutMs: number;
};
export type AtomicTaskRun = {
  attempts?: {
    attemptNo: number;
    errorMessage: null | string;
    finishedAt: null | string;
    handlerKey: string;
    handlerVersion: number;
    id: string;
    runtimeIdentity: string;
    startedAt: string;
    status: AtomicTaskRun['status'];
  }[];
  error: null | string;
  output: Record<string, unknown>;
  requiresReview: boolean;
  review?: null | {
    reason: string;
    resolution: TaskReviewResolution;
    reviewedAt: string;
    reviewedBy: string;
  };
  runId: string;
  status:
    | typeof RUN_STATUS.cancelled
    | typeof RUN_STATUS.failed
    | typeof RUN_STATUS.pending
    | typeof RUN_STATUS.running
    | typeof RUN_STATUS.succeeded;
  taskId: string;
  taskVersion: number;
};
export type TaskReviewResolution =
  | 'compensated'
  | 'effect-confirmed'
  | 'no-effect';
export const taskApi = {
  ...createDefinitionClient<AtomicTaskDefinition>('tasks'),
  handlers: () =>
    requestClient.get<TaskHandler[]>(`${AUTOMATION_PATH.tasks}/handlers`),
  run: (id: string) =>
    requestClient.get<AtomicTaskRun>(`${AUTOMATION_PATH.tasks}/runs/${id}`),
  review: (
    id: string,
    body: { reason: string; resolution: TaskReviewResolution },
  ) =>
    requestClient.post<AtomicTaskRun>(
      `${AUTOMATION_PATH.tasks}/runs/${id}/review`,
      body,
    ),
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
      inputSchema: cloneDeep(handler.inputSchema),
      outputSchema: cloneDeep(handler.outputSchema),
      idempotent: handler.idempotent,
      ownerKind: handler.ownerKind,
    },
    timeoutMs: handler.timeoutMs,
    maxAttempts: 1,
    retryBackoffMs: 1000,
  };
}
