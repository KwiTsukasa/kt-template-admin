import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

import { getQqbotPluginOperationPage } from './index';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
    getBaseUrl: vi.fn(() => ''),
  },
}));

describe('qqbot plugin API wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the paged plugin operation endpoint for KtTable', async () => {
    const pageResult = {
      list: [],
      pageNo: 2,
      pageSize: 1,
      total: 3,
    };
    vi.mocked(requestClient.get).mockResolvedValueOnce(pageResult);

    await expect(
      getQqbotPluginOperationPage({
        pageNo: 2,
        pageSize: 1,
        pluginKey: 'bangdream',
        triggerMode: 'command',
      }),
    ).resolves.toBe(pageResult);

    expect(requestClient.get).toHaveBeenCalledWith(
      '/qqbot/plugin/operation/page',
      {
        params: {
          pageNo: 2,
          pageSize: 1,
          pluginKey: 'bangdream',
          triggerMode: 'command',
        },
      },
    );
  });
});
