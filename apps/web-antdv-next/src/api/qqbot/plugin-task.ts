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

/**
 * 根据插件、任务键、运行状态和分页条件读取定时任务。
 *
 * @param params - 插件、任务键、启用状态、运行状态和分页条件。
 * @returns 包含任务调度、上次与下次执行状态及总数的分页结果。
 */
export function getQqbotPluginTaskPage(params: QqbotPluginTaskApi.TaskQuery) {
  return requestClient.get<QqbotApi.PageResult<QqbotPluginTaskApi.Task>>(
    '/qqbot/plugin-platform/tasks/page',
    { params },
  );
}

/**
 * 启用指定插件任务，并返回其最新调度与运行状态。
 *
 * @param id - 需要恢复调度的插件任务标识。
 * @returns 启用后的完整任务记录，包含重新计算的运行态与下次执行时间。
 */
export function enableQqbotPluginTask(id: string) {
  return requestClient.post<QqbotPluginTaskApi.Task>(
    `/qqbot/plugin-platform/tasks/${id}/enable`,
  );
}

/**
 * 停用指定插件任务，并返回其最新调度与运行状态。
 *
 * @param id - 需要停止调度的插件任务标识。
 * @returns 停用后的完整任务记录，包含 disabled 运行态。
 */
export function disableQqbotPluginTask(id: string) {
  return requestClient.post<QqbotPluginTaskApi.Task>(
    `/qqbot/plugin-platform/tasks/${id}/disable`,
  );
}

/**
 * 替换指定插件任务的 cron 表达式，并返回重新计算后的调度时间。
 *
 * @param id - 需要更新调度表达式的插件任务标识。
 * @param cronExpression - 待保存的标准 cron 表达式。
 * @returns 保存新 cron 后的完整任务记录及重新计算的下次执行时间。
 */
export function updateQqbotPluginTaskCron(id: string, cronExpression: string) {
  return requestClient.post<QqbotPluginTaskApi.Task>(
    `/qqbot/plugin-platform/tasks/${id}/cron`,
    { cronExpression },
  );
}

/**
 * 携带可选输入立即排队执行一次插件任务，并返回任务与作业标识。
 *
 * @param id - 需要立即触发一次手动运行的插件任务标识。
 * @param input - 传给插件任务的可选业务输入；省略时发送空对象。
 * @returns 进入队列的插件任务标识和作业标识。
 */
export function runQqbotPluginTaskOnce(
  id: string,
  input: Recordable<any> = {},
) {
  return requestClient.post<{ jobId: string; taskId: string }>(
    `/qqbot/plugin-platform/tasks/${id}/run`,
    { input },
  );
}

/**
 * 根据执行状态、触发类型和分页条件读取指定任务的运行记录。
 *
 * @param id - 需要读取运行历史的插件任务标识。
 * @param params - 执行状态、触发类型和分页条件。
 * @returns 指定任务的执行状态、触发类型、耗时、错误和总数分页结果。
 */
export function getQqbotPluginTaskRunPage(
  id: string,
  params: QqbotPluginTaskApi.TaskRunQuery,
) {
  return requestClient.get<QqbotApi.PageResult<QqbotPluginTaskApi.TaskRun>>(
    `/qqbot/plugin-platform/tasks/${id}/runs`,
    { params },
  );
}
