import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemNetworkApi {
  export type DdnsRecordType = 'A' | 'AAAA';
  export type DdnsSourceType = 'agent_ipv6' | 'port_forward_ipv4';
  export type DdnsSyncStatus =
    | 'disabled'
    | 'failed'
    | 'pending'
    | 'synced'
    | 'syncing'
    | 'waiting_source';
  export type DesiredPresence = 'absent' | 'present';
  export type EndpointEventType =
    | 'changed'
    | 'published'
    | 'restored'
    | 'withdrawn';
  export type EndpointMechanism = 'tcp_natmap' | 'udp_stun';
  export type KeeperStatus =
    | 'active'
    | 'disabled'
    | 'failed'
    | 'stale'
    | 'starting';
  export type NatmapStatus =
    | 'active'
    | 'disabled'
    | 'failed'
    | 'stale'
    | 'starting'
    | 'stopping';
  export type Protocol = 'tcp' | 'udp';
  export type ProtocolMode = 'tcp' | 'tcp_udp' | 'udp';
  export type StateChangeSource = 'ddns' | 'events' | 'reported' | 'status';
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
    currentIpv6ObservedAt?: null | string;
    currentPublicIpv6?: null | string;
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
    mechanism: EndpointMechanism;
    occurredAt: string;
    portForwardId: string;
    publicIpv4?: null | string;
    publicPort?: null | number;
    withdrawalReason?: null | string;
  }

  export interface DdnsProviderStatus {
    configured: boolean;
    enabled: boolean;
    provider: 'dnspod';
  }

  export interface DdnsSourceOption {
    currentAddress?: null | string;
    currentPort?: number;
    disabledReasonCode?: null | string;
    eligible: boolean;
    externalPort?: number;
    groupId?: string;
    id: string;
    mechanism?: EndpointMechanism;
    name: string;
    observedAt?: null | string;
    protocol?: Protocol;
    sourceType: DdnsSourceType;
    validUntil?: null | string;
  }

  export interface DdnsSourceOptionsResult {
    items: DdnsSourceOption[];
  }

  export interface DdnsRecord {
    accessEndpoint?: null | string;
    appliedAddress?: null | string;
    domain: string;
    enabled: boolean;
    fqdn: string;
    id: string;
    lastErrorCode?: null | string;
    lastErrorMessage?: null | string;
    lastSyncedAt?: null | string;
    name: string;
    nextRetryAt?: null | string;
    portForwardId?: null | string;
    recordType: DdnsRecordType;
    remark?: null | string;
    retryCount: number;
    source: DdnsSourceOption;
    sourceAddress?: null | string;
    sourceType: DdnsSourceType;
    subDomain: string;
    syncStatus: DdnsSyncStatus;
    updateTime?: string;
  }

  export interface DdnsRecordInput {
    domain: string;
    enabled: boolean;
    name: string;
    portForwardId?: string;
    recordType: DdnsRecordType;
    remark?: string;
    sourceType: DdnsSourceType;
    subDomain: string;
  }

  export interface DdnsRecordQuery extends Recordable<any> {
    enabled?: boolean;
    name?: string;
    pageNo?: number;
    pageSize?: number;
    recordType?: DdnsRecordType;
    syncStatus?: DdnsSyncStatus;
  }

  export interface PageResult<T> {
    items: T[];
    list?: T[];
    total: number;
  }

  export interface PortForwardChannel {
    activeKey?: null | string;
    createTime?: string;
    currentObservedAt?: null | string;
    currentPublicEndpoint?: null | string;
    currentPublicIpv4?: null | string;
    currentPublicPort?: null | number;
    currentValidatedAt?: null | string;
    currentValidUntil?: null | string;
    desiredPresence: DesiredPresence;
    desiredIssuedAt?: null | string;
    desiredRevision: Revision;
    externalPort: number;
    groupId: string;
    id: string;
    internalPort: number;
    isDeleted: boolean;
    keeperDesiredEnabled: boolean;
    keeperLastErrorCode?: null | string;
    keeperLastErrorMessage?: null | string;
    keeperStatus: KeeperStatus;
    lastErrorCode?: null | string;
    lastErrorMessage?: null | string;
    lastObservedAt?: null | string;
    lastObservedIpv4?: null | string;
    lastObservedPort?: null | number;
    name: string;
    natmapDesiredEnabled: boolean;
    natmapLastErrorCode?: null | string;
    natmapLastErrorMessage?: null | string;
    natmapStatus: NatmapStatus;
    probeRequestId?: null | string;
    protocol: Protocol;
    remark?: null | string;
    reportedRevision?: null | Revision;
    syncStatus: SyncStatus;
    targetIpv4: string;
    updateTime?: string;
  }

  export interface PortForwardGroup {
    appliedProtocolMode: null | ProtocolMode;
    channels: {
      tcp: null | PortForwardChannel;
      udp: null | PortForwardChannel;
    };
    createTime?: string;
    externalPort: number;
    id: string;
    internalPort: number;
    isDeleted: boolean;
    name: string;
    protocolMode: ProtocolMode;
    remark?: null | string;
    targetIpv4: string;
    updateTime?: string;
  }

  export interface PortForwardGroupInput {
    externalPort: number;
    internalPort: number;
    name: string;
    protocolMode: ProtocolMode;
    remark?: string;
  }

  export interface StateChangeEvent {
    eventId: string;
    observedAt: string;
    source: StateChangeSource;
  }

  export interface PortForwardGroupQuery extends Recordable<any> {
    name?: string;
    pageNo?: number;
    pageSize?: number;
    protocolMode?: ProtocolMode;
  }
}

