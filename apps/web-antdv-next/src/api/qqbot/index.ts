import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace QqbotApi {
  export interface PageResult<T> {
    list: T[];
    pageNo?: number;
    pageSize?: number;
    total: number;
  }

  export interface DashboardSummary {
    accountTotal: number;
    bus: {
      connected: boolean;
      mode: string;
      url: string;
    };
    conversationTotal: number;
    enabledRuleTotal: number;
    messageTotal: number;
    onlineTotal: number;
    runtime: {
      enabled: boolean;
      path: string;
      sessions: string[];
    };
    sendFailedTotal: number;
    sendSuccessTotal: number;
  }

  export interface Account {
    clientRole?: string;
    connectStatus: 'offline' | 'online';
    connectionMode: 'reverse-ws';
    createTime?: string;
    enabled: boolean;
    id: string;
    lastConnectedAt?: string;
    lastError?: string;
    lastHeartbeatAt?: string;
    name: string;
    remark?: string;
    selfId: string;
  }

  export interface AccountBody {
    accessToken?: string;
    connectionMode?: 'reverse-ws';
    enabled?: boolean;
    id?: string;
    name?: string;
    remark?: string;
    selfId: string;
  }

  export interface AccountScanResult {
    accountId?: string;
    containerId?: string;
    containerName?: string;
    errorMessage?: string;
    expiresAt?: number;
    mode: 'create' | 'refresh';
    qrcode?: string;
    selfId?: string;
    sessionId?: string;
    status: 'error' | 'expired' | 'pending' | 'success';
    webuiPort?: null | number;
  }

  export interface Rule {
    cooldownMs: number;
    enabled: boolean;
    id: string;
    keyword: string;
    lastHitAt?: string;
    matchType: 'equals' | 'keyword' | 'regex';
    name: string;
    priority: number;
    remark?: string;
    replyContent: string;
    targetType: 'all' | 'channel' | 'group' | 'private';
  }

  export interface RuleBody {
    cooldownMs?: number;
    enabled?: boolean;
    id?: string;
    keyword: string;
    matchType: 'equals' | 'keyword' | 'regex';
    name?: string;
    priority?: number;
    remark?: string;
    replyContent: string;
    targetType?: 'all' | 'channel' | 'group' | 'private';
  }

  export interface Conversation {
    createTime?: string;
    id: string;
    lastMessageText?: string;
    lastMessageTime?: string;
    messageCount: number;
    selfId: string;
    targetId: string;
    targetName?: string;
    targetType: 'channel' | 'group' | 'private';
  }

  export interface Message {
    direction: 'inbound' | 'outbound';
    eventTime: string;
    id: string;
    messageText: string;
    messageType: 'channel' | 'group' | 'private';
    senderNickname?: string;
    selfId: string;
    targetId: string;
    userId: string;
  }

  export interface SendLog {
    action: string;
    createTime?: string;
    errorMessage?: string;
    id: string;
    messageText: string;
    selfId: string;
    status: 'failed' | 'pending' | 'success';
    targetId: string;
    targetType: 'channel' | 'group' | 'private';
  }

  export interface PermissionConfig {
    allowlistEnabled: boolean;
    blocklistEnabled: boolean;
  }

  export interface Permission {
    enabled: boolean;
    id: string;
    preciseUser: boolean;
    remark?: string;
    selfId?: string;
    targetId: string;
    targetType: 'channel' | 'group' | 'private' | 'qq';
    userId?: string;
  }

  export interface PermissionBody {
    enabled?: boolean;
    id?: string;
    preciseUser?: boolean;
    remark?: string;
    selfId?: string;
    targetId: string;
    targetType: 'channel' | 'group' | 'private' | 'qq';
    userId?: string;
  }

  export type Query = Recordable<any>;
}

export function getQqbotDashboardSummary() {
  return requestClient.get<QqbotApi.DashboardSummary>(
    '/qqbot/dashboard/summary',
  );
}

export function getQqbotAccountList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Account>>(
    '/qqbot/account/list',
    { params },
  );
}

export function getQqbotEnabledAccounts() {
  return requestClient.get<QqbotApi.Account[]>('/qqbot/account/enabled');
}

export function createQqbotAccount(data: QqbotApi.AccountBody) {
  return requestClient.post<string>('/qqbot/account/save', data);
}

