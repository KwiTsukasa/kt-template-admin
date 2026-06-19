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
 * Loads the aggregate Admin environment dashboard snapshot.
 *
 * @returns Dashboard response unwrapped by the shared Vben request client.
 */
export function getEnvironmentDashboard() {
  return requestClient.get<EnvironmentDashboardApi.EnvironmentDashboardResponse>(
    '/system/environment/dashboard',
  );
}

/**
 * Runs the API read-only self-check endpoint without exposing write actions.
 *
 * @returns Fresh dashboard response after backend read-only probes complete.
 */
export function runEnvironmentSelfCheck() {
  return requestClient.post<EnvironmentDashboardApi.EnvironmentDashboardResponse>(
    '/system/environment/self-check',
  );
}

/**
 * Builds the EventSource URL for API-emitted dashboard updates.
 *
 * @param lastEventId Optional SSE replay cursor held only in the current page instance.
 * @returns Absolute API URL when the request client exposes a base URL; otherwise a relative path.
 */
export function getEnvironmentDashboardEventsUrl(lastEventId?: string) {
  const query = lastEventId
    ? `?lastEventId=${encodeURIComponent(lastEventId)}`
    : '';
  return buildApiUrl(`/system/environment/events/stream${query}`);
}

/**
 * Mirrors the existing API URL joining convention used by local SSE helpers.
 *
 * @param path API path produced by the environment dashboard wrapper.
 * @returns Browser-ready URL that respects proxy or absolute API base configuration.
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
