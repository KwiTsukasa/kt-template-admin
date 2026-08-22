import {
  enablePluginInstallation,
  getPluginInstallations,
  getPluginOperationPage,
  getPluginRuntimeEvents,
  installLocalPluginPackage,
  uploadPluginPackage,
  validatePluginManifest,
} from '@test-source/apps/web-antdv-next/src/api/plugin-platform/plugin';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
    getBaseUrl: vi.fn(() => ''),
    post: vi.fn(),
  },
}));

describe('bot plugin API wrappers', () => {
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
      getPluginOperationPage({
        pageNo: 2,
        pageSize: 1,
        pluginKey: 'bangdream',
        triggerMode: 'command',
      }),
    ).resolves.toBe(pageResult);

    expect(requestClient.get).toHaveBeenCalledWith(
      '/plugin-platform/catalog/operation/page',
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
      packagePath: '.kt-workspace/plugin-packages/demo.plugin.json',
    };
    vi.mocked(requestClient.get).mockResolvedValue([]);
    vi.mocked(requestClient.post).mockResolvedValue({});

    await getPluginInstallations();
    await uploadPluginPackage(packageBody);
    await validatePluginManifest(manifest);
    await installLocalPluginPackage(packageBody);
    await enablePluginInstallation('installation-1');
    await getPluginRuntimeEvents('demo');

    expect(requestClient.get).toHaveBeenCalledWith(
      '/plugin-platform/installations',
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/plugin-platform/upload',
      packageBody,
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/plugin-platform/validate',
      { manifest },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/plugin-platform/install-local',
      packageBody,
    );
    expect(requestClient.post).toHaveBeenCalledWith('/plugin-platform/enable', {
      id: 'installation-1',
    });
    expect(requestClient.get).toHaveBeenCalledWith(
      '/plugin-platform/runtime-events',
      { params: { pluginId: 'demo' } },
    );
  });
});
