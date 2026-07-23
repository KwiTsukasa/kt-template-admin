import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemNetworkApi {
  export type DesiredPresence = 'absent' | 'present';
  export type EndpointEventType =
    | 'changed'
    | 'published'
    | 'restored'
    | 'withdrawn';
  export type KeeperStatus =
    | 'active'
    | 'disabled'
    | 'failed'
    | 'stale'
    | 'starting';
  export type Protocol = 'tcp' | 'udp';
  export type StateChangeSource = 'events' | 'reported' | 'status';
  export type Revision = string;
  export type SyncStatus =
    | 'conflict'
    | 'deleting'
    | 'failed'
    | 'pending'
    | 'synced'
    | 'syncing';

  export interface AgentStatus {
    agentId: string;
    appliedRevision: Revision;
    desiredRevision: Revision;
    lastErrorCode?: null | string;
    lastErrorMessage?: null | string;
    lastHeartbeatAt?: null | string;
    online: boolean;
    publishedRevision: Revision;
    startedAt?: null | string;
    targetIpv4: string;
    version?: null | string;
  }

  export interface EndpointHistoryItem {
    eventId: string;
    eventType: EndpointEventType;
    firstObservedAt?: null | string;
    id: string;
    lastObservedAt?: null | string;
    occurredAt: string;
    portForwardId: string;
    publicIpv4?: null | string;
    publicPort?: null | number;
    withdrawalReason?: null | string;
  }

  export interface PageResult<T> {
    items: T[];
    list?: T[];
    total: number;
  }

  export interface PortForward {
    activeKey?: null | string;
    createTime?: string;
    currentObservedAt?: null | string;
    currentPublicIpv4?: null | string;
    currentPublicPort?: null | number;
    currentValidUntil?: null | string;
    desiredPresence: DesiredPresence;
    desiredRevision: Revision;
    externalPort: number;
    id: string;
    internalPort: number;
    isDeleted: boolean;
    keeperDesiredEnabled: boolean;
    keeperStatus: KeeperStatus;
    lastErrorCode?: null | string;
    lastErrorMessage?: null | string;
    lastObservedAt?: null | string;
    lastObservedIpv4?: null | string;
    lastObservedPort?: null | number;
    name: string;
    probeRequestId?: null | string;
    protocol: Protocol;
    remark?: null | string;
    reportedRevision?: null | Revision;
    syncStatus: SyncStatus;
    targetIpv4: string;
    updateTime?: string;
  }

  export interface PortForwardInput {
    externalPort: number;
    internalPort: number;
    name: string;
    protocol: Protocol;
    remark?: string;
  }

  export interface StateChangeEvent {
    eventId: string;
    observedAt: string;
    source: StateChangeSource;
  }

  export type PortForwardItem = PortForward;
  export type PortForwardPayload = PortForwardInput;

  export interface PortForwardQuery extends Recordable<any> {
    keeperStatus?: KeeperStatus;
    name?: string;
    pageNo?: number;
    pageSize?: number;
    protocol?: Protocol;
    syncStatus?: SyncStatus;
  }
}

/**
 * Loads the persisted port-forward resource page from the API fact source.
 * @param params - Pagination and independent protocol/synchronization filters.
 * @returns Port-forward rows and the total record count.
 */
export function getNetworkPortForwardList(
  params: SystemNetworkApi.PortForwardQuery,
) {
  return requestClient.get<
    SystemNetworkApi.PageResult<SystemNetworkApi.PortForward>
  >('/system/network/port-forward/list', { params });
}

/**
 * Creates a desired router mapping without exposing router credentials.
 * @param data - User-editable mapping fields.
 * @returns The persisted pending desired record.
 */
export function createNetworkPortForward(
  data: SystemNetworkApi.PortForwardInput,
) {
  return requestClient.post<SystemNetworkApi.PortForward>(
    '/system/network/port-forward',
    data,
  );
}

