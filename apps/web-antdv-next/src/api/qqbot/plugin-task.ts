import type { Recordable } from '@vben/types';

import type { QqbotApi } from './index';

import { requestClient } from '#/api/request';

export namespace QqbotPluginTaskApi {
  export type RuntimeStatus =
    | 'disabled'
    | 'failed'
    | 'idle'
    | 'running'
    | 'scheduled';
  export type RunStatus = 'failed' | 'running' | 'skipped' | 'success';
  export type TriggerType = 'bootstrap' | 'manual' | 'schedule';

  export interface Task {
    cronExpression: string;
    defaultCron: string;
    description?: null | string;
    enabled: boolean;
    id: string;
    installationId: string;
    lastDurationMs?: null | number;
    lastError?: null | string;
    lastRunAt?: null | string;
    lastStatus?: null | RunStatus;
    nextRunAt?: null | string;
    pluginId: string;
    pluginKey?: string;
    pluginName?: string;
    runtimeStatus: RuntimeStatus;
    taskKey: string;
    taskName: string;
  }

  export interface TaskRun {
    createTime?: string;
    durationMs?: null | number;
    errorMessage?: null | string;
    finishedAt?: null | string;
    id: string;
    jobId?: null | string;
    safeSummary?: null | Recordable<any>;
    startedAt?: null | string;
    status: RunStatus;
    taskId: string;
    taskKey: string;
    triggerType: TriggerType;
  }

  export interface TaskQuery extends Recordable<any> {
    enabled?: boolean;
    pageNo?: number;
    pageSize?: number;
    pluginId?: string;
    pluginKey?: string;
    status?: RuntimeStatus;
    taskKey?: string;
  }

  export interface TaskRunQuery extends Recordable<any> {
    pageNo?: number;
    pageSize?: number;
    status?: RunStatus;
    triggerType?: TriggerType;
  }
}

export function getQqbotPluginTaskPage(params: QqbotPluginTaskApi.TaskQuery) {
  return requestClient.get<QqbotApi.PageResult<QqbotPluginTaskApi.Task>>(
    '/qqbot/plugin-platform/tasks/page',
    { params },
  );
}

export function enableQqbotPluginTask(id: string) {
  return requestClient.post<QqbotPluginTaskApi.Task>(
    `/qqbot/plugin-platform/tasks/${id}/enable`,
  );
}

export function disableQqbotPluginTask(id: string) {
  return requestClient.post<QqbotPluginTaskApi.Task>(
    `/qqbot/plugin-platform/tasks/${id}/disable`,
  );
}

export function updateQqbotPluginTaskCron(id: string, cronExpression: string) {
  return requestClient.post<QqbotPluginTaskApi.Task>(
    `/qqbot/plugin-platform/tasks/${id}/cron`,
    { cronExpression },
  );
}

export function runQqbotPluginTaskOnce(
  id: string,
  input: Recordable<any> = {},
) {
  return requestClient.post<{ jobId: string; taskId: string }>(
    `/qqbot/plugin-platform/tasks/${id}/run`,
    { input },
  );
}

export function getQqbotPluginTaskRunPage(
  id: string,
  params: QqbotPluginTaskApi.TaskRunQuery,
) {
  return requestClient.get<QqbotApi.PageResult<QqbotPluginTaskApi.TaskRun>>(
    `/qqbot/plugin-platform/tasks/${id}/runs`,
    { params },
  );
}
