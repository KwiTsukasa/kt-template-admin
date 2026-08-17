import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace QqbotApi {
  export type PluginTriggerMode = 'command' | 'event';
  export type OneBotStatus = 'offline' | 'online';
  export type WebuiStatus = 'offline' | 'online' | 'unknown';
  export type QqLoginStatus =
    | 'offline'
    | 'online'
    | 'qrcode_expired'
    | 'qrcode_pending'
    | 'unknown';

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
    containerStatus?: AccountNapcatRuntime['containerStatus'];
    createTime?: string;
    enabled: boolean;
    id: string;
    lastConnectedAt?: string;
    lastError?: string;
    lastHeartbeatAt?: string;
    name: string;
    napcat?: AccountNapcatRuntime | null;
    oneBotStatus?: OneBotStatus;
    qqLoginMessage?: null | string;
    qqLoginStatus?: QqLoginStatus;
    remark?: string;
    selfId: string;
    webuiStatus?: WebuiStatus;
  }

  export interface AccountNapcatRuntime {
    bindStatus?: 'bound' | 'disabled' | 'pending';
    containerId?: string;
    containerName?: string;
    containerOnline?: boolean;
    containerStatus?: 'creating' | 'error' | 'running' | 'stopped';
    profileStatus?: 'drift' | 'failed' | 'ok' | 'unknown';
    recoveryState?: 'idle' | 'password' | 'quick' | 'suspended';
    riskMode?: 'cooldown' | 'manual_only' | 'normal';
    runtimeProfile?: {
      desktopProfileVersion?: string;
      imageDigest?: string;
      imageRef?: string;
      locale?: string;
      shmSize?: string;
    };
    lastCheckedAt?: string;
    lastError?: string;
    lastLoginAt?: string;
    lastStartedAt?: string;
    oneBotOnline?: boolean;
    qqLoginMessage?: null | string;
    qqLoginStatus?: QqLoginStatus;
    webuiOnline?: boolean | null;
    webuiPort?: null | number;
  }

  export interface AccountBody {
    accessToken?: string;
    connectionMode?: 'reverse-ws';
    enabled?: boolean;
    id?: string;
    loginPassword?: null | string;
    name?: string;
    remark?: string;
    selfId: string;
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

  export interface Command {
    aliases: string[];
    code: string;
    cooldownMs: number;
    defaultParams?: Recordable<any>;
    enabled: boolean;
    errorTemplate?: string;
    id: string;
    lastHitAt?: string;
    name: string;
    operationKey: string;
    parserKey: 'ff14Price' | 'plain';
    pluginKey: string;
    prefixes: string[];
    priority: number;
    remark?: string;
    replyTemplate?: string;
    targetType: 'all' | 'channel' | 'group' | 'private';
  }

  export interface CommandBody {
    aliases?: string | string[];
    code: string;
    cooldownMs?: number;
    defaultParams?: Recordable<any> | string;
    enabled?: boolean;
    errorTemplate?: string;
    id?: string;
    name: string;
    operationKey: string;
    parserKey?: 'ff14Price' | 'plain';
    pluginKey: string;
    prefixes?: string | string[];
    priority?: number;
    remark?: string;
    replyTemplate?: string;
    targetType?: 'all' | 'channel' | 'group' | 'private';
  }

  export interface CommandTestResult {
    command?: Command;
    input?: Recordable<any>;
    matched: boolean;
    message?: string;
    output?: Recordable<any>;
    replyText?: string;
  }

  export interface Plugin {
    description?: string;
    key: string;
    name: string;
    operationCount: number;
    triggerMode: PluginTriggerMode;
    version: string;
  }

  export interface PluginOperation {
    cacheTtlMs?: number;
    description?: string;
    inputSchema?: Recordable<any>;
    key: string;
    name: string;
    outputSchema?: Recordable<any>;
    pluginKey: string;
    triggerMode: PluginTriggerMode;
  }

  export interface PluginOperationQuery extends Recordable<any> {
    pageNo?: number;
    pageSize?: number;
    pluginKey?: string;
    triggerMode?: PluginTriggerMode;
  }

  export interface PluginHealth {
    checkedAt: string;
    message?: string;
    name?: string;
    pluginKey?: string;
    status: 'degraded' | 'healthy' | 'offline';
    triggerMode?: PluginTriggerMode;
  }

  export interface EventPlugin {
    accountName?: string;
    bound: boolean;
    connectStatus?: string;
    description?: string;
    key: string;
    name: string;
    remark?: string;
    selfId: string;
    triggerType: 'message';
    version: string;
  }

  export type Query = Recordable<any>;
}

