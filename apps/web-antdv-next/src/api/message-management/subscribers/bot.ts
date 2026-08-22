import type { MessageManagementApi } from '../index';

import type { BotApi } from '#/api/bot';

import { requestClient } from '#/api/request';

export namespace BotMessageSubscriberApi {
  export type TargetType = 'group' | 'private';

  export interface PublishTargetInput {
    targetId: string;
    targetName?: string;
    targetType: TargetType;
  }

  export interface PublishBindingInput {
    enabled: boolean;
    subscriptionId: string;
    targets: PublishTargetInput[];
  }

  export interface TargetOption {
    label: string;
    targetId: string;
    targetType: TargetType;
  }

  export interface TargetOptionsResponse {
    available: boolean;
    connectionMode: BotApi.ConnectionMode | null;
    manualEntry: boolean;
    options: TargetOption[];
    reasonCode: null | string;
  }

  export interface PublishTargetView {
    enabled: boolean;
    id: string;
    targetId: string;
    targetName: null | string;
    targetType: TargetType;
  }

  export interface PublishBindingView {
    available: boolean;
    createTime: string;
    enabled: boolean;
    id: string;
    invalidReasonCode: null | string;
    sourceKey: string;
    sourceName: string;
    subscriptionId: string;
    subscriptionName: string;
    targets: PublishTargetView[];
    templates: MessageManagementApi.MessageTemplateReference[];
    updateTime: string;
  }
}

const accountSubscriberPath = (selfId: string) =>
  `/message-management/subscribers/bot/accounts/${encodeURIComponent(selfId)}`;

/**
 * 读取指定 Bot 账号对统一消息订阅的私有投递配置。
 *
 * @param selfId - Bot 账号稳定标识。
 * @returns 账号订阅配置、全部模板摘要和 QQ 投递目标数组。
 */
export function getBotMessageBindings(selfId: string) {
  return requestClient.get<BotMessageSubscriberApi.PublishBindingView[]>(
    `${accountSubscriberPath(selfId)}/bindings`,
  );
}

/**
 * 把统一订阅挂到指定 Bot 账号及目标，模板选择权继续留在通用订阅。
 *
 * @param selfId - Bot 账号稳定标识。
 * @param data - 通用订阅、启用状态和 QQ 投递目标集合。
 * @returns 创建后的 Bot 订阅者配置视图。
 */
export function createBotMessageBinding(
  selfId: string,
  data: BotMessageSubscriberApi.PublishBindingInput,
) {
  return requestClient.post<BotMessageSubscriberApi.PublishBindingView>(
    `${accountSubscriberPath(selfId)}/bindings`,
    data,
  );
}

/**
 * 原子替换账号对应的统一订阅和 QQ 目标，避免模板字段重新泄漏到渠道配置。
 *
 * @param selfId - Bot 账号稳定标识。
 * @param id - 待更新的 Bot 私有配置标识。
 * @param data - 新的通用订阅、启用状态和 QQ 投递目标集合。
 * @returns 更新后的 Bot 订阅者配置视图。
 */
export function updateBotMessageBinding(
  selfId: string,
  id: string,
  data: BotMessageSubscriberApi.PublishBindingInput,
) {
  return requestClient.put<BotMessageSubscriberApi.PublishBindingView>(
    `${accountSubscriberPath(selfId)}/bindings/${encodeURIComponent(id)}`,
    data,
  );
}

/**
 * 控制该账号绑定是否把后续统一消息展开到 QQ 目标，历史投递不被删除。
 *
 * @param selfId - Bot 账号稳定标识。
 * @param id - 待切换的 Bot 私有配置标识。
 * @param enabled - 目标启用状态。
 * @returns 状态更新后的 Bot 订阅者配置视图。
 */
export function setBotMessageBindingEnabled(
  selfId: string,
  id: string,
  enabled: boolean,
) {
  return requestClient.put<BotMessageSubscriberApi.PublishBindingView>(
    `${accountSubscriberPath(selfId)}/bindings/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

/**
 * 移除账号与统一订阅的渠道关联，并由后端取消该绑定尚未完成的投递。
 *
 * @param selfId - Bot 账号稳定标识。
 * @param id - 待删除的 Bot 私有配置标识。
 * @returns 后端返回的删除确认标志。
 */
export function deleteBotMessageBinding(selfId: string, id: string) {
  return requestClient.delete<boolean>(
    `${accountSubscriberPath(selfId)}/bindings/${encodeURIComponent(id)}`,
  );
}

/**
 * 读取指定 Bot 账号可配置的群聊和私聊目标。
 *
 * @param selfId - Bot 账号稳定标识。
 * @returns 目标能力状态、原因和可选择的 QQ 目标。
 */
export function getBotMessageTargets(selfId: string) {
  return requestClient.get<BotMessageSubscriberApi.TargetOptionsResponse>(
    `${accountSubscriberPath(selfId)}/targets`,
  );
}
