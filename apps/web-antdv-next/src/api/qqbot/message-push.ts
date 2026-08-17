import { requestClient } from '#/api/request';

export namespace QqbotMessagePushApi {
  export type SystemMessageScalar = boolean | null | number | string;

  export type QqbotMessagePushTargetType = 'group' | 'private';

  export interface SystemMessageSourceVariableDefinition {
    description: string;
    example: string;
    key: string;
    label: string;
    type: 'boolean' | 'number' | 'string';
  }

  export interface SystemMessageSourceFieldDefinition {
    dependsOn?: string;
    key: string;
    label: string;
    optionCollection: string;
    required: boolean;
    type: 'select';
  }

  export interface SystemMessageSourceDefinition {
    description: string;
    displayName: string;
    sourceKey: string;
    subscriptionFields: SystemMessageSourceFieldDefinition[];
    variables: SystemMessageSourceVariableDefinition[];
    version: 1;
  }

  export interface StunMappingPortChangedSubscriptionConfig {
    ddnsRecordId: string;
    portForwardId: string;
  }

  export interface StunMappingPortChangedOptionsResponse {
    ddnsRecords: Array<{
      disabledReasonCode: null | string;
      eligible: boolean;
      fqdn: string;
      id: string;
      name: string;
      portForwardId: string;
    }>;
    portForwards: Array<{
      disabledReasonCode: null | string;
      eligible: boolean;
      externalPort: number;
      id: string;
      internalPort: number;
      name: string;
      protocol: 'tcp' | 'udp';
    }>;
  }

  export interface SystemMessageSourceOptionDefinition {
    dependsOnValue?: string;
    disabled: boolean;
    disabledReasonCode: null | string;
    label: string;
    value: string;
  }

  export type SystemMessageSourceOptionsResponse = Record<
    string,
    SystemMessageSourceOptionDefinition[]
  >;

  export interface MessageSubscriptionView {
    createTime: string;
    enabled: boolean;
    id: string;
    invalidReasonCode: null | string;
    name: string;
    remark: null | string;
    sourceConfig: Record<string, string>;
    sourceKey: string;
    sourceName: string;
    sourceSummary: string;
    updateTime: string;
    valid: boolean;
  }

  export interface MessageSubscriptionListQuery {
    enabled?: boolean;
    name?: string;
    pageNo?: number;
    pageSize?: number;
    sourceKey?: string;
  }

  export interface MessageSubscriptionInput {
    enabled: boolean;
    name: string;
    remark?: string;
    sourceConfig: Record<string, string>;
    sourceKey: string;
  }

  export interface MessageTemplateView {
    content: string;
    createTime: string;
    enabled: boolean;
    id: string;
    name: string;
    referenceCount: number;
    remark: null | string;
    sourceKey: string;
    sourceName: string;
    updateTime: string;
  }

  export interface MessageTemplateListQuery {
    enabled?: boolean;
    name?: string;
    pageNo?: number;
    pageSize?: number;
    sourceKey?: string;
  }

  export interface MessageTemplateInput {
    content: string;
    enabled: boolean;
    name: string;
    remark?: string;
    sourceKey: string;
  }

  export interface MessageTemplatePreviewInput {
    content: string;
    sourceKey: string;
  }

  export interface MessageTemplatePreview {
    renderedMessage: string;
    variables: Record<string, boolean | number | string>;
  }

  export interface QqbotMessagePublishTargetInput {
    targetId: string;
    targetName?: string;
    targetType: QqbotMessagePushTargetType;
  }

  export interface QqbotMessagePublishBindingInput {
    enabled: boolean;
    subscriptionId: string;
    targets: QqbotMessagePublishTargetInput[];
    templateId: string;
  }

  export interface QqbotMessagePushTargetOption {
    label: string;
    targetId: string;
    targetType: QqbotMessagePushTargetType;
  }

  export interface QqbotMessagePushTargetOptionsResponse {
    available: boolean;
    options: QqbotMessagePushTargetOption[];
    reasonCode: null | string;
  }

  export interface QqbotMessagePublishTargetView {
    enabled: boolean;
    id: string;
    targetId: string;
    targetName: null | string;
    targetType: QqbotMessagePushTargetType;
  }

  export interface QqbotMessagePublishBindingView {
    available: boolean;
    createTime: string;
    enabled: boolean;
    id: string;
    invalidReasonCode: null | string;
    sourceKey: string;
    sourceName: string;
    subscriptionId: string;
    subscriptionName: string;
    targets: QqbotMessagePublishTargetView[];
    templateId: string;
    templateName: string;
    updateTime: string;
  }

  export interface PageResult<T> {
    items: T[];
    total: number;
  }
}

/**
 * 从后端读取系统消息来源定义及其订阅字段、模板变量和版本信息。
 *
 * @returns 系统消息来源定义数组，包含订阅字段、模板变量和版本；没有来源时为空数组。
 */
export function getMessagePushSources() {
  return requestClient.get<QqbotMessagePushApi.SystemMessageSourceDefinition[]>(
    '/qqbot/message-push/sources',
  );
}

