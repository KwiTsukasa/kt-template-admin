import { useAppConfig } from '@vben/hooks';

import { requestClient } from '#/api/request';

export type RunKind = 'schedule' | 'task' | 'workflow';
export type RunPhase =
  | 'active'
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'skipped'
  | 'succeeded';
export type RunSummary = {
  createdAt: string;
  finishedAt: null | string;
  hasError: boolean;
  kind: RunKind;
  name: string;
  phase: RunPhase;
  requiresReview: boolean;
  resourceId: string;
  resourceVersion: number;
  runId: string;
  status: string;
};
export type ExecutionQuery = {
  beforeId?: string;
  kind?: RunKind;
  limit: number;
  phase?: RunPhase;
};
export type ExecutionPage = { items: RunSummary[]; nextCursor: null | string };
export const executionPage = (params: ExecutionQuery) =>
  requestClient.get<{ items: RunSummary[]; nextCursor: null | string }>(
    '/automation/executions/page',
    { params },
  );

/**
 * 保留部署前缀并编码列表筛选，订阅复用管理员 Cookie，不把凭据放进 URL。
 * @param params - 当前列表的类型、状态和有界页大小。
 * @returns 独立执行监控的 SSE 地址。
 */
export function executionEventsUrl(params: ExecutionQuery): string {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return `${apiURL.replace(/\/+$/u, '')}/automation/executions/events/stream?${query}`;
}
