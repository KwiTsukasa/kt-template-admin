import {
  bindQqbotPluginAccount,
  enableQqbotPluginInstallation,
  getQqbotPluginAccountBindings,
  getQqbotPluginOperationPage,
  getQqbotPluginPlatformInstallations,
  getQqbotPluginRuntimeEvents,
  installLocalQqbotPluginPackage,
  unbindQqbotPluginAccount,
  uploadQqbotPluginPackage,
  validateQqbotPluginManifest,
} from '@test-source/apps/web-antdv-next/src/api/qqbot/plugin';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
    getBaseUrl: vi.fn(() => ''),
    post: vi.fn(),
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

  it('owns plugin-platform management caller routes', async () => {
    const manifest = { capabilities: [], key: 'demo' };
    const packageBody = {
      packageHash: 'sha256-demo',
      packagePath: '.kt-workspace/qqbot-plugin-packages/demo.qqbot-plugin.json',
    };
    vi.mocked(requestClient.get).mockResolvedValue([]);
    vi.mocked(requestClient.post).mockResolvedValue({});

    await getQqbotPluginPlatformInstallations();
    await uploadQqbotPluginPackage(packageBody);
    await validateQqbotPluginManifest(manifest);
    await installLocalQqbotPluginPackage(packageBody);
    await enableQqbotPluginInstallation('installation-1');
    await getQqbotPluginRuntimeEvents('demo');
    await getQqbotPluginAccountBindings('demo');
    await bindQqbotPluginAccount('account-1', 'plugin-1');
    await unbindQqbotPluginAccount('account-1', 'plugin-1');

    expect(requestClient.get).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/installations',
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/upload',
      packageBody,
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/validate',
      { manifest },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/install-local',
      packageBody,
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/enable',
      { id: 'installation-1' },
    );
    expect(requestClient.get).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/runtime-events',
      { params: { pluginId: 'demo' } },
    );
    expect(requestClient.get).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/account-bindings',
      { params: { pluginId: 'demo' } },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/account-bindings/bind',
      { accountId: 'account-1', pluginId: 'plugin-1' },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/account-bindings/unbind',
      { accountId: 'account-1', pluginId: 'plugin-1' },
    );
  });
});
