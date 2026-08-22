import type { BotApi } from './index';

import { requestClient } from '#/api/request';

export namespace TencentBotApi {
  export interface PluginBinding {
    accountId: string;
    bound: boolean;
    description?: string;
    id?: null | string;
    operationCount: number;
    pluginKey: string;
    pluginName: string;
    triggerMode: 'command' | 'event';
    version: string;
  }

  export interface MenuSyncResult {
    menuUpdated: number;
    panelsCreated: number;
    panelsDeleted: number;
    panelsUpdated: number;
  }

  export interface PluginMutationResult {
    bindingId?: string;
    menuSync: MenuSyncResult;
    unbound?: boolean;
  }
}

/**
 * 按筛选和分页条件读取 Tencent WebSocket 与 Webhook 连接，保持两种模式同一列表合同。
 * @param params - 列表筛选与分页参数。
 * @returns Tencent 账号分页。
 */
export function getTencentBotList(params?: Record<string, unknown>) {
  return requestClient.get<BotApi.PageResult<BotApi.Account>>(
    '/bot-adapter/tencent/list',
    { params },
  );
}

/**
 * 将 AppID、密钥和传输模式提交到 Tencent 适配器创建入口。
 * @param data - AppID、AppSecret、传输模式和显示信息。
 * @returns 新账号主键。
 */
export function saveTencentBot(data: BotApi.AccountBody) {
  return requestClient.post<string>('/bot-adapter/tencent/save', data);
}

/**
 * 将带主键的 Tencent 配置提交到重建运行态的更新入口。
 * @param data - 携带账号主键的连接配置。
 * @returns 更新确认。
 */
export function updateTencentBot(data: BotApi.AccountBody & { id: string }) {
  return requestClient.post<boolean>('/bot-adapter/tencent/update', data);
}

/**
 * 按内部主键停止并删除 Tencent 连接及其适配器资源。
 * @param id - 内部账号主键。
 * @returns 删除结果。
 */
export function deleteTencentBot(id: string) {
  return requestClient.post<{ deletedContainers: number }>(
    `/bot-adapter/tencent/delete?id=${encodeURIComponent(id)}`,
  );
}

/**
 * 按当前 WebSocket 或 Webhook 模式重建指定 Tencent 运行态。
 * @param id - 内部账号主键。
 * @returns 重连或凭据验证结果。
 */
export function reconnectTencentBot(id: string) {
  return requestClient.post<Record<string, unknown>>(
    `/bot-adapter/tencent/reconnect?id=${encodeURIComponent(id)}`,
  );
}

/**
 * 读取 Webhook 模式官方回调 URL。
 * @param id - 内部账号主键。
 * @returns 完整 HTTPS 回调地址。
 */
export function getTencentWebhookUrl(id: string) {
  return requestClient.get<{ url: string }>(
    `/bot-adapter/tencent/webhook-url?id=${encodeURIComponent(id)}`,
  );
}

/**
 * 读取 Tencent 账号可用插件及绑定状态。
 * @param accountId - 内部账号主键。
 * @returns 协议插件绑定候选。
 */
export function getTencentPluginBindings(accountId: string) {
  return requestClient.get<TencentBotApi.PluginBinding[]>(
    '/bot-adapter/tencent/plugins',
    { params: { accountId } },
  );
}

/**
 * 绑定协议插件并同步 Tencent 官方菜单。
 * @param accountId - 内部账号主键。
 * @param pluginKey - 平台无关插件键。
 * @returns 绑定与菜单同步结果。
 */
export function bindTencentPlugin(accountId: string, pluginKey: string) {
  return requestClient.post<TencentBotApi.PluginMutationResult>(
    '/bot-adapter/tencent/plugins/bind',
    { accountId, pluginKey },
  );
}

/**
 * 解绑协议插件并同步 Tencent 官方菜单。
 * @param accountId - 内部账号主键。
 * @param pluginKey - 平台无关插件键。
 * @returns 解绑与菜单同步结果。
 */
export function unbindTencentPlugin(accountId: string, pluginKey: string) {
  return requestClient.post<TencentBotApi.PluginMutationResult>(
    '/bot-adapter/tencent/plugins/unbind',
    { accountId, pluginKey },
  );
}

/**
 * 按当前绑定幂等重建 Tencent 官方菜单。
 * @param accountId - 内部账号主键。
 * @returns 菜单同步变更计数。
 */
export function syncTencentMenu(accountId: string) {
  return requestClient.post<TencentBotApi.MenuSyncResult>(
    `/bot-adapter/tencent/menu/sync?accountId=${encodeURIComponent(accountId)}`,
  );
}
