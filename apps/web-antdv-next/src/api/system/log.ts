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

async function getSystemLogList(params: Recordable<any>) {
  return requestClient.get<SystemLogApi.PageResult<SystemLogApi.LogItem>>(
    '/system/logs',
    { params },
  );
}

async function getSystemLogSummary(params: Recordable<any>) {
  return requestClient.get<SystemLogApi.LogSummary[]>('/system/logs/summary', {
    params,
  });
}

async function getSystemLogLevels() {
  return requestClient.get<
    Array<{ label: string; value: SystemLogApi.LogLevel }>
  >('/system/logs/levels');
}

async function getSystemLogStatus() {
  return requestClient.get<SystemLogApi.LogStatus>('/system/logs/status');
}

export {
  getSystemLogLevels,
  getSystemLogList,
  getSystemLogStatus,
  getSystemLogSummary,
};
