import {
  createMessageSubscription,
  createMessageTemplate,
  deleteMessageSubscription,
  deleteMessageTemplate,
  getMessageSourceDetail,
  getMessageSourceOptions,
  getMessageSources,
  getMessageSubscribers,
  getMessageSubscriptionList,
  getMessageTemplateList,
  previewMessageTemplate,
  setMessageSubscriptionEnabled,
  setMessageTemplateEnabled,
  updateMessageSubscription,
  updateMessageTemplate,
} from '@test-source/apps/web-antdv-next/src/api/message-management';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

vi.mock('#/api/request', () => ({
  requestClient: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('message management api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('owns the canonical source and subscriber discovery routes', async () => {
    await getMessageSubscribers();
    await getMessageSources();
    await getMessageSourceDetail('network/a b');
    await getMessageSourceOptions('network/a b');

    expect(requestClient.get).toHaveBeenNthCalledWith(
      1,
      '/message-management/subscribers',
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      2,
      '/message-management/sources',
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      3,
      '/message-management/sources/network%2Fa%20b',
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      4,
      '/message-management/sources/network%2Fa%20b/subscription-options',
    );
  });

  it('persists one subscriber and every ordered template on the subscription', async () => {
    const input = {
      enabled: true,
      name: '网络状态通知',
      sourceConfig: { channelId: 'channel-a' },
      subscriberKey: 'bot',
      templateIds: ['20000000000000001', '20000000000000002'],
    };
    const query = {
      pageNo: 1,
      pageSize: 20,
      subscriberKey: 'bot',
      templateId: '20000000000000001',
    };

    await getMessageSubscriptionList(query);
    await createMessageSubscription(input);
    await updateMessageSubscription('100/a b', input);
    await setMessageSubscriptionEnabled('100/a b', false);
    await deleteMessageSubscription('100/a b');

    expect(requestClient.get).toHaveBeenCalledWith(
      '/message-management/subscriptions',
      { params: query },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/message-management/subscriptions',
      input,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      1,
      '/message-management/subscriptions/100%2Fa%20b',
      input,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      2,
      '/message-management/subscriptions/100%2Fa%20b/enabled',
      { enabled: false },
    );
    expect(requestClient.delete).toHaveBeenCalledWith(
      '/message-management/subscriptions/100%2Fa%20b',
    );
    expect(input).not.toHaveProperty('sourceKey');
  });

  it('keeps template lifecycle under message management', async () => {
    const input = {
      content: '状态 {{status}}',
      enabled: true,
      name: '状态模板',
      sourceKey: 'network.changed',
    };
    const query = { pageNo: 1, pageSize: 20, sourceKey: 'network.changed' };

    await getMessageTemplateList(query);
    await createMessageTemplate(input);
    await updateMessageTemplate('200/a b', input);
    await setMessageTemplateEnabled('200/a b', false);
    await previewMessageTemplate({
      content: input.content,
      sourceKey: input.sourceKey,
    });
    await deleteMessageTemplate('200/a b');

    expect(requestClient.get).toHaveBeenCalledWith(
      '/message-management/templates',
      { params: query },
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      1,
      '/message-management/templates',
      input,
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      2,
      '/message-management/templates/preview',
      { content: input.content, sourceKey: input.sourceKey },
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      1,
      '/message-management/templates/200%2Fa%20b',
      input,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      2,
      '/message-management/templates/200%2Fa%20b/enabled',
      { enabled: false },
    );
    expect(requestClient.delete).toHaveBeenCalledWith(
      '/message-management/templates/200%2Fa%20b',
    );
  });
});