/**
 * Updates the editable desired fields of one active mapping.
 * @param id - Stable port-forward record ID.
 * @param data - Complete editable mapping fields.
 * @returns The updated pending desired record.
 */
export function updateNetworkPortForward(
  id: string,
  data: SystemNetworkApi.PortForwardInput,
) {
  return requestClient.put<SystemNetworkApi.PortForward>(
    `/system/network/port-forward/${id}`,
    data,
  );
}

/**
 * Requests confirmed asynchronous deletion of one managed mapping.
 * @param id - Stable port-forward record ID.
 * @returns The deleting tombstone retained until Agent acknowledgement.
 */
export function deleteNetworkPortForward(id: string) {
  return requestClient.delete<SystemNetworkApi.PortForward>(
    `/system/network/port-forward/${id}`,
  );
}

/**
 * Raises a new reconciliation revision for a failed or conflicted mapping.
 * @param id - Stable port-forward record ID.
 * @returns The latest pending desired record.
 */
export function retryNetworkPortForward(id: string) {
  return requestClient.post<SystemNetworkApi.PortForward>(
    `/system/network/port-forward/${id}/retry`,
  );
}

/**
 * Enables persistent UDP STUN observation and triggers an immediate probe.
 * @param id - Eligible UDP same-port mapping ID.
 * @returns The latest pending desired record.
 */
export function enableNetworkPortForwardKeeper(id: string) {
  return requestClient.post<SystemNetworkApi.PortForward>(
    `/system/network/port-forward/${id}/keeper/enable`,
  );
}

/**
 * Stops future STUN renewals without deleting the router mapping.
 * @param id - UDP mapping ID whose Keeper is currently desired.
 * @returns The latest pending desired record.
 */
export function disableNetworkPortForwardKeeper(id: string) {
  return requestClient.post<SystemNetworkApi.PortForward>(
    `/system/network/port-forward/${id}/keeper/disable`,
  );
}

/**
 * Generates an idempotent request ID for one immediate UDP STUN cycle.
 * @param id - Enabled UDP same-port mapping ID.
 * @returns The latest desired record carrying the new request ID.
 */
export function probeNetworkPortForward(id: string) {
  return requestClient.post<SystemNetworkApi.PortForward>(
    `/system/network/port-forward/${id}/probe`,
  );
}

/**
 * Loads append-only endpoint transition history for one mapping.
 * @param id - Stable port-forward record ID.
 * @param params - History pagination values.
 * @param params.pageNo - One-based history page number.
 * @param params.pageSize - Maximum rows requested for the page.
 * @returns Endpoint transition records and their total count.
 */
export function getNetworkPortForwardEndpointHistory(
  id: string,
  params: { pageNo?: number; pageSize?: number },
) {
  return requestClient.get<
    SystemNetworkApi.PageResult<SystemNetworkApi.EndpointHistoryItem>
  >(`/system/network/port-forward/${id}/endpoint-history`, { params });
}

/**
 * Loads independent Agent connectivity and revision convergence state.
 * @returns Current Agent status without inferring per-record failures.
 */
export function getNetworkAgentStatus() {
  return requestClient.get<SystemNetworkApi.AgentStatus>(
    '/system/network/agent/status',
  );
}

/**
 * Builds the credentialed EventSource URL for committed network-state changes.
 * @param lastEventId - Optional replay cursor retained by the current route instance.
 * @returns Browser-ready SSE URL using the configured API base path.
 */
export function getNetworkManagementEventsUrl(lastEventId?: string) {
  const query = lastEventId
    ? `?lastEventId=${encodeURIComponent(lastEventId)}`
    : '';
  return buildApiUrl(`/system/network/events/stream${query}`);
}

/**
 * Joins one network API path with the request client's configured base URL.
 * @param path - Relative API route for the EventSource connection.
 * @returns Absolute or proxy-relative URL matching normal Admin requests.
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
