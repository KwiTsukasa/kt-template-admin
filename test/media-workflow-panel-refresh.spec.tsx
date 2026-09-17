import type { MediaGovernanceApi } from '#/api/media-governance';

import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MediaGovernanceTaskRunPanel from '#/views/media/governance/tasks/components/MediaGovernanceTaskRunPanel';

const api = vi.hoisted(() => ({ latest: vi.fn(), humanTasks: vi.fn() }));
vi.mock('#/api/media-governance/workflow', () => ({ mediaWorkflowApi: api }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock(
  '#/views/media/governance/tasks/components/MediaWorkflowHumanTask',
  () => ({ default: { render: () => null } }),
);
vi.mock('antdv-next', async () => {
  const [alert, button, descriptions, popconfirm, space, spin] =
    await Promise.all([
      import('antdv-next/dist/alert/index'),
      import('antdv-next/dist/button/index'),
      import('antdv-next/dist/descriptions/index'),
      import('antdv-next/dist/popconfirm/index'),
      import('antdv-next/dist/space/index'),
      import('antdv-next/dist/spin/index'),
    ]);
  return {
    Alert: alert.default,
    Button: button.default,
    Descriptions: descriptions.default,
    Popconfirm: popconfirm.default,
    Space: space.default,
    Spin: spin.default,
    message: { error: vi.fn() },
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  api.latest.mockReset().mockResolvedValue({
    runId: 'run',
    workflowId: 'flow',
    workflowVersion: 1,
    status: 'waiting',
    activeActivities: [],
  });
  api.humanTasks.mockReset().mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('媒体流程面板保持对象身份', () => {
  it('任务进度更新不重新装载流程，隐藏后也不继续轮询', async () => {
    const task = { id: 'task-1', revision: 1 } as MediaGovernanceApi.Task;
    const wrapper = mount(MediaGovernanceTaskRunPanel, {
      props: { task, active: true },
    });
    await flushPromises();
    for (let revision = 2; revision <= 6; revision += 1) {
      await wrapper.setProps({ task: { ...task, revision } });
      await flushPromises();
    }
    expect(api.latest).toHaveBeenCalledTimes(1);
    expect(api.humanTasks).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ active: false });
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.latest).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ active: true });
    await flushPromises();
    expect(api.latest).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});
