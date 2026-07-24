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
    optionCollection: 'ddnsRecords' | 'portForwards';
    required: true;
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

  export interface MessageSubscriptionView {
    createTime: string;
    enabled: boolean;
    id: string;
    invalidReasonCode: null | string;
    name: string;
    remark: null | string;
    sourceConfig: StunMappingPortChangedSubscriptionConfig;
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
    sourceConfig: Record<string, unknown>;
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
 * Lists registered system message sources available to the Admin UI.
 * @returns Public source definitions without internal adapter details.
 */
export function getMessagePushSources() {
  return requestClient.get<QqbotMessagePushApi.SystemMessageSourceDefinition[]>(
    '/qqbot/message-push/sources',
  );
}

/**
 * Loads one public source definition by its stable source key.
 * @param sourceKey - String source identity, encoded before becoming a URL segment.
 * @returns The requested source definition.
 */
export function getMessagePushSourceDetail(sourceKey: string) {
  return requestClient.get<QqbotMessagePushApi.SystemMessageSourceDefinition>(
    `/qqbot/message-push/sources/${encodeURIComponent(sourceKey)}`,
  );
}

/**
 * Loads server-evaluated options for the built-in STUN port-change source.
 * @returns Eligible and disabled port-forward and DDNS options.
 */
export function getStunMappingPortChangedOptions() {
  return requestClient.get<QqbotMessagePushApi.StunMappingPortChangedOptionsResponse>(
    '/qqbot/message-push/sources/network.stun.mapping-port-changed/options',
  );
}

/**
 * Pages global message subscriptions using independent list filters.
 * @param params - Pagination, source, name, and enabled-state filters.
 * @returns A strict `{ items, total }` subscription page.
 */
export function getMessageSubscriptionList(
  params: QqbotMessagePushApi.MessageSubscriptionListQuery,
) {
  return requestClient.get<
    QqbotMessagePushApi.PageResult<QqbotMessagePushApi.MessageSubscriptionView>
  >('/qqbot/message-push/subscriptions', { params });
}

/**
 * Creates one source-scoped global message subscription.
 * @param data - Complete subscription name, source, configuration, and enabled state.
 * @returns The persisted subscription view.
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
 * Replaces one global subscription without coercing its string ID.
 * @param id - Stable subscription ID, encoded before becoming a URL segment.
 * @param data - Complete replacement subscription input.
 * @returns The updated subscription view.
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
 * Changes whether a subscription matches future source events.
 * @param id - Stable subscription ID, encoded before becoming a URL segment.
 * @param enabled - Requested future enabled state.
 * @returns The updated subscription view.
 */
export function setMessageSubscriptionEnabled(id: string, enabled: boolean) {
  return requestClient.put<QqbotMessagePushApi.MessageSubscriptionView>(
    `/qqbot/message-push/subscriptions/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

/**
 * Soft-deletes one global message subscription.
 * @param id - Stable subscription ID, encoded before becoming a URL segment.
 * @returns Whether the subscription was deleted.
 */
export function deleteMessageSubscription(id: string) {
  return requestClient.delete<boolean>(
    `/qqbot/message-push/subscriptions/${encodeURIComponent(id)}`,
  );
}

/**
 * Pages global message templates using independent list filters.
 * @param params - Pagination, source, name, and enabled-state filters.
 * @returns A strict `{ items, total }` template page.
 */
export function getMessageTemplateList(
  params: QqbotMessagePushApi.MessageTemplateListQuery,
) {
  return requestClient.get<
    QqbotMessagePushApi.PageResult<QqbotMessagePushApi.MessageTemplateView>
  >('/qqbot/message-push/templates', { params });
}

/**
 * Creates one source-scoped global message template.
 * @param data - Complete template content, source, metadata, and enabled state.
 * @returns The persisted template view.
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
 * Replaces one global message template without coercing its string ID.
 * @param id - Stable template ID, encoded before becoming a URL segment.
 * @param data - Complete replacement template input.
 * @returns The updated template view.
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
 * Changes whether a template can be selected for future bindings and events.
 * @param id - Stable template ID, encoded before becoming a URL segment.
 * @param enabled - Requested future enabled state.
 * @returns The updated template view.
 */
export function setMessageTemplateEnabled(id: string, enabled: boolean) {
  return requestClient.put<QqbotMessagePushApi.MessageTemplateView>(
    `/qqbot/message-push/templates/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

/**
 * Soft-deletes one global message template when the backend permits it.
 * @param id - Stable template ID, encoded before becoming a URL segment.
 * @returns Whether the template was deleted.
 */
export function deleteMessageTemplate(id: string) {
  return requestClient.delete<boolean>(
    `/qqbot/message-push/templates/${encodeURIComponent(id)}`,
  );
}

/**
 * Renders a source-scoped message template using server-controlled example data.
 * @param data - Template content and source identity only.
 * @returns Safe rendered text and the example variables used.
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
 * Lists message-push bindings belonging to exactly one QQBot account.
 * @param selfId - QQBot self ID kept as a string and encoded in the URL.
 * @returns Account-scoped binding views with their configured targets.
 */
export function getAccountMessagePushBindings(selfId: string) {
  return requestClient.get<
    QqbotMessagePushApi.QqbotMessagePublishBindingView[]
  >(`/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/bindings`);
}

/**
 * Creates one account-scoped binding from a global subscription and template.
 * @param selfId - QQBot self ID kept as a string and encoded in the URL.
 * @param data - Subscription, template, target, and enabled-state input.
 * @returns The persisted account binding view.
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
 * Replaces one binding for exactly one QQBot account.
 * @param selfId - QQBot self ID kept as a string and encoded in the URL.
 * @param id - Stable binding ID, encoded before becoming a URL segment.
 * @param data - Subscription, template, target, and enabled-state input.
 * @returns The updated account binding view.
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
 * Changes whether one account binding creates future delivery work.
 * @param selfId - QQBot self ID kept as a string and encoded in the URL.
 * @param id - Stable binding ID, encoded before becoming a URL segment.
 * @param enabled - Requested future enabled state.
 * @returns The updated account binding view.
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
 * Soft-deletes one binding from exactly one QQBot account.
 * @param selfId - QQBot self ID kept as a string and encoded in the URL.
 * @param id - Stable binding ID, encoded before becoming a URL segment.
 * @returns Whether the account binding was deleted.
 */
export function deleteAccountMessagePushBinding(selfId: string, id: string) {
  return requestClient.delete<boolean>(
    `/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/bindings/${encodeURIComponent(id)}`,
  );
}

/**
 * Lists group and private-message target choices for exactly one QQBot account.
 * @param selfId - QQBot self ID kept as a string and encoded in the URL.
 * @returns Availability state plus currently discoverable string-ID targets.
 */
export function getAccountMessagePushTargets(selfId: string) {
  return requestClient.get<QqbotMessagePushApi.QqbotMessagePushTargetOptionsResponse>(
    `/qqbot/accounts/${encodeURIComponent(selfId)}/message-push/targets`,
  );
}