/**
 * 从后端汇总 QQBot 账号在线数、消息与会话数量、投递结果及总线运行状态。
 *
 * @returns 账号、会话、消息、投递与运行总线的数量及状态汇总。
 */
export function getQqbotDashboardSummary() {
  return requestClient.get<QqbotApi.DashboardSummary>(
    '/qqbot/dashboard/summary',
  );
}

/**
 * 根据列表筛选与分页条件读取 QQBot 账号及其连接、登录和容器状态。
 *
 * @param params - QQBot 账号列表使用的状态、关键词和分页条件。
 * @returns 包含账号连接、登录与容器状态及总数的分页结果。
 */
export function getQqbotAccountList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Account>>(
    '/qqbot/account/list',
    { params },
  );
}

/**
 * 从后端读取允许参与命令测试或消息投递的已启用 QQBot 账号。
 *
 * @returns 当前可参与命令或消息操作的已启用账号数组；没有可用账号时为空数组。
 */
export function getQqbotEnabledAccounts() {
  return requestClient.get<QqbotApi.Account[]>('/qqbot/account/enabled');
}

/**
 * 将 QQBot 账号连接配置提交到后端；空登录密码不会下发。
 *
 * @param data - 新账号的 selfId、名称、访问令牌、登录密码和启用状态；空密码不会发送。
 * @returns 后端为新账号记录分配的标识。
 */
export function createQqbotAccount(data: QqbotApi.AccountBody) {
  return requestClient.post<string>(
    '/qqbot/account/save',
    buildAccountRequest(data),
  );
}

/**
 * 保存 QQBot 账号连接与启用状态；空登录密码保持后端现值。
 *
 * @param data - 包含账号标识及待保存 selfId、凭据、名称和启用状态的字段；空密码不会覆盖现值。
 * @returns 后端接受账号配置更新时返回 true，否则返回 false。
 */
export function updateQqbotAccount(data: QqbotApi.AccountBody) {
  return requestClient.post<boolean>(
    '/qqbot/account/update',
    buildAccountRequest(data),
  );
}

/**
 * 把 QQBot 账号字段整理为保存载荷；空登录密码不下发，非空密码统一转成字符串。
 *
 * @param data - 准备创建或更新的 QQBot 账号字段；空登录密码会被移除。
 * @returns 可提交的账号字段；登录密码为空时不包含 `loginPassword`。
 */
function buildAccountRequest(data: QqbotApi.AccountBody) {
  const { loginPassword, ...payload } = data;
  const password = (() => {
    if (loginPassword === undefined || loginPassword === null) {
      return '';
    }
    return `${loginPassword}`;
  })();
  if (password.trim()) {
    return {
      ...payload,
      loginPassword: password,
    };
  }
  return payload;
}

/**
 * 删除 QQBot 账号及其托管容器，并返回被清理的容器数量。
 *
 * @param id - 需要删除并清理关联 NapCat 容器的账号记录标识。
 * @returns 删除账号时一并清理的 NapCat 容器数量。
 */
export function deleteQqbotAccount(id: string) {
  return requestClient.post<{ deletedContainers: number }>(
    `/qqbot/account/delete?id=${id}`,
  );
}

/**
 * 把指定命令绑定到 QQBot 账号，使该账号可以响应对应指令。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @param commandId - 目标 QQBot 命令的唯一标识。
 * @returns 后端成功建立账号与命令绑定时返回 true，否则返回 false。
 */
