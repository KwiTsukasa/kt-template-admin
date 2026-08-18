import { requestClient } from '#/api/request';

export namespace MessageManagementApi {
  export type SystemMessageScalar = boolean | null | number | string;

  export interface MessageSubscriberDefinition {
    description: string;
    displayName: string;
    subscriberKey: string;
    version: 1;
  }

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

  export interface MessageTemplateReference {
    id: string;
    name: string;
    sortOrder: number;
  }

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
    subscriberKey: string;
    subscriberName: string;
    templates: MessageTemplateReference[];
    updateTime: string;
    valid: boolean;
  }

  export interface MessageSubscriptionListQuery {
    enabled?: boolean;
    name?: string;
    pageNo?: number;
    pageSize?: number;
    sourceKey?: string;
    subscriberKey?: string;
    templateId?: string;
  }

  export interface MessageSubscriptionInput {
    enabled: boolean;
    name: string;
    remark?: string;
    sourceConfig: Record<string, string>;
    subscriberKey: string;
    templateIds: string[];
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

  export interface PageResult<T> {
    items: T[];
    total: number;
  }
}

/**
 * 让订阅表单只从服务端注册表选择接收方，避免前端硬编码 QQBot 或站内信渠道。
 *
 * @returns 可供消息订阅选择的订阅者定义数组。
 */
export function getMessageSubscribers() {
  return requestClient.get<MessageManagementApi.MessageSubscriberDefinition[]>(
    '/message-management/subscribers',
  );
}

/**
 * 返回注册表的字段、变量和版本快照，客户端不内置 STUN 或 TCP 专有字段。
 *
 * @returns 消息源字段、模板变量及版本定义数组。
 */
export function getMessageSources() {
  return requestClient.get<
    MessageManagementApi.SystemMessageSourceDefinition[]
  >('/message-management/sources');
}

/**
 * 按来源键读取消息源字段和模板变量定义。
 *
 * @param sourceKey - 消息管理注册的稳定来源键。
 * @returns 指定消息源的公开协议定义。
 */
export function getMessageSourceDetail(sourceKey: string) {
  return requestClient.get<MessageManagementApi.SystemMessageSourceDefinition>(
    `/message-management/sources/${encodeURIComponent(sourceKey)}`,
  );
}

/**
 * 把来源适配器的动态候选投影为通用字段集合，供同一订阅表单按依赖过滤。
 *
 * @param sourceKey - 消息管理注册的稳定来源键。
 * @returns 按字段集合分组的候选项与依赖元数据。
 */
export function getMessageSourceOptions(sourceKey: string) {
  return requestClient.get<MessageManagementApi.SystemMessageSourceOptionsResponse>(
    `/message-management/sources/${encodeURIComponent(sourceKey)}/subscription-options`,
  );
}

/**
 * 按模板、订阅者、来源和分页条件读取统一消息订阅。
 *
 * @param params - 消息订阅筛选与分页字段。
 * @returns 包含多模板和唯一订阅者信息的订阅分页。
 */
export function getMessageSubscriptionList(
  params: MessageManagementApi.MessageSubscriptionListQuery,
) {
  return requestClient.get<
    MessageManagementApi.PageResult<MessageManagementApi.MessageSubscriptionView>
  >('/message-management/subscriptions', { params });
}

/**
 * 把有序同源模板集合、唯一订阅者和来源配置提交为一个统一路由规则。
 *
 * @param data - 模板集合、订阅者、来源配置和管理字段。
 * @returns 创建后的统一消息订阅视图。
 */
export function createMessageSubscription(
  data: MessageManagementApi.MessageSubscriptionInput,
) {
  return requestClient.post<MessageManagementApi.MessageSubscriptionView>(
    '/message-management/subscriptions',
    data,
  );
}

/**
 * 原子替换统一路由规则的模板集合、订阅者和来源配置，避免部分更新留下旧绑定。
 *
 * @param id - 待更新的消息订阅标识。
 * @param data - 新的模板集合、订阅者、来源配置和管理字段。
 * @returns 更新后的统一消息订阅视图。
 */
