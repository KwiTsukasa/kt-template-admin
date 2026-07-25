import type { QqbotMessagePushApi } from '@test-source/apps/web-antdv-next/src/api/qqbot/message-push';

import { resolve } from 'node:path';

import * as messagePushApi from '@test-source/apps/web-antdv-next/src/api/qqbot/message-push';
import {
  createAccountMessagePushBinding,
  createMessageSubscription,
  createMessageTemplate,
  deleteAccountMessagePushBinding,
  deleteMessageSubscription,
  deleteMessageTemplate,
  getAccountMessagePushBindings,
  getAccountMessagePushTargets,
  getMessagePushSourceDetail,
  getMessagePushSourceOptions,
  getMessagePushSources,
  getMessageSubscriptionList,
  getMessageTemplateList,
  getStunMappingPortChangedOptions,
  previewMessageTemplate,
  setAccountMessagePushBindingEnabled,
  setMessageSubscriptionEnabled,
  setMessageTemplateEnabled,
  updateAccountMessagePushBinding,
  updateMessageSubscription,
  updateMessageTemplate,
} from '@test-source/apps/web-antdv-next/src/api/qqbot/message-push';
import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

type Equal<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <
    Value,
  >() => Value extends Expected ? 1 : 2
    ? true
    : false;

type Assert<Condition extends true> = Condition;

type ExpectedSystemMessageSourceVariableDefinition = {
  description: string;
  example: string;
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'string';
};

type ExpectedSystemMessageSourceFieldDefinition = {
  dependsOn?: string;
  key: string;
  label: string;
  optionCollection: string;
  required: boolean;
  type: 'select';
};

type ExpectedSystemMessageSourceDefinition = {
  description: string;
  displayName: string;
  sourceKey: string;
  subscriptionFields: ExpectedSystemMessageSourceFieldDefinition[];
  variables: ExpectedSystemMessageSourceVariableDefinition[];
  version: 1;
};

type ExpectedStunMappingPortChangedOptionsResponse = {
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
};

type ExpectedSystemMessageSourceOptionDefinition = {
  dependsOnValue?: string;
  disabled: boolean;
  disabledReasonCode: null | string;
  label: string;
  value: string;
};

type ExpectedSystemMessageSourceOptionsResponse = Record<
  string,
  ExpectedSystemMessageSourceOptionDefinition[]
>;

type ExpectedMessageSubscriptionView = {
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
};

type ExpectedMessageSubscriptionListQuery = {
  enabled?: boolean;
  name?: string;
  pageNo?: number;
  pageSize?: number;
  sourceKey?: string;
};

type ExpectedMessageSubscriptionInput = {
  enabled: boolean;
  name: string;
  remark?: string;
  sourceConfig: Record<string, string>;
  sourceKey: string;
};

type ExpectedMessageTemplateView = {
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
};

type ExpectedMessageTemplateListQuery = ExpectedMessageSubscriptionListQuery;

type ExpectedMessageTemplateInput = {
  content: string;
  enabled: boolean;
  name: string;
  remark?: string;
  sourceKey: string;
};

type ExpectedMessageTemplatePreview = {
  renderedMessage: string;
  variables: Record<string, boolean | number | string>;
};

type ExpectedQqbotMessagePublishBindingInput = {
  enabled: boolean;
  subscriptionId: string;
  targets: Array<{
    targetId: string;
    targetName?: string;
    targetType: 'group' | 'private';
  }>;
  templateId: string;
};

type ExpectedQqbotMessagePushTargetOptionsResponse = {
  available: boolean;
  options: Array<{
    label: string;
    targetId: string;
    targetType: 'group' | 'private';
  }>;
  reasonCode: null | string;
};

type ExpectedQqbotMessagePublishBindingView = {
  available: boolean;
  createTime: string;
  enabled: boolean;
  id: string;
  invalidReasonCode: null | string;
  sourceKey: string;
  sourceName: string;
  subscriptionId: string;
  subscriptionName: string;
  targets: Array<{
    enabled: boolean;
    id: string;
    targetId: string;
    targetName: null | string;
    targetType: 'group' | 'private';
  }>;
  templateId: string;
  templateName: string;
  updateTime: string;
};