export function bindQqbotAccountCommand(selfId: string, commandId: string) {
  const params = new URLSearchParams({ commandId, selfId });
  return requestClient.post<boolean>(`/qqbot/account/bind/command?${params}`);
}

/**
 * 解除 QQBot 账号与指定命令的绑定，并返回操作确认。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @param commandId - 目标 QQBot 命令的唯一标识。
 * @returns 后端成功解除账号与命令绑定时返回 true，否则返回 false。
 */
export function unbindQqbotAccountCommand(selfId: string, commandId: string) {
  const params = new URLSearchParams({ commandId, selfId });
  return requestClient.post<boolean>(`/qqbot/account/unbind/command?${params}`);
}

/**
 * 把指定消息规则绑定到 QQBot 账号，使该账号应用该规则。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @param ruleId - 目标 QQBot 规则的唯一标识。
 * @returns 后端成功建立账号与规则绑定时返回 true，否则返回 false。
 */
export function bindQqbotAccountRule(selfId: string, ruleId: string) {
  const params = new URLSearchParams({ ruleId, selfId });
  return requestClient.post<boolean>(`/qqbot/account/bind/rule?${params}`);
}

/**
 * 解除 QQBot 账号与指定消息规则的绑定，并返回操作确认。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @param ruleId - 目标 QQBot 规则的唯一标识。
 * @returns 后端成功解除账号与规则绑定时返回 true，否则返回 false。
 */
export function unbindQqbotAccountRule(selfId: string, ruleId: string) {
  const params = new URLSearchParams({ ruleId, selfId });
  return requestClient.post<boolean>(`/qqbot/account/unbind/rule?${params}`);
}

/**
 * 强制断开指定 QQBot 账号的活动连接，并返回受影响的会话数量。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @returns 强制断开操作影响的活动会话数量。
 */
export function kickQqbotAccount(selfId: string) {
  return requestClient.post<{ count: number }>(
    `/qqbot/account/kick?selfId=${selfId}`,
  );
}

/**
 * 根据筛选与分页条件读取 QQBot 消息匹配规则及启用状态。
 *
 * @param params - QQBot 规则列表使用的状态、关键词和分页条件。
 * @returns 包含消息匹配规则、启用状态及总数的分页结果。
 */
export function getQqbotRuleList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Rule>>(
    '/qqbot/rule/list',
    { params },
  );
}

/**
 * 通过规则保存接口持久化关键词匹配、回复范围、冷却和优先级，并取得后端分配的规则标识。
 *
 * @param data - 新规则的关键字、匹配方式、回复内容、目标范围、冷却和优先级。
 * @returns 新规则持久化后由服务端分配的唯一标识。
 */
export function createQqbotRule(data: QqbotApi.RuleBody) {
  return requestClient.post<string>('/qqbot/rule/save', data);
}

/**
 * 根据规则标识保存匹配条件、响应配置与启用状态。
 *
 * @param data - 包含规则标识及待保存匹配、回复、目标范围和启用配置的字段。
 * @returns 后端接受规则字段更新时返回 true，否则返回 false。
 */
export function updateQqbotRule(data: QqbotApi.RuleBody) {
  return requestClient.post<boolean>('/qqbot/rule/update', data);
}

/**
 * 删除指定 QQBot 规则，并返回后端是否完成删除。
 *
 * @param id - 需要删除的自动回复规则标识。
 * @returns 后端返回的删除确认标志；true 表示规则已移除。
 */
export function deleteQqbotRule(id: string) {
  return requestClient.post<boolean>(`/qqbot/rule/delete?id=${id}`);
}

/**
 * 把指定 QQBot 规则切换到目标启用状态。
 *
 * @param id - 需要变更启用状态的自动回复规则标识。
 * @param enabled - 目标启用状态；true 表示启用，false 表示停用。
 * @returns 后端成功写入目标启用状态时返回 true，否则返回 false。
 */
