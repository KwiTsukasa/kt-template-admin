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

export function getEnvironmentDashboard() {
  return requestClient.get<EnvironmentDashboardApi.EnvironmentDashboardResponse>(
    '/system/environment/dashboard',
  );
}

export function runEnvironmentSelfCheck() {
  return requestClient.post<EnvironmentDashboardApi.EnvironmentDashboardResponse>(
    '/system/environment/self-check',
  );
}

export function getEnvironmentDashboardEventsUrl(lastEventId?: string) {
  const query = lastEventId
    ? `?lastEventId=${encodeURIComponent(lastEventId)}`
    : '';
  return buildApiUrl(`/system/environment/events/stream${query}`);
}

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
