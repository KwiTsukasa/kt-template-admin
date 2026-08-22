import {
  disablePluginTask,
  enablePluginTask,
  getPluginTaskPage,
  getPluginTaskRunPage,
  runPluginTaskOnce,
  updatePluginTaskCron,
} from '@test-source/apps/web-antdv-next/src/api/plugin-platform/task';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('bot plugin task API wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses plugin-platform task endpoints', async () => {
    vi.mocked(requestClient.get).mockResolvedValue({ list: [], total: 0 });
    vi.mocked(requestClient.post).mockResolvedValue({});

    await getPluginTaskPage({
      enabled: true,
      pageNo: 1,
      pageSize: 10,
      taskKey: 'bangdream.bestdori.sync-main-data',
    });
    await enablePluginTask('task-1');
    await disablePluginTask('task-1');
    await updatePluginTaskCron('task-1', '0 */6 * * *');
    await runPluginTaskOnce('task-1', { force: true });
    await getPluginTaskRunPage('task-1', { pageNo: 1, pageSize: 20 });

    expect(requestClient.get).toHaveBeenCalledWith(
      '/plugin-platform/tasks/page',
      {
        params: {
          enabled: true,
          pageNo: 1,
          pageSize: 10,
          taskKey: 'bangdream.bestdori.sync-main-data',
        },
      },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/plugin-platform/tasks/task-1/enable',
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/plugin-platform/tasks/task-1/disable',
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/plugin-platform/tasks/task-1/cron',
      {
        cronExpression: '0 */6 * * *',
      },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/plugin-platform/tasks/task-1/run',
      {
        input: { force: true },
      },
    );
    expect(requestClient.get).toHaveBeenCalledWith(
      '/plugin-platform/tasks/task-1/runs',
      {
        params: { pageNo: 1, pageSize: 20 },
      },
    );
  });
});
