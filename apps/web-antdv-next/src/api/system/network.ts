import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemNetworkApi {
  export type DdnsRecordType = 'A' | 'AAAA';
  export type DdnsSourceType =
    | 'agent_ipv6'
    | 'port_forward_ip4p'
    | 'port_forward_ipv4';
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
  export type EndpointMechanism = 'tcp_natmap' | 'udp_natmap' | 'udp_stun';
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

/**
 * 根据名称、记录类型、同步状态和分页条件读取 DDNS 记录。
 *
 * @param params - DDNS 名称、记录类型、同步状态和分页条件。
 * @returns 包含域名、来源、同步状态、错误和总数的 DDNS 分页结果。
 */
export function getNetworkDdnsList(params: SystemNetworkApi.DdnsRecordQuery) {
  return requestClient.get<
    SystemNetworkApi.PageResult<SystemNetworkApi.DdnsRecord>
  >('/system/network/ddns/list', { params });
}

/**
 * 按 A 或 AAAA 类型读取可用地址来源，并标明资格、时效与禁用原因。
 *
 * @param recordType - 用于筛选 DDNS 来源的 A 或 AAAA 记录类型。
 * @returns 与记录类型匹配的来源数组，包含资格、地址、时效和禁用原因。
 */
export function getNetworkDdnsSourceOptions(
  recordType: SystemNetworkApi.DdnsRecordType,
) {
  return requestClient.get<SystemNetworkApi.DdnsSourceOptionsResult>(
    '/system/network/ddns/source-options',
    { params: { recordType } },
  );
}

/**
 * 读取 DNSPod 提供商是否启用及凭据是否配置。
 *
 * @returns DNSPod 提供商的启用状态与凭据配置状态。
 */
export function getNetworkDdnsProviderStatus() {
  return requestClient.get<SystemNetworkApi.DdnsProviderStatus>(
    '/system/network/ddns/provider-status',
  );
}

/**
 * 将域名、记录类型、地址来源和启用状态保存为 DDNS 记录。
 *
 * @param data - DDNS 名称、域名、记录类型、地址来源、关联转发组和启用状态。
 * @returns 持久化后的完整 DDNS 记录及初始同步状态。
 */
export function createNetworkDdnsRecord(
  data: SystemNetworkApi.DdnsRecordInput,
) {
  return requestClient.post<SystemNetworkApi.DdnsRecord>(
    '/system/network/ddns',
    data,
  );
}

/**
 * 根据记录标识保存 DDNS 域名、来源与启用状态。
 *
 * @param id - 需要更新的 DDNS 记录标识。
 * @param data - 待保存的域名、记录类型、地址来源、关联转发组和启用状态。
 * @returns 保存字段后的完整 DDNS 记录及最新同步状态。
 */
export function updateNetworkDdnsRecord(
  id: string,
  data: SystemNetworkApi.DdnsRecordInput,
) {
  return requestClient.put<SystemNetworkApi.DdnsRecord>(
    `/system/network/ddns/${id}`,
    data,
  );
}

/**
 * 删除指定 DDNS 记录，并返回删除后的记录状态。
 *
 * @param id - 需要删除的 DDNS 记录标识。
 * @returns 标记删除后的完整 DDNS 记录。
 */
export function deleteNetworkDdnsRecord(id: string) {
  return requestClient.delete<SystemNetworkApi.DdnsRecord>(
    `/system/network/ddns/${id}`,
  );
}

/**
 * 重新触发指定 DDNS 记录同步，并返回最新同步状态或错误。
 *
 * @param id - 需要重新触发解析与同步的 DDNS 记录标识。
 * @returns 重新排队同步后的完整 DDNS 记录及最新错误或等待状态。
 */
export function retryNetworkDdnsRecord(id: string) {
  return requestClient.post<SystemNetworkApi.DdnsRecord>(
    `/system/network/ddns/${id}/retry`,
  );
}

/**
 * 根据名称、协议模式与分页条件读取端口转发分组及通道状态。
 *
 * @param params - 端口转发名称、协议模式和分页条件。
 * @returns 包含转发分组、TCP/UDP 通道状态和总数的分页结果。
 */
export function getNetworkPortForwardGroupList(
  params: SystemNetworkApi.PortForwardGroupQuery,
) {
  return requestClient.get<
    SystemNetworkApi.PageResult<SystemNetworkApi.PortForwardGroup>
  >('/system/network/port-forward-group/list', { params });
}

/**
 * 将协议模式、内外端口与备注保存为目标 IPv4 的端口转发组。
 *
 * @param data - 转发名称、协议模式、内外端口和目标 IPv4。
 * @returns 持久化后的完整端口转发组及其 TCP、UDP 通道。
 */
export function createNetworkPortForwardGroup(
  data: SystemNetworkApi.PortForwardGroupInput,
) {
  return requestClient.post<SystemNetworkApi.PortForwardGroup>(
    '/system/network/port-forward-group',
    data,
  );
}

/**
 * 根据分组标识保存协议模式、内外端口、名称与备注。
 *
 * @param id - 需要更新结构或备注的端口转发组标识。
 * @param data - 待保存的协议模式、内外端口、目标 IPv4、名称和备注。
 * @returns 保存字段后的完整端口转发组及最新通道状态。
 */
export function updateNetworkPortForwardGroup(
  id: string,
  data: SystemNetworkApi.PortForwardGroupInput,
) {
  return requestClient.put<SystemNetworkApi.PortForwardGroup>(
    `/system/network/port-forward-group/${id}`,
    data,
  );
}

/**
 * 删除端口转发分组及其 TCP、UDP 通道，并返回删除状态。
 *
 * @param id - 需要删除 TCP/UDP 通道的端口转发组标识。
 * @returns 标记删除后的完整端口转发组及通道状态。
 */
export function deleteNetworkPortForwardGroup(id: string) {
  return requestClient.delete<SystemNetworkApi.PortForwardGroup>(
    `/system/network/port-forward-group/${id}`,
  );
}

/**
 * 重试指定分组的 TCP 或 UDP 通道，并返回最新通道状态。
 *
 * @param id - 包含待重试 TCP 或 UDP 通道的端口转发组标识。
 * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
 * @returns 重新排队后的通道记录，包含最新同步、端点和错误状态。
 */
export function retryNetworkPortForwardChannel(
  id: string,
  protocol: SystemNetworkApi.Protocol,
) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/${protocol}/retry`,
  );
}

/**
 * 启动指定转发分组的 TCP NATMap，并返回最新通道端点与状态。
 *
 * @param id - 需要启用 TCP NATMap 通道的端口转发组标识。
 * @returns 启用请求后的 TCP 通道记录，包含 NATMap 期望值与最新运行状态。
 */
export function enableNetworkTcpNatmap(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/tcp/natmap/enable`,
  );
}

