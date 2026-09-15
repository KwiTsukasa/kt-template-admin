import { requestClient } from '#/api/request';
import { useAppConfig } from '@vben/hooks';

export type RunKind = 'task' | 'workflow' | 'schedule';
export type RunPhase =
  | 'pending'
  | 'active'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'skipped';
export type RunSummary = {
  kind: RunKind;
  runId: string;
  resourceId: string;
  resourceVersion: number;
  name: string;
  phase: RunPhase;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  requiresReview: boolean;
  hasError: boolean;
};
export type ExecutionQuery = {
  kind?: RunKind;
  phase?: RunPhase;
  beforeId?: string;
  limit: number;
};
export type ExecutionPage = { items: RunSummary[]; nextCursor: string | null };
export const executionPage = (params: ExecutionQuery) =>
  requestClient.get<{ items: RunSummary[]; nextCursor: string | null }>(
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
