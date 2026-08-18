import {
  createQqbotMessageBinding,
  deleteQqbotMessageBinding,
  getQqbotMessageBindings,
  getQqbotMessageTargets,
  setQqbotMessageBindingEnabled,
  updateQqbotMessageBinding,
} from '@test-source/apps/web-antdv-next/src/api/message-management/subscribers/qqbot';
import {
  createStationNoticeMessageBinding,
  deleteStationNoticeMessageBinding,
  getStationNoticeMessageBindings,
  setStationNoticeMessageBindingEnabled,
  updateStationNoticeMessageBinding,
} from '@test-source/apps/web-antdv-next/src/api/message-management/subscribers/station-notice';
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

describe('message subscriber adapter api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps QQBot private configuration free of source and template fields', async () => {
    const input = {
      enabled: true,
      subscriptionId: '10000000000000001',
      targets: [
        {
          targetId: '123456789',
          targetName: '测试群',
          targetType: 'group' as const,
        },
      ],
    };
    const accountPath =
      '/message-management/subscribers/qqbot/accounts/100%2Fa%20b';

    await getQqbotMessageBindings('100/a b');
    await createQqbotMessageBinding('100/a b', input);
    await updateQqbotMessageBinding('100/a b', '300/a b', input);
    await setQqbotMessageBindingEnabled('100/a b', '300/a b', false);
    await deleteQqbotMessageBinding('100/a b', '300/a b');
    await getQqbotMessageTargets('100/a b');

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
      input,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      1,
      `${accountPath}/bindings/300%2Fa%20b`,
      input,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      2,
      `${accountPath}/bindings/300%2Fa%20b/enabled`,
      { enabled: false },
    );
    expect(requestClient.delete).toHaveBeenCalledWith(
      `${accountPath}/bindings/300%2Fa%20b`,
    );
    expect(input).not.toHaveProperty('templateId');
    expect(input).not.toHaveProperty('sourceKey');
  });

  it('keeps station notice delivery policy behind its subscriber route', async () => {
    const input = {
      enabled: true,
      notifyRoleCode: 'super',
      subscriptionId: '10000000000000001',
      title: '网络状态通知',
    };
    const path = '/message-management/subscribers/station-notice/bindings';

    await getStationNoticeMessageBindings();
    await createStationNoticeMessageBinding(input);
    await updateStationNoticeMessageBinding('400/a b', input);
    await setStationNoticeMessageBindingEnabled('400/a b', false);
    await deleteStationNoticeMessageBinding('400/a b');

    expect(requestClient.get).toHaveBeenCalledWith(path);
    expect(requestClient.post).toHaveBeenCalledWith(path, input);
    expect(requestClient.put).toHaveBeenNthCalledWith(
      1,
      `${path}/400%2Fa%20b`,
      input,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      2,
      `${path}/400%2Fa%20b/enabled`,
      { enabled: false },
    );
    expect(requestClient.delete).toHaveBeenCalledWith(`${path}/400%2Fa%20b`);
    expect(input).not.toHaveProperty('templateId');
  });
});
