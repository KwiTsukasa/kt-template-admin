import { requestClient } from '#/api/request';

export namespace EnvironmentDashboardApi {
  export type EnvironmentHealthStatus =
    | 'blocked'
    | 'degraded'
    | 'down'
    | 'isolated'
    | 'ok'
    | 'unknown'
    | 'unwired';

  export type EnvironmentSiteStatus =
    | 'degraded'
    | 'isolated'
    | 'online'
    | 'unknown';

  export type EnvironmentSignalSourceKind =
    | 'cached'
    | 'configured'
    | 'derived'
    | 'external-link'
    | 'live'
    | 'unwired';

  export interface EnvironmentEvidence {
    metadata?: Record<string, unknown>;
    observedAt?: string;
    source: string;
    summary: string;
    type?: 'error' | EnvironmentSignalSourceKind;
    url?: string;
  }

  export interface EnvironmentSignal {
    evidence: EnvironmentEvidence[];
    id: string;
    label: string;
    observedAt?: string;
    sourceKind: EnvironmentSignalSourceKind;
    staleAfterSeconds?: number;
    status: EnvironmentHealthStatus;
    summary: string;
  }

  export interface EnvironmentService {
    id: string;
    label: string;
    signals: EnvironmentSignal[];
    status: EnvironmentHealthStatus;
    summary: string;
  }

  export interface EnvironmentNode {
    id: string;
    label: string;
    services: EnvironmentService[];
    status: EnvironmentHealthStatus;
    summary?: string;
  }

  export interface EnvironmentSite {
    id: string;
    label: string;
    nodes: EnvironmentNode[];
    status: EnvironmentSiteStatus;
    summary: string;
  }

  export interface EnvironmentDashboardSummary {
    blocked: number;
    degraded: number;
    down: number;
    ok: number;
    totalSignals: number;
    unknown: number;
    unwired: number;
  }

  export interface EnvironmentTopologyEdge {
    from: string;
    id: string;
    label: string;
    to: string;
  }

  export interface EnvironmentTopologyNode {
    id: string;
    label: string;
    siteId: string;
    status: EnvironmentHealthStatus;
    type: 'node' | 'service' | 'site';
  }

  export interface EnvironmentTopology {
    edges: EnvironmentTopologyEdge[];
    nodes: EnvironmentTopologyNode[];
  }

  export interface EnvironmentAction {
    disabledReason?: string;
    enabled: boolean;
    id: string;
    label: string;
    riskLevel: 'high' | 'low' | 'medium';
    serviceId?: string;
    siteId?: string;
  }

  export interface EnvironmentEvent {
    eventId: string;
    evidence?: EnvironmentEvidence[];
    expiresAt?: string;
    nodeId?: string;
    observedAt: string;
    retained?: boolean;
    serviceId?: string;
    severity: EnvironmentHealthStatus;
    signalId?: string;
    siteId: string;
    sourceKind: 'local' | 'mqtt' | EnvironmentSignalSourceKind;
    summary: string;
    topic: string;
  }

  export interface EnvironmentDashboardResponse {
    actions: EnvironmentAction[];
    events: EnvironmentEvent[];
    generatedAt: string;
    refreshedAt: string;
    sites: EnvironmentSite[];
    summary: EnvironmentDashboardSummary;
    topology: EnvironmentTopology;
  }

  export type EnvironmentStreamEventType =
    | 'environment-event'
    | 'environment-signal'
    | 'error'
    | 'heartbeat'
    | 'snapshot-required';
}

/**
 * 从后端读取站点、节点、服务、信号、拓扑、事件及健康计数的环境快照。
 *
 * @returns 包含站点、节点、服务、信号、拓扑、事件和健康计数的环境快照。
 */
export function getEnvironmentDashboard() {
  return requestClient.get<EnvironmentDashboardApi.EnvironmentDashboardResponse>(
    '/system/environment/dashboard',
  );
}

/**
 * 触发环境信号自检，并返回刷新后的完整环境快照。
 *
 * @returns 自检完成后的完整环境快照，包含更新后的服务、信号和健康计数。
 */
export function runEnvironmentSelfCheck() {
  return requestClient.post<EnvironmentDashboardApi.EnvironmentDashboardResponse>(
    '/system/environment/self-check',
  );
}

/**
 * 生成环境总览事件流地址，并在提供事件标识时从该位置续传。
 *
 * @param lastEventId - 用于向 SSE 服务续传、避免重复事件的最后事件标识；可省略。
 * @returns 包含可选 lastEventId 查询参数的环境 SSE 地址。
 */
export function getEnvironmentDashboardEventsUrl(lastEventId?: string) {
  const query = (() => {
    if (lastEventId) {
      return `?lastEventId=${encodeURIComponent(lastEventId)}`;
    }
    return '';
  })();
  return buildApiUrl(`/system/environment/events/stream${query}`);
}

/**
 * 基于当前管理端 API 根路径拼接相对地址，避免部署子路径丢失。
 *
 * @param path - 要拼接到管理端 API 根地址后的相对路径。
 * @returns 包含部署基础路径的完整 API 地址。
 */
function buildApiUrl(path: string) {
  const getBaseUrl = (requestClient as unknown as { getBaseUrl?: () => string })
    .getBaseUrl;
  const baseUrl = getBaseUrl?.() || '';
  if (!baseUrl) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (/^https?:\/\//i.test(baseUrl)) {
    return new URL(path, baseUrl).toString();
  }
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