export function toggleQqbotRule(id: string, enabled: boolean) {
  return requestClient.post<boolean>(
    `/qqbot/rule/toggle?id=${id}&enabled=${enabled}`,
  );
}

/**
 * 根据账号、目标与分页条件读取 QQBot 会话摘要。
 *
 * @param params - QQBot 会话列表使用的账号、目标和分页条件。
 * @returns 包含 QQBot 会话摘要和总数的分页结果。
 */
export function getQqbotConversationList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Conversation>>(
    '/qqbot/conversation/list',
    { params },
  );
}

/**
 * 根据会话、账号与分页条件读取 QQBot 消息记录。
 *
 * @param params - QQBot 消息列表使用的会话、账号和分页条件。
 * @returns 包含 QQBot 消息记录和总数的分页结果。
 */
export function getQqbotMessageList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Message>>(
    '/qqbot/message/list',
    { params },
  );
}

/**
 * 根据账号、目标、结果与分页条件读取 QQBot 消息投递日志。
 *
 * @param params - 投递日志使用的账号、目标、结果和分页条件。
 * @returns 包含消息投递结果、目标、时间和总数的分页结果。
 */
export function getQqbotSendLogList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.SendLog>>(
    '/qqbot/send/log/list',
    { params },
  );
}

/**
 * 通过可选发送账号向指定 QQ 用户投递私聊文本。
 *
 * @param data - 私聊接收用户、消息正文和可选发送账号 selfId。
 * @returns 发送接口返回的私聊投递确认数据。
 */
export function sendQqbotPrivate(data: {
  message: string;
  selfId?: string;
  userId: string;
}) {
  return requestClient.post('/qqbot/send/private', data);
}

/**
 * 通过可选发送账号向指定 QQ 群投递群聊文本。
 *
 * @param data - 群聊接收群号、消息正文和可选发送账号 selfId。
 * @returns 发送接口返回的群聊投递确认数据。
 */
export function sendQqbotGroup(data: {
  groupId: string;
  message: string;
  selfId?: string;
}) {
  return requestClient.post('/qqbot/send/group', data);
}

/**
 * 根据白名单或黑名单类型及分页条件读取 QQBot 权限条目。
 *
 * @param kind - 决定查询白名单或黑名单的列表类型。
 * @param params - 权限目标、关键词和分页条件。
 * @returns 指定名单中的权限条目和总数的分页结果。
 */
export function getQqbotPermissionList(
  kind: 'allowlist' | 'blocklist',
  params: QqbotApi.Query,
) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Permission>>(
    `/qqbot/permission/${kind}`,
    { params },
  );
}

/**
 * 读取 QQBot 名单模式与精确用户配置，供权限表单回填。
 *
 * @returns 当前名单模式、精确用户开关及相关权限配置。
 */
export function getQqbotPermissionConfig() {
  return requestClient.get<QqbotApi.PermissionConfig>(
    '/qqbot/permission/config',
  );
}

/**
 * 合并并保存 QQBot 名单模式或精确用户配置。
 *
 * @param data - 待修改的白名单与黑名单总开关；未提供的开关保持原值。
 * @returns 保存后的白名单与黑名单总开关配置。
 */
export function updateQqbotPermissionConfig(
  data: Partial<QqbotApi.PermissionConfig>,
) {
  return requestClient.post<QqbotApi.PermissionConfig>(
    '/qqbot/permission/config',
    data,
  );
}

/**
 * 根据名单类型在白名单或黑名单中创建权限目标记录。
 *
 * @param kind - 决定把新权限项写入 allowlist 或 blocklist 的名单类型。
 * @param data - 权限目标类型、目标标识、可选账号与精确用户条件及启用状态。
 * @returns 后端为新权限项分配的标识。
 */
export function createQqbotPermission(
  kind: 'allowlist' | 'blocklist',
  data: QqbotApi.PermissionBody,
) {
  return requestClient.post<string>(`/qqbot/permission/${kind}/save`, data);
}