type MessagePushTypeContracts = [
  Assert<
    Equal<
      QqbotMessagePushApi.SystemMessageScalar,
      boolean | null | number | string
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.SystemMessageSourceVariableDefinition,
      ExpectedSystemMessageSourceVariableDefinition
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.SystemMessageSourceFieldDefinition,
      ExpectedSystemMessageSourceFieldDefinition
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.SystemMessageSourceDefinition,
      ExpectedSystemMessageSourceDefinition
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.StunMappingPortChangedSubscriptionConfig,
      { ddnsRecordId: string; portForwardId: string }
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.StunMappingPortChangedOptionsResponse,
      ExpectedStunMappingPortChangedOptionsResponse
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.SystemMessageSourceOptionDefinition,
      ExpectedSystemMessageSourceOptionDefinition
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.SystemMessageSourceOptionsResponse,
      ExpectedSystemMessageSourceOptionsResponse
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.MessageSubscriptionView,
      ExpectedMessageSubscriptionView
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.MessageSubscriptionListQuery,
      ExpectedMessageSubscriptionListQuery
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.MessageSubscriptionInput,
      ExpectedMessageSubscriptionInput
    >
  >,
  Assert<
    Equal<QqbotMessagePushApi.MessageTemplateView, ExpectedMessageTemplateView>
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.MessageTemplateListQuery,
      ExpectedMessageTemplateListQuery
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.MessageTemplateInput,
      ExpectedMessageTemplateInput
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.MessageTemplatePreviewInput,
      { content: string; sourceKey: string }
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.MessageTemplatePreview,
      ExpectedMessageTemplatePreview
    >
  >,
  Assert<
    Equal<QqbotMessagePushApi.QqbotMessagePushTargetType, 'group' | 'private'>
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.QqbotMessagePublishTargetInput,
      { targetId: string; targetName?: string; targetType: 'group' | 'private' }
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.QqbotMessagePublishBindingInput,
      ExpectedQqbotMessagePublishBindingInput
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.QqbotMessagePushTargetOption,
      { label: string; targetId: string; targetType: 'group' | 'private' }
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.QqbotMessagePushTargetOptionsResponse,
      ExpectedQqbotMessagePushTargetOptionsResponse
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.QqbotMessagePublishTargetView,
      {
        enabled: boolean;
        id: string;
        targetId: string;
        targetName: null | string;
        targetType: 'group' | 'private';
      }
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.QqbotMessagePublishBindingView,
      ExpectedQqbotMessagePublishBindingView
    >
  >,
  Assert<
    Equal<
      QqbotMessagePushApi.PageResult<ExpectedMessageSubscriptionView>,
      { items: ExpectedMessageSubscriptionView[]; total: number }
    >
  >,
  Assert<Equal<Parameters<typeof getMessagePushSources>, []>>,
  Assert<
    Equal<
      ReturnType<typeof getMessagePushSources>,
      Promise<ExpectedSystemMessageSourceDefinition[]>
    >
  >,
  Assert<
    Equal<Parameters<typeof getMessagePushSourceDetail>, [sourceKey: string]>
  >,
  Assert<
    Equal<
      ReturnType<typeof getMessagePushSourceDetail>,
      Promise<ExpectedSystemMessageSourceDefinition>
    >
  >,
  Assert<
    Equal<Parameters<typeof getMessagePushSourceOptions>, [sourceKey: string]>
  >,
  Assert<
    Equal<
      ReturnType<typeof getMessagePushSourceOptions>,
      Promise<ExpectedSystemMessageSourceOptionsResponse>
    >
  >,
  Assert<Equal<Parameters<typeof getStunMappingPortChangedOptions>, []>>,
  Assert<
    Equal<
      ReturnType<typeof getStunMappingPortChangedOptions>,
      Promise<ExpectedStunMappingPortChangedOptionsResponse>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof getMessageSubscriptionList>,
      [params: ExpectedMessageSubscriptionListQuery]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof getMessageSubscriptionList>,
      Promise<{ items: ExpectedMessageSubscriptionView[]; total: number }>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof createMessageSubscription>,
      [data: ExpectedMessageSubscriptionInput]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof createMessageSubscription>,
      Promise<ExpectedMessageSubscriptionView>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof updateMessageSubscription>,
      [id: string, data: ExpectedMessageSubscriptionInput]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof updateMessageSubscription>,
      Promise<ExpectedMessageSubscriptionView>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof setMessageSubscriptionEnabled>,
      [id: string, enabled: boolean]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof setMessageSubscriptionEnabled>,
      Promise<ExpectedMessageSubscriptionView>
    >
  >,
  Assert<Equal<Parameters<typeof deleteMessageSubscription>, [id: string]>>,
  Assert<Equal<ReturnType<typeof deleteMessageSubscription>, Promise<boolean>>>,
  Assert<
    Equal<
      Parameters<typeof getMessageTemplateList>,
      [params: ExpectedMessageTemplateListQuery]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof getMessageTemplateList>,
      Promise<{ items: ExpectedMessageTemplateView[]; total: number }>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof createMessageTemplate>,
      [data: ExpectedMessageTemplateInput]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof createMessageTemplate>,
      Promise<ExpectedMessageTemplateView>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof updateMessageTemplate>,
      [id: string, data: ExpectedMessageTemplateInput]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof updateMessageTemplate>,
      Promise<ExpectedMessageTemplateView>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof setMessageTemplateEnabled>,
      [id: string, enabled: boolean]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof setMessageTemplateEnabled>,
      Promise<ExpectedMessageTemplateView>
    >
  >,
  Assert<Equal<Parameters<typeof deleteMessageTemplate>, [id: string]>>,
  Assert<Equal<ReturnType<typeof deleteMessageTemplate>, Promise<boolean>>>,
  Assert<
    Equal<
      Parameters<typeof previewMessageTemplate>,
      [data: { content: string; sourceKey: string }]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof previewMessageTemplate>,
      Promise<ExpectedMessageTemplatePreview>
    >
  >,
  Assert<
    Equal<Parameters<typeof getAccountMessagePushBindings>, [selfId: string]>
  >,
  Assert<
    Equal<
      ReturnType<typeof getAccountMessagePushBindings>,
      Promise<ExpectedQqbotMessagePublishBindingView[]>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof createAccountMessagePushBinding>,
      [selfId: string, data: ExpectedQqbotMessagePublishBindingInput]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof createAccountMessagePushBinding>,
      Promise<ExpectedQqbotMessagePublishBindingView>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof updateAccountMessagePushBinding>,
      [
        selfId: string,
        id: string,
        data: ExpectedQqbotMessagePublishBindingInput,
      ]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof updateAccountMessagePushBinding>,
      Promise<ExpectedQqbotMessagePublishBindingView>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof setAccountMessagePushBindingEnabled>,
      [selfId: string, id: string, enabled: boolean]
    >
  >,
  Assert<
    Equal<
      ReturnType<typeof setAccountMessagePushBindingEnabled>,
      Promise<ExpectedQqbotMessagePublishBindingView>
    >
  >,
  Assert<
    Equal<
      Parameters<typeof deleteAccountMessagePushBinding>,
      [selfId: string, id: string]
    >
  >,
  Assert<
    Equal<ReturnType<typeof deleteAccountMessagePushBinding>, Promise<boolean>>
  >,
  Assert<
    Equal<Parameters<typeof getAccountMessagePushTargets>, [selfId: string]>
  >,
  Assert<
    Equal<
      ReturnType<typeof getAccountMessagePushTargets>,
      Promise<ExpectedQqbotMessagePushTargetOptionsResponse>
    >
  >,
];