export function getNetworkDdnsList(params: SystemNetworkApi.DdnsRecordQuery) {
  return requestClient.get<
    SystemNetworkApi.PageResult<SystemNetworkApi.DdnsRecord>
  >('/system/network/ddns/list', { params });
}

export function getNetworkDdnsSourceOptions(
  recordType: SystemNetworkApi.DdnsRecordType,
) {
  return requestClient.get<SystemNetworkApi.DdnsSourceOptionsResult>(
    '/system/network/ddns/source-options',
    { params: { recordType } },
  );
}

export function getNetworkDdnsProviderStatus() {
  return requestClient.get<SystemNetworkApi.DdnsProviderStatus>(
    '/system/network/ddns/provider-status',
  );
}

export function createNetworkDdnsRecord(
  data: SystemNetworkApi.DdnsRecordInput,
) {
  return requestClient.post<SystemNetworkApi.DdnsRecord>(
    '/system/network/ddns',
    data,
  );
}

export function updateNetworkDdnsRecord(
  id: string,
  data: SystemNetworkApi.DdnsRecordInput,
) {
  return requestClient.put<SystemNetworkApi.DdnsRecord>(
    `/system/network/ddns/${id}`,
    data,
  );
}

export function deleteNetworkDdnsRecord(id: string) {
  return requestClient.delete<SystemNetworkApi.DdnsRecord>(
    `/system/network/ddns/${id}`,
  );
}

export function retryNetworkDdnsRecord(id: string) {
  return requestClient.post<SystemNetworkApi.DdnsRecord>(
    `/system/network/ddns/${id}/retry`,
  );
}

export function getNetworkPortForwardGroupList(
  params: SystemNetworkApi.PortForwardGroupQuery,
) {
  return requestClient.get<
    SystemNetworkApi.PageResult<SystemNetworkApi.PortForwardGroup>
  >('/system/network/port-forward-group/list', { params });
}

export function createNetworkPortForwardGroup(
  data: SystemNetworkApi.PortForwardGroupInput,
) {
  return requestClient.post<SystemNetworkApi.PortForwardGroup>(
    '/system/network/port-forward-group',
    data,
  );
}

export function updateNetworkPortForwardGroup(
  id: string,
  data: SystemNetworkApi.PortForwardGroupInput,
) {
  return requestClient.put<SystemNetworkApi.PortForwardGroup>(
    `/system/network/port-forward-group/${id}`,
    data,
  );
}

export function deleteNetworkPortForwardGroup(id: string) {
  return requestClient.delete<SystemNetworkApi.PortForwardGroup>(
    `/system/network/port-forward-group/${id}`,
  );
}

export function retryNetworkPortForwardChannel(
  id: string,
  protocol: SystemNetworkApi.Protocol,
) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/${protocol}/retry`,
  );
}

export function enableNetworkTcpNatmap(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/tcp/natmap/enable`,
  );
}

export function disableNetworkTcpNatmap(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/tcp/natmap/disable`,
  );
}

export function enableNetworkUdpKeeper(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/udp/keeper/enable`,
  );
}

export function disableNetworkUdpKeeper(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/udp/keeper/disable`,
  );
}

export function probeNetworkUdpKeeper(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/udp/keeper/probe`,
  );
}

export function getNetworkPortForwardChannelEndpointHistory(
  id: string,
  protocol: SystemNetworkApi.Protocol,
  params: { pageNo?: number; pageSize?: number },
) {
  return requestClient.get<
    SystemNetworkApi.PageResult<SystemNetworkApi.EndpointHistoryItem>
  >(
    `/system/network/port-forward-group/${id}/channels/${protocol}/endpoint-history`,
    { params },
  );
}

export function getNetworkAgentStatus() {
  return requestClient.get<SystemNetworkApi.AgentStatus>(
    '/system/network/agent/status',
  );
}

export function getNetworkManagementEventsUrl(lastEventId?: string) {
  const query = lastEventId
    ? `?lastEventId=${encodeURIComponent(lastEventId)}`
    : '';
  return buildApiUrl(`/system/network/events/stream${query}`);
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