/**
 * 停止指定转发分组的 TCP NATMap，并返回最新通道状态。
 *
 * @param id - 需要停用 TCP NATMap 通道的端口转发组标识。
 * @returns 停用请求后的 TCP 通道记录，包含 NATMap 期望值与最新运行状态。
 */
export function disableNetworkTcpNatmap(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/tcp/natmap/disable`,
  );
}

/**
 * 启动固定 WireGuard 端口对的 UDP NATMap，并返回最新端点与状态。
 *
 * @param id - 需要启用 UDP NATMap 的端口转发组标识。
 * @returns 启用请求后的 UDP 通道记录。
 */
export function enableNetworkUdpNatmap(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/udp/natmap/enable`,
  );
}

/**
 * 停止固定 WireGuard 端口对的 UDP NATMap，并撤下当前端点。
 *
 * @param id - 需要停用 UDP NATMap 的端口转发组标识。
 * @returns 停用请求后的 UDP 通道记录。
 */
export function disableNetworkUdpNatmap(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/udp/natmap/disable`,
  );
}

/**
 * 启动指定转发分组的 UDP 保活器，并返回最新端点与状态。
 *
 * @param id - 需要启用 UDP STUN 保活通道的端口转发组标识。
 * @returns 启用请求后的 UDP 通道记录，包含保活期望值与最新运行状态。
 */
export function enableNetworkUdpKeeper(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/udp/keeper/enable`,
  );
}

/**
 * 停止指定转发分组的 UDP 保活器，并返回最新通道状态。
 *
 * @param id - 需要停用 UDP STUN 保活通道的端口转发组标识。
 * @returns 停用请求后的 UDP 通道记录，包含保活期望值与最新运行状态。
 */
export function disableNetworkUdpKeeper(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/udp/keeper/disable`,
  );
}

/**
 * 立即探测指定 UDP 保活通道，并返回刷新后的公网端点与状态。
 *
 * @param id - 需要立即探测 UDP 公网映射的端口转发组标识。
 * @returns 探测请求后的 UDP 通道记录，包含刷新后的端点和运行状态。
 */
export function probeNetworkUdpKeeper(id: string) {
  return requestClient.post<SystemNetworkApi.PortForwardChannel>(
    `/system/network/port-forward-group/${id}/channels/udp/keeper/probe`,
  );
}

/**
 * 根据分组、协议与分页条件读取端点发布、变更、恢复和撤销历史。
 *
 * @param id - 需要查询端点变更历史的端口转发组标识。
 * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
 * @param params - 端点历史的一基页码与每页数量。
 * @param params.pageNo - 可选的一基页码。
 * @param params.pageSize - 可选的每页记录数。
 * @returns 包含端点事件记录和总数的分页结果；没有历史时记录数组为空。
 */
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

/**
 * 从后端读取网络 Agent 在线状态、目标地址、配置修订、心跳与最近错误。
 *
 * @returns 网络 Agent 在线状态、配置修订、目标地址、心跳和可选错误信息。
 */
export function getNetworkAgentStatus() {
  return requestClient.get<SystemNetworkApi.AgentStatus>(
    '/system/network/agent/status',
  );
}

/**
 * 生成网络管理事件流地址，并在提供事件标识时从该位置续传。
 *
 * @param lastEventId - 用于向 SSE 服务续传、避免重复事件的最后事件标识；可省略。
 * @returns 包含可选 lastEventId 查询参数的网络管理 SSE 地址。
 */
export function getNetworkManagementEventsUrl(lastEventId?: string) {
  const query = (() => {
    if (lastEventId) {
      return `?lastEventId=${encodeURIComponent(lastEventId)}`;
    }
    return '';
  })();
  return buildApiUrl(`/system/network/events/stream${query}`);
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