const messagePushCallerNames = [
  'createAccountMessagePushBinding',
  'createMessageSubscription',
  'createMessageTemplate',
  'deleteAccountMessagePushBinding',
  'deleteMessageSubscription',
  'deleteMessageTemplate',
  'getAccountMessagePushBindings',
  'getAccountMessagePushTargets',
  'getMessagePushSourceDetail',
  'getMessagePushSourceOptions',
  'getMessagePushSources',
  'getMessageSubscriptionList',
  'getMessageTemplateList',
  'getStunMappingPortChangedOptions',
  'previewMessageTemplate',
  'setAccountMessagePushBindingEnabled',
  'setMessageSubscriptionEnabled',
  'setMessageTemplateEnabled',
  'updateAccountMessagePushBinding',
  'updateMessageSubscription',
  'updateMessageTemplate',
];

/** 使用工作区 TypeScript 配置检查消息推送公开契约。 */
function getMessagePushContractDiagnostics() {
  const appRoot = resolve('apps/web-antdv-next');
  const configPath = resolve(appRoot, 'tsconfig.json');
  const testFilePath = resolve('test/api/qqbot/message-push.spec.ts');
  const virtualRequestModulePath =
    '/__qqbot-message-push-contract__/request.ts';
  const virtualRequestModuleSource = `
export declare const requestClient: {
  delete<T>(url: string, config?: unknown): Promise<T>;
  get<T>(url: string, config?: unknown): Promise<T>;
  post<T>(url: string, data?: unknown, config?: unknown): Promise<T>;
  put<T>(url: string, data?: unknown, config?: unknown): Promise<T>;
};`;
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    appRoot,
    { incremental: false, noEmit: true },
    configPath,
  );
  const baseCompilerHost = ts.createCompilerHost(parsed.options, true);
  const compilerHost: ts.CompilerHost = {
    ...baseCompilerHost,
    fileExists(fileName) {
      return (
        fileName === virtualRequestModulePath ||
        baseCompilerHost.fileExists(fileName)
      );
    },
    getSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    ) {
      if (fileName === virtualRequestModulePath) {
        return ts.createSourceFile(
          fileName,
          virtualRequestModuleSource,
          languageVersion,
          true,
        );
      }

      return baseCompilerHost.getSourceFile(
        fileName,
        languageVersion,
        onError,
        shouldCreateNewSourceFile,
      );
    },
    readFile(fileName) {
      return fileName === virtualRequestModulePath
        ? virtualRequestModuleSource
        : baseCompilerHost.readFile(fileName);
    },
    resolveModuleNames(moduleNames, containingFile) {
      return moduleNames.map((moduleName) => {
        if (moduleName === '#/api/request') {
          return {
            extension: ts.Extension.Ts,
            isExternalLibraryImport: false,
            resolvedFileName: virtualRequestModulePath,
          };
        }

        if (moduleName.startsWith('@test-source/')) {
          return ts.resolveModuleName(
            resolve(moduleName.slice('@test-source/'.length)),
            containingFile,
            parsed.options,
            baseCompilerHost,
          ).resolvedModule;
        }

        return ts.resolveModuleName(
          moduleName,
          containingFile,
          parsed.options,
          baseCompilerHost,
        ).resolvedModule;
      });
    },
  };
  const program = ts.createProgram({
    host: compilerHost,
    options: parsed.options,
    rootNames: [testFilePath],
  });

  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    );
}