/**
 * 根据来源键读取订阅字段与模板变量定义。
 *
 * @param sourceKey - 消息推送来源的稳定键名。
 * @returns 指定来源的展示信息、订阅字段和模板变量定义。
 */
export function getMessagePushSourceDetail(sourceKey: string) {
  return requestClient.get<QqbotMessagePushApi.SystemMessageSourceDefinition>(
    `/qqbot/message-push/sources/${encodeURIComponent(sourceKey)}`,
  );
}

/**
 * 获取指定系统消息源提供的订阅字段候选项。
 *
 * @param sourceKey - 订阅字段候选项所属的系统消息源键。
 * @returns 指定消息源动态订阅字段的候选项与依赖元数据。
 */
export function getMessagePushSourceOptions(sourceKey: string) {
  return requestClient.get<QqbotMessagePushApi.SystemMessageSourceOptionsResponse>(
    `/qqbot/message-push/sources/${encodeURIComponent(sourceKey)}/subscription-options`,
  );
}

/**
 * 读取可用于端口变更订阅的转发组与 DDNS 记录，并标明不可选原因。
 *
 * @returns 可绑定的端口转发与 DDNS 记录，以及每项资格和禁用原因。
 */
export function getStunMappingPortChangedOptions() {
  return requestClient.get<QqbotMessagePushApi.StunMappingPortChangedOptionsResponse>(
    '/qqbot/message-push/sources/network.stun.mapping-port-changed/options',
  );
}

/**
 * 根据来源、名称、启用状态和分页条件读取消息订阅。
 *
 * @param params - 订阅来源、名称、启用状态和分页条件。
 * @returns 包含来源、有效性、启用状态和总数的订阅分页结果。
 */
export function getMessageSubscriptionList(
  params: QqbotMessagePushApi.MessageSubscriptionListQuery,
) {
  return requestClient.get<
    QqbotMessagePushApi.PageResult<QqbotMessagePushApi.MessageSubscriptionView>
  >('/qqbot/message-push/subscriptions', { params });
}

/**
 * 将消息来源、来源字段、启用状态和备注保存为消息订阅。
 *
 * @param data - 订阅名称、消息来源、来源字段配置、启用状态和备注。
 * @returns 持久化后的订阅记录，包含后端分配的标识和有效性状态。
 */
export function createMessageSubscription(
  data: QqbotMessagePushApi.MessageSubscriptionInput,
) {
  return requestClient.post<QqbotMessagePushApi.MessageSubscriptionView>(
    '/qqbot/message-push/subscriptions',
    data,
  );
}

/**
 * 根据订阅标识保存消息来源字段、启用状态和备注。
 *
 * @param id - 需要更新的消息订阅标识。
 * @param data - 待保存的订阅名称、消息来源、来源字段配置和启用状态。
 * @returns 保存后的订阅记录，包含最新来源配置和有效性状态。
 */
export function updateMessageSubscription(
  id: string,
  data: QqbotMessagePushApi.MessageSubscriptionInput,
) {
  return requestClient.put<QqbotMessagePushApi.MessageSubscriptionView>(
    `/qqbot/message-push/subscriptions/${encodeURIComponent(id)}`,
    data,
  );
}

/**
 * 切换指定消息订阅的启用状态，并返回更新后的订阅。
 *
 * @param id - 需要变更启用状态的消息订阅标识。
 * @param enabled - 目标启用状态；true 表示启用，false 表示停用。
 * @returns 写入目标启用状态后的完整订阅记录。
 */