export function updateMessageSubscription(
  id: string,
  data: MessageManagementApi.MessageSubscriptionInput,
) {
  return requestClient.put<MessageManagementApi.MessageSubscriptionView>(
    `/message-management/subscriptions/${encodeURIComponent(id)}`,
    data,
  );
}

/**
 * `enabled=false` 仅停止匹配新事件，不删除模板关联、既有消息或渠道投递历史。
 *
 * @param id - 待切换的消息订阅标识。
 * @param enabled - 目标启用状态。
 * @returns 状态更新后的统一消息订阅视图。
 */
export function setMessageSubscriptionEnabled(id: string, enabled: boolean) {
  return requestClient.put<MessageManagementApi.MessageSubscriptionView>(
    `/message-management/subscriptions/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

/**
 * 仅在具体订阅者没有私有绑定时移除统一路由规则，防止产生悬空配置。
 *
 * @param id - 待删除的消息订阅标识。
 * @returns 后端返回的删除确认标志。
 */
export function deleteMessageSubscription(id: string) {
  return requestClient.delete<boolean>(
    `/message-management/subscriptions/${encodeURIComponent(id)}`,
  );
}

/**
 * 按来源、名称、状态和分页条件读取消息模板。
 *
 * @param params - 消息模板筛选与分页字段。
 * @returns 包含来源与统一订阅引用数的模板分页。
 */
export function getMessageTemplateList(
  params: MessageManagementApi.MessageTemplateListQuery,
) {
  return requestClient.get<
    MessageManagementApi.PageResult<MessageManagementApi.MessageTemplateView>
  >('/message-management/templates', { params });
}

/**
 * 把来源键与模板正文一起交给消息管理，使后续订阅只能组合兼容模板。
 *
 * @param data - 模板名称、来源、正文、状态和备注。
 * @returns 创建后的消息模板视图。
 */
export function createMessageTemplate(
  data: MessageManagementApi.MessageTemplateInput,
) {
  return requestClient.post<MessageManagementApi.MessageTemplateView>(
    '/message-management/templates',
    data,
  );
}

/**
 * 用完整输入替换模板来源与正文，使变量校验始终基于同一来源合同。
 *
 * @param id - 待更新的消息模板标识。
 * @param data - 新的模板来源、正文和管理字段。
 * @returns 更新后的消息模板视图。
 */
export function updateMessageTemplate(
  id: string,
  data: MessageManagementApi.MessageTemplateInput,
) {
  return requestClient.put<MessageManagementApi.MessageTemplateView>(
    `/message-management/templates/${encodeURIComponent(id)}`,
    data,
  );
}

/**
 * 控制模板能否参与后续统一消息转换，既有事件和投递快照保持不变。
 *
 * @param id - 待切换的消息模板标识。
 * @param enabled - 目标启用状态。
 * @returns 状态更新后的消息模板视图。
 */
export function setMessageTemplateEnabled(id: string, enabled: boolean) {
  return requestClient.put<MessageManagementApi.MessageTemplateView>(
    `/message-management/templates/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

/**
 * 仅在没有订阅关联时移除模板，避免破坏多模板订阅的完整集合。
 *
 * @param id - 待删除的消息模板标识。
 * @returns 后端返回的删除确认标志。
 */
export function deleteMessageTemplate(id: string) {
  return requestClient.delete<boolean>(
    `/message-management/templates/${encodeURIComponent(id)}`,
  );
}

/**
 * 请求后端以注册来源的示例变量解析 `${{...}}`，确保结果与正式渲染器一致。
 *
 * @param data - 模板正文和消息来源键。
 * @returns 渲染结果及本次代入的变量快照。
 */
export function previewMessageTemplate(
  data: MessageManagementApi.MessageTemplatePreviewInput,
) {
  return requestClient.post<MessageManagementApi.MessageTemplatePreview>(
    '/message-management/templates/preview',
    data,
  );
}