vi.mock('#/api/request', () => ({
  requestClient: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('qqbot message push api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('owns the exact source, subscription, and template callers', async () => {
    const sourceKey = 'network.stun/a b';
    const id = '10000000000000001';
    const previewContent = '端口 $' + '{{port}}';
    const subscriptionInput = {
      enabled: true,
      name: 'STUN 端口变更',
      sourceConfig: {
        ddnsRecordId: '10000000000000003',
        portForwardId: '10000000000000002',
      },
      sourceKey: 'network.stun.mapping-port-changed',
    };
    const templateInput = {
      content: previewContent,
      enabled: true,
      name: '端口通知',
      sourceKey: 'network.stun.mapping-port-changed',
    };
    const subscriptionQuery = {
      enabled: true,
      name: 'STUN',
      pageNo: 1,
      pageSize: 10,
      sourceKey: 'network.stun.mapping-port-changed',
    };
    const templateQuery = {
      enabled: false,
      name: '通知',
      pageNo: 2,
      pageSize: 20,
      sourceKey: 'network.stun.mapping-port-changed',
    };

    await getMessagePushSources();
    await getMessagePushSourceDetail(sourceKey);
    await getMessagePushSourceOptions(sourceKey);
    await getStunMappingPortChangedOptions();
    await getMessageSubscriptionList(subscriptionQuery);
    await createMessageSubscription(subscriptionInput);
    await updateMessageSubscription('id/a b', subscriptionInput);
    await setMessageSubscriptionEnabled(id, false);
    await deleteMessageSubscription('id/a b');
    await getMessageTemplateList(templateQuery);
    await createMessageTemplate(templateInput);
    await updateMessageTemplate('template/a b', templateInput);
    await setMessageTemplateEnabled(id, false);
    await deleteMessageTemplate('template/a b');
    await previewMessageTemplate({
      content: previewContent,
      sourceKey: 'network.stun.mapping-port-changed',
    });

    expect(requestClient.get).toHaveBeenNthCalledWith(
      1,
      '/qqbot/message-push/sources',
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      2,
      '/qqbot/message-push/sources/network.stun%2Fa%20b',
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      3,
      '/qqbot/message-push/sources/network.stun%2Fa%20b/subscription-options',
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      4,
      '/qqbot/message-push/sources/network.stun.mapping-port-changed/options',
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      5,
      '/qqbot/message-push/subscriptions',
      { params: subscriptionQuery },
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      6,
      '/qqbot/message-push/templates',
      { params: templateQuery },
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      1,
      '/qqbot/message-push/subscriptions',
      subscriptionInput,
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      2,
      '/qqbot/message-push/templates',
      templateInput,
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      3,
      '/qqbot/message-push/templates/preview',
      {
        content: previewContent,
        sourceKey: 'network.stun.mapping-port-changed',
      },
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      1,
      '/qqbot/message-push/subscriptions/id%2Fa%20b',
      subscriptionInput,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      2,
      '/qqbot/message-push/subscriptions/10000000000000001/enabled',
      { enabled: false },
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      3,
      '/qqbot/message-push/templates/template%2Fa%20b',
      templateInput,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      4,
      '/qqbot/message-push/templates/10000000000000001/enabled',
      { enabled: false },
    );
    expect(requestClient.delete).toHaveBeenNthCalledWith(
      1,
      '/qqbot/message-push/subscriptions/id%2Fa%20b',
    );
    expect(requestClient.delete).toHaveBeenNthCalledWith(
      2,
      '/qqbot/message-push/templates/template%2Fa%20b',
    );
  });

  it('keeps account IDs as strings and encodes every account path segment', async () => {
    const selfId = '10000000000000001/a b';
    const bindingId = 'binding/a b';
    const bindingInput = {
      enabled: true,
      subscriptionId: '10000000000000002',
      targets: [
        {
          targetId: '10000000000000003',
          targetName: '测试群',
          targetType: 'group' as const,
        },
      ],
      templateId: '10000000000000004',
    };

    await getAccountMessagePushBindings(selfId);
    await createAccountMessagePushBinding(selfId, bindingInput);
    await updateAccountMessagePushBinding(selfId, bindingId, bindingInput);
    await setAccountMessagePushBindingEnabled(selfId, bindingId, false);
    await deleteAccountMessagePushBinding(selfId, bindingId);
    await getAccountMessagePushTargets(selfId);

    const accountPath =
      '/qqbot/accounts/10000000000000001%2Fa%20b/message-push';
    expect(requestClient.get).toHaveBeenNthCalledWith(
      1,
      `${accountPath}/bindings`,
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      2,
      `${accountPath}/targets`,
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      `${accountPath}/bindings`,
      bindingInput,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      1,
      `${accountPath}/bindings/binding%2Fa%20b`,
      bindingInput,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      2,
      `${accountPath}/bindings/binding%2Fa%20b/enabled`,
      { enabled: false },
    );
    expect(requestClient.delete).toHaveBeenCalledWith(
      `${accountPath}/bindings/binding%2Fa%20b`,
    );
  });

  it('exports exactly the twenty-one approved callers', () => {
    expect(Object.keys(messagePushApi).toSorted()).toEqual(
      messagePushCallerNames,
    );
  });

  it('type-checks the complete public namespace and caller contract', () => {
    const typeContracts: MessagePushTypeContracts = [] as never;

    void typeContracts;
    expect(getMessagePushContractDiagnostics()).toEqual([]);
  });
});
