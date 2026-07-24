import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

import * as messagePushApi from './message-push';
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
} from './message-push';

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
      '/qqbot/message-push/sources/network.stun.mapping-port-changed/options',
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      4,
      '/qqbot/message-push/subscriptions',
      { params: subscriptionQuery },
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      5,
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

  it('does not expose internal publish, event, delivery, or worker callers', () => {
    expect(Object.keys(messagePushApi)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/delivery|event|publish|worker/i),
      ]),
    );
  });
});
