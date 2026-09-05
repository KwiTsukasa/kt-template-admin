import { useAppConfig } from '@vben/hooks';

import { requestClient } from '#/api/request';

export interface CoordinationTask {
  workstreamId: string;
  objective: string;
  status: 'active' | 'completed' | 'paused';
  updatedAt: string;
  revision: number;
  actionId: null | string;
  nextStep: null | string;
  executionDepth: number;
}

export interface CoordinationSnapshot {
  schemaVersion: 1;
  snapshotId: string;
  observedAt: string;
  unreadableTasks: number;
  revision: number;
  tasks: CoordinationTask[];
  claims: Array<{
    acquiredAt: string;
    actionId: string;
    key: string;
    kind: string;
    workstreamId: string;
  }>;
  events: Array<{
    at: string;
    id: number;
    message: string;
    operation: string;
    workstreamId: string;
  }>;
}

/**
 * 通过管理端鉴权代理读取 Windows Index 协调快照，统一由请求层拆包并传播接口异常。
 * @returns 管理端已拆包的协调中心快照。
 */
export function getCoordinationSnapshot() {
  return requestClient.get<CoordinationSnapshot>('/codex-remote/coordination');
}

/**
 * 保留 API 部署前缀，生成使用当前管理员 Cookie 的实时订阅地址。
 * @returns 协调中心 SSE 地址。
 */
export function getCoordinationEventsUrl() {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  return `${apiURL.replace(/\/+$/u, '')}/codex-remote/coordination/events`;
}