export function setMessageSubscriptionEnabled(id: string, enabled: boolean) {
  return requestClient.put<QqbotMessagePushApi.MessageSubscriptionView>(
    `/qqbot/message-push/subscriptions/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

/**
 * 删除指定消息订阅，并返回后端是否完成删除。
 *
 * @param id - 需要删除的消息订阅标识。
 * @returns 后端返回的删除确认标志；true 表示订阅已移除。
 */
export function deleteMessageSubscription(id: string) {
  return requestClient.delete<boolean>(
    `/qqbot/message-push/subscriptions/${encodeURIComponent(id)}`,
  );
}

/**
 * 根据来源、名称、启用状态和分页条件读取消息模板。
 *
 * @param params - 模板来源、名称、启用状态和分页条件。
 * @returns 包含来源、正文摘要、引用数和总数的模板分页结果。
 */
export function getMessageTemplateList(
  params: QqbotMessagePushApi.MessageTemplateListQuery,
) {
  return requestClient.get<
    QqbotMessagePushApi.PageResult<QqbotMessagePushApi.MessageTemplateView>
  >('/qqbot/message-push/templates', { params });
}

/**
 * 通过消息推送接口持久化来源、正文、启用状态和备注，并取得可供订阅引用的模板记录。
 *
 * @param data - 模板名称、消息来源、模板正文、启用状态和备注。
 * @returns 持久化后的模板记录，包含后端分配的标识和引用数。
 */
export function createMessageTemplate(
  data: QqbotMessagePushApi.MessageTemplateInput,
) {
  return requestClient.post<QqbotMessagePushApi.MessageTemplateView>(
    '/qqbot/message-push/templates',
    data,
  );
}

/**
 * 根据模板标识保存消息来源、正文、启用状态和备注。
 *
 * @param id - 需要更新的消息模板标识。
 * @param data - 待保存的模板名称、消息来源、正文和启用状态。
 * @returns 保存后的模板记录，包含最新正文、来源和启用状态。
 */
export function updateMessageTemplate(
  id: string,
  data: QqbotMessagePushApi.MessageTemplateInput,
) {
  return requestClient.put<QqbotMessagePushApi.MessageTemplateView>(
    `/qqbot/message-push/templates/${encodeURIComponent(id)}`,
    data,
  );
}

/**
 * 切换指定消息模板的启用状态，并返回更新后的模板。
 *
 * @param id - 需要变更启用状态的消息模板标识。
 * @param enabled - 目标启用状态；true 表示启用，false 表示停用。
 * @returns 写入目标启用状态后的完整模板记录。
 */
export function setMessageTemplateEnabled(id: string, enabled: boolean) {
  return requestClient.put<QqbotMessagePushApi.MessageTemplateView>(
    `/qqbot/message-push/templates/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

/**
 * 删除指定消息模板，并返回后端是否完成删除。
 *
 * @param id - 需要删除的消息模板标识。
 * @returns 后端返回的删除确认标志；true 表示模板已移除。
 */
export function deleteMessageTemplate(id: string) {
  return requestClient.delete<boolean>(
    `/qqbot/message-push/templates/${encodeURIComponent(id)}`,
  );
}

/**
 * 在不持久化模板的情况下渲染消息正文，并返回变量取值。
 *
 * @param data - 待渲染的模板正文及其消息来源键。
 * @returns 不持久化的渲染消息文本及本次代入的变量键值。
 */
export function previewMessageTemplate(
  data: QqbotMessagePushApi.MessageTemplatePreviewInput,
) {
  return requestClient.post<QqbotMessagePushApi.MessageTemplatePreview>(
    '/qqbot/message-push/templates/preview',
    data,
  );
}

/**
 * 从后端读取指定 QQBot 账号的订阅、模板、目标与可用状态绑定。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @returns 指定账号的订阅、模板与目标绑定数组；没有绑定时为空数组。
 */
export function getAccountMessagePushBindings(selfId: string) {
  return requestClient.get<
    QqbotMessagePushApi.QqbotMessagePublishBindingView[]
  >(`/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/bindings`);
}

/**
 * 将订阅、模板和一个或多个投递目标绑定到 QQBot 账号。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @param data - 订阅、模板、群聊或私聊目标集合及绑定启用状态。
 * @returns 持久化后的账号推送绑定，包含目标明细和可用性状态。
 */
export function createAccountMessagePushBinding(
  selfId: string,
  data: QqbotMessagePushApi.QqbotMessagePublishBindingInput,
) {
  return requestClient.post<QqbotMessagePushApi.QqbotMessagePublishBindingView>(
    `/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/bindings`,
    data,
  );
}

/**
 * 根据提交内容更新 QQBot 账号现有推送绑定的订阅、模板、目标与启用状态。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @param id - 需要更新的账号消息推送绑定标识。
 * @param data - 待保存的订阅、模板、推送目标集合和启用状态。
 * @returns 保存后的账号推送绑定，包含最新订阅、模板、目标和可用性状态。
 */
export function updateAccountMessagePushBinding(
  selfId: string,
  id: string,
  data: QqbotMessagePushApi.QqbotMessagePublishBindingInput,
) {
  return requestClient.put<QqbotMessagePushApi.QqbotMessagePublishBindingView>(
    `/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/bindings/${encodeURIComponent(id)}`,
    data,
  );
}

/**
 * 切换指定账号推送绑定的启用状态，并返回更新后的绑定。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @param id - 需要变更启用状态的账号消息推送绑定标识。
 * @param enabled - 目标启用状态；true 表示启用，false 表示停用。
 * @returns 写入目标启用状态后的完整账号推送绑定。
 */
export function setAccountMessagePushBindingEnabled(
  selfId: string,
  id: string,
  enabled: boolean,
) {
  return requestClient.put<QqbotMessagePushApi.QqbotMessagePublishBindingView>(
    `/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/bindings/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

/**
 * 删除 QQBot 账号的指定推送绑定，并返回后端是否完成删除。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @param id - 需要从账号移除的消息推送绑定标识。
 * @returns 后端返回的删除确认标志；true 表示账号绑定已移除。
 */
export function deleteAccountMessagePushBinding(selfId: string, id: string) {
  return requestClient.delete<boolean>(
    `/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/bindings/${encodeURIComponent(id)}`,
  );
}

/**
 * 读取 QQBot 账号可选的私聊或群聊目标，并说明目标能力不可用原因。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @returns 目标能力是否可用、不可用原因及可选私聊或群聊目标。
 */
export function getAccountMessagePushTargets(selfId: string) {
  return requestClient.get<QqbotMessagePushApi.QqbotMessagePushTargetOptionsResponse>(
    `/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/targets`,
  );
}
