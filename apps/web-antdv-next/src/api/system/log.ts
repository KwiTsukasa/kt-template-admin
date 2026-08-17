import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemLogApi {
  export type LogLevel = 'critical' | 'debug' | 'error' | 'info' | 'warning';

  export interface LogItem {
    context?: string;
    durationMs?: number;
    hostname?: string;
    id: string;
    level: LogLevel | string;
    message: string;
    method?: string;
    path?: string;
    raw: string;
    requestId?: string;
    statusCode?: number;
    timestamp: string;
    timestampNs: string;
  }

  export interface LogSummary {
    count: number;
    level: LogLevel;
  }

  export interface LogStatus {
    app: string;
    configured: boolean;
    env: string;
    host?: string;
    selector: string;
  }

  export interface PageResult<T> {
    items: T[];
    total: number;
  }
}

/**
 * 根据关键词、级别、状态与分页条件读取结构化系统日志。
 *
 * @param params - 日志关键词、级别、请求状态、时间范围和分页条件。
 * @returns 包含时间、级别、消息、请求上下文和总数的分页日志结果。
 */
async function getSystemLogList(params: Recordable<any>) {
  return requestClient.get<SystemLogApi.PageResult<SystemLogApi.LogItem>>(
    '/system/logs',
    { params },
  );
}

/**
 * 按当前日志筛选条件统计各级别的记录数量。
 *
 * @param params - 日志级别、关键词、请求状态和时间范围；摘要按相同筛选条件聚合。
 * @returns 当前筛选条件下各日志级别及其记录数量。
 */
async function getSystemLogSummary(params: Recordable<any>) {
  return requestClient.get<SystemLogApi.LogSummary[]>('/system/logs/summary', {
    params,
  });
}

/**
 * 从后端读取支持的日志级别标签与枚举值。
 *
 * @returns 后端支持的日志级别标签和值数组。
 */
async function getSystemLogLevels() {
  return requestClient.get<
    Array<{ label: string; value: SystemLogApi.LogLevel }>
  >('/system/logs/levels');
}

/**
 * 从后端读取日志源是否配置及其应用、环境、主机和选择器信息。
 *
 * @returns 日志源的配置状态、应用、环境、选择器及可选主机信息。
 */
async function getSystemLogStatus() {
  return requestClient.get<SystemLogApi.LogStatus>('/system/logs/status');
}

export {
  getSystemLogLevels,
  getSystemLogList,
  getSystemLogStatus,
  getSystemLogSummary,
};
