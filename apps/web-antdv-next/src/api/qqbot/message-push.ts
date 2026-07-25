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

export function getMessagePushSources() {
  return requestClient.get<QqbotMessagePushApi.SystemMessageSourceDefinition[]>(
    '/qqbot/message-push/sources',
  );
}

export function getMessagePushSourceDetail(sourceKey: string) {
  return requestClient.get<QqbotMessagePushApi.SystemMessageSourceDefinition>(
    `/qqbot/message-push/sources/${encodeURIComponent(sourceKey)}`,
  );
}

/** 获取指定系统消息源提供的订阅字段候选项。 */
export function getMessagePushSourceOptions(sourceKey: string) {
  return requestClient.get<QqbotMessagePushApi.SystemMessageSourceOptionsResponse>(
    `/qqbot/message-push/sources/${encodeURIComponent(sourceKey)}/subscription-options`,
  );
}

export function getStunMappingPortChangedOptions() {
  return requestClient.get<QqbotMessagePushApi.StunMappingPortChangedOptionsResponse>(
    '/qqbot/message-push/sources/network.stun.mapping-port-changed/options',
  );
}

export function getMessageSubscriptionList(
  params: QqbotMessagePushApi.MessageSubscriptionListQuery,
) {
  return requestClient.get<
    QqbotMessagePushApi.PageResult<QqbotMessagePushApi.MessageSubscriptionView>
  >('/qqbot/message-push/subscriptions', { params });
}

export function createMessageSubscription(
  data: QqbotMessagePushApi.MessageSubscriptionInput,
) {
  return requestClient.post<QqbotMessagePushApi.MessageSubscriptionView>(
    '/qqbot/message-push/subscriptions',
    data,
  );
}

export function updateMessageSubscription(
  id: string,
  data: QqbotMessagePushApi.MessageSubscriptionInput,
) {
  return requestClient.put<QqbotMessagePushApi.MessageSubscriptionView>(
    `/qqbot/message-push/subscriptions/${encodeURIComponent(id)}`,
    data,
  );
}

export function setMessageSubscriptionEnabled(id: string, enabled: boolean) {
  return requestClient.put<QqbotMessagePushApi.MessageSubscriptionView>(
    `/qqbot/message-push/subscriptions/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

export function deleteMessageSubscription(id: string) {
  return requestClient.delete<boolean>(
    `/qqbot/message-push/subscriptions/${encodeURIComponent(id)}`,
  );
}

export function getMessageTemplateList(
  params: QqbotMessagePushApi.MessageTemplateListQuery,
) {
  return requestClient.get<
    QqbotMessagePushApi.PageResult<QqbotMessagePushApi.MessageTemplateView>
  >('/qqbot/message-push/templates', { params });
}

export function createMessageTemplate(
  data: QqbotMessagePushApi.MessageTemplateInput,
) {
  return requestClient.post<QqbotMessagePushApi.MessageTemplateView>(
    '/qqbot/message-push/templates',
    data,
  );
}

export function updateMessageTemplate(
  id: string,
  data: QqbotMessagePushApi.MessageTemplateInput,
) {
  return requestClient.put<QqbotMessagePushApi.MessageTemplateView>(
    `/qqbot/message-push/templates/${encodeURIComponent(id)}`,
    data,
  );
}

export function setMessageTemplateEnabled(id: string, enabled: boolean) {
  return requestClient.put<QqbotMessagePushApi.MessageTemplateView>(
    `/qqbot/message-push/templates/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

export function deleteMessageTemplate(id: string) {
  return requestClient.delete<boolean>(
    `/qqbot/message-push/templates/${encodeURIComponent(id)}`,
  );
}

export function previewMessageTemplate(
  data: QqbotMessagePushApi.MessageTemplatePreviewInput,
) {
  return requestClient.post<QqbotMessagePushApi.MessageTemplatePreview>(
    '/qqbot/message-push/templates/preview',
    data,
  );
}

export function getAccountMessagePushBindings(selfId: string) {
  return requestClient.get<
    QqbotMessagePushApi.QqbotMessagePublishBindingView[]
  >(`/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/bindings`);
}

export function createAccountMessagePushBinding(
  selfId: string,
  data: QqbotMessagePushApi.QqbotMessagePublishBindingInput,
) {
  return requestClient.post<QqbotMessagePushApi.QqbotMessagePublishBindingView>(
    `/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/bindings`,
    data,
  );
}

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

export function deleteAccountMessagePushBinding(selfId: string, id: string) {
  return requestClient.delete<boolean>(
    `/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/bindings/${encodeURIComponent(id)}`,
  );
}

export function getAccountMessagePushTargets(selfId: string) {
  return requestClient.get<QqbotMessagePushApi.QqbotMessagePushTargetOptionsResponse>(
    `/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/targets`,
  );
}