/**
 * 根据名单类型在白名单或黑名单中更新权限目标记录。
 *
 * @param kind - 决定在哪个 allowlist 或 blocklist 接口更新权限项的名单类型。
 * @param data - 包含权限项标识及待保存目标、账号、精确用户条件和启用状态的字段。
 * @returns 后端接受权限项更新时返回 true，否则返回 false。
 */
export function updateQqbotPermission(
  kind: 'allowlist' | 'blocklist',
  data: QqbotApi.PermissionBody,
) {
  return requestClient.post<boolean>(`/qqbot/permission/${kind}/update`, data);
}

/**
 * 从指定白名单或黑名单删除权限目标记录。
 *
 * @param kind - 决定从 allowlist 或 blocklist 中移除权限项的名单类型。
 * @param id - 需要从指定白名单或黑名单移除的权限项标识。
 * @returns 后端成功移除权限项时返回 true，否则返回 false。
 */
export function deleteQqbotPermission(
  kind: 'allowlist' | 'blocklist',
  id: string,
) {
  return requestClient.post<boolean>(
    `/qqbot/permission/${kind}/delete?id=${id}`,
  );
}

/**
 * 根据插件、状态与分页条件读取 QQBot 命令及别名、前缀配置。
 *
 * @param params - 命令插件、启用状态、关键词和分页条件。
 * @returns 包含命令插件操作、别名、前缀、状态和总数的分页结果。
 */
export function getQqbotCommandList(params: QqbotApi.Query) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.Command>>(
    '/qqbot/command/list',
    { params },
  );
}

/**
 * 将插件操作、别名、前缀与默认参数保存为 QQBot 命令配置。
 *
 * @param data - 新命令的代码、插件操作、别名、前缀、解析器、默认参数和回复模板。
 * @returns 后端为新命令记录分配的标识。
 */
export function createQqbotCommand(data: QqbotApi.CommandBody) {
  return requestClient.post<string>('/qqbot/command/save', data);
}

/**
 * 根据命令标识保存插件操作、别名、前缀与默认参数。
 *
 * @param data - 包含命令标识及待保存代码、插件操作、匹配入口和回复配置的字段。
 * @returns 后端接受命令字段更新时返回 true，否则返回 false。
 */
export function updateQqbotCommand(data: QqbotApi.CommandBody) {
  return requestClient.post<boolean>('/qqbot/command/update', data);
}

/**
 * 删除指定 QQBot 命令，并返回后端是否完成删除。
 *
 * @param id - 需要删除的 QQBot 命令标识。
 * @returns 后端返回的删除确认标志；true 表示命令已移除。
 */
export function deleteQqbotCommand(id: string) {
  return requestClient.post<boolean>(`/qqbot/command/delete?id=${id}`);
}

/**
 * 把指定 QQBot 命令切换到目标启用状态。
 *
 * @param id - 需要变更启用状态的 QQBot 命令标识。
 * @param enabled - 目标启用状态；true 表示启用，false 表示停用。
 * @returns 后端成功写入命令目标启用状态时返回 true，否则返回 false。
 */
export function toggleQqbotCommand(id: string, enabled: boolean) {
  return requestClient.post<boolean>(
    `/qqbot/command/toggle?id=${id}&enabled=${enabled}`,
  );
}

/**
 * 用指定账号、命令文本和目标上下文执行一次命令测试，并返回执行输出。
 *
 * @param data - 完整命令文本，以及可选命令、账号、目标和用户上下文。
 * @returns 命令是否匹配、解析输入、插件输出、回复文本及可选错误消息。
 */
export function testQqbotCommand(data: {
  commandId?: string;
  selfId?: string;
  targetId?: string;
  targetType?: 'channel' | 'group' | 'private';
  text: string;
  userId?: string;
}) {
  return requestClient.post<QqbotApi.CommandTestResult>(
    '/qqbot/command/test',
    data,
  );
}
