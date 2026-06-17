import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

import {
  disableQqbotPluginTask,
  enableQqbotPluginTask,
  getQqbotPluginTaskPage,
  getQqbotPluginTaskRunPage,
  runQqbotPluginTaskOnce,
  updateQqbotPluginTaskCron,
} from './plugin-task';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('qqbot plugin task API wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses plugin-platform task endpoints', async () => {
    vi.mocked(requestClient.get).mockResolvedValue({ list: [], total: 0 });
    vi.mocked(requestClient.post).mockResolvedValue({});

    await getQqbotPluginTaskPage({
      enabled: true,
      pageNo: 1,
      pageSize: 10,
      taskKey: 'bangdream.bestdori.sync-main-data',
    });
    await enableQqbotPluginTask('task-1');
    await disableQqbotPluginTask('task-1');
    await updateQqbotPluginTaskCron('task-1', '0 */6 * * *');
    await runQqbotPluginTaskOnce('task-1', { force: true });
    await getQqbotPluginTaskRunPage('task-1', { pageNo: 1, pageSize: 20 });

    expect(requestClient.get).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/tasks/page',
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
      '/qqbot/plugin-platform/tasks/task-1/enable',
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/tasks/task-1/disable',
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/tasks/task-1/cron',
      {
        cronExpression: '0 */6 * * *',
      },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/tasks/task-1/run',
      {
        input: { force: true },
      },
    );
    expect(requestClient.get).toHaveBeenCalledWith(
      '/qqbot/plugin-platform/tasks/task-1/runs',
      {
        params: { pageNo: 1, pageSize: 20 },
      },
    );
  });
});