export function updateQqbotAccount(data: QqbotApi.AccountBody) {
  return requestClient.post<boolean>('/qqbot/account/update', data);
}

export function deleteQqbotAccount(id: string) {
  return requestClient.post<{ deletedContainers: number }>(
    `/qqbot/account/delete?id=${id}`,
  );
}

export function kickQqbotAccount(selfId: string) {
  return requestClient.post<{ count: number }>(
    `/qqbot/account/kick?selfId=${selfId}`,
  );
}

export function startQqbotAccountScanCreate() {
  return requestClient.post<QqbotApi.AccountScanResult>(
    '/qqbot/account/scan/create',
  );
}

export function startQqbotAccountScanRefresh(id: string) {
  return requestClient.post<QqbotApi.AccountScanResult>(
    `/qqbot/account/scan/refresh?id=${id}`,
  );
}

export function getQqbotAccountScanStatus(sessionId: string) {
  return requestClient.get<QqbotApi.AccountScanResult>(
    '/qqbot/account/scan/status',
    { params: { sessionId } },
  );
}

export function refreshQqbotAccountScanQrcode(sessionId: string) {
  return requestClient.post<QqbotApi.AccountScanResult>(
    `/qqbot/account/scan/qrcode/refresh?sessionId=${sessionId}`,
  );
}

export function cancelQqbotAccountScan(sessionId: string) {
  return requestClient.post<boolean>(
    `/qqbot/account/scan/cancel?sessionId=${sessionId}`,
  );
}

export function getQqbotRuleList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Rule>>(
    '/qqbot/rule/list',
    { params },
  );
}

export function createQqbotRule(data: QqbotApi.RuleBody) {
  return requestClient.post<string>('/qqbot/rule/save', data);
}

export function updateQqbotRule(data: QqbotApi.RuleBody) {
  return requestClient.post<boolean>('/qqbot/rule/update', data);
}

export function deleteQqbotRule(id: string) {
  return requestClient.post<boolean>(`/qqbot/rule/delete?id=${id}`);
}

export function toggleQqbotRule(id: string, enabled: boolean) {
  return requestClient.post<boolean>(
    `/qqbot/rule/toggle?id=${id}&enabled=${enabled}`,
  );
}

export function getQqbotConversationList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Conversation>>(
    '/qqbot/conversation/list',
    { params },
  );
}

export function getQqbotMessageList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Message>>(
    '/qqbot/message/list',
    { params },
  );
}

export function getQqbotSendLogList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.SendLog>>(
    '/qqbot/send/log/list',
    { params },
  );
}

export function sendQqbotPrivate(data: {
  message: string;
  selfId?: string;
  userId: string;
}) {
  return requestClient.post('/qqbot/send/private', data);
}

export function sendQqbotGroup(data: {
  groupId: string;
  message: string;
  selfId?: string;
}) {
  return requestClient.post('/qqbot/send/group', data);
}

export function getQqbotPermissionList(
  kind: 'allowlist' | 'blocklist',
  params: QqbotApi.Query,
) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Permission>>(
    `/qqbot/permission/${kind}`,
    { params },
  );
}

export function getQqbotPermissionConfig() {
  return requestClient.get<QqbotApi.PermissionConfig>(
    '/qqbot/permission/config',
  );
}

export function updateQqbotPermissionConfig(
  data: Partial<QqbotApi.PermissionConfig>,
) {
  return requestClient.post<QqbotApi.PermissionConfig>(
    '/qqbot/permission/config',
    data,
  );
}

export function createQqbotPermission(
  kind: 'allowlist' | 'blocklist',
  data: QqbotApi.PermissionBody,
) {
  return requestClient.post<string>(`/qqbot/permission/${kind}/save`, data);
}

export function updateQqbotPermission(
  kind: 'allowlist' | 'blocklist',
  data: QqbotApi.PermissionBody,
) {
  return requestClient.post<boolean>(`/qqbot/permission/${kind}/update`, data);
}

export function deleteQqbotPermission(
  kind: 'allowlist' | 'blocklist',
  id: string,
) {
  return requestClient.post<boolean>(
    `/qqbot/permission/${kind}/delete?id=${id}`,
  );
}
