import type { WorkflowNodeRun } from '#/api/workflow-engine';

import { flushPromises, mount } from '@vue/test-utils';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import NodeRunDetails from '#/views/workflow-engine/NodeRunDetails';

const api = vi.hoisted(() => ({ nodeVisits: vi.fn() }));
vi.mock('#/api/workflow-engine', () => ({ workflowApi: api }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('@vben/utils', () => ({ formatDateTime: (value: string) => value }));
vi.mock('antdv-next', async () => {
  const [alert, button, empty, select, tag] = await Promise.all([
    import('antdv-next/dist/alert/index'),
    import('antdv-next/dist/button/index'),
    import('antdv-next/dist/empty/index'),
    import('antdv-next/dist/select/index'),
    import('antdv-next/dist/tag/index'),
  ]);
  return {
    Alert: alert.default,
    Button: button.default,
    Empty: empty.default,
    Select: select.default,
    Tag: tag.default,
  };
});

const node: WorkflowNodeRun = {
  nodeId: 'Inspect',
  visit: 1,
  status: 'succeeded',
  error: null,
  taskRunId: null,
  loopIteration: 0,
  loopPath: {},
  output: {},
  scriptAttempts: [],
  selectedPorts: [],
  wakeAt: null,
};

beforeEach(() => {
  api.nodeVisits.mockReset();
  api.nodeVisits.mockResolvedValue({ items: [], nextBeforeVisit: null });
});

describe('节点历史按语义变化读取', () => {
  it('父页连续替换等值运行快照时保持已有历史且不重复请求', async () => {
    const wrapper = mount(NodeRunDetails, {
      props: {
        runId: 'run-1',
        node: { ...node },
        nodeNames: { Inspect: '检查来源' },
      },
    });
    await flushPromises();
    for (let poll = 0; poll < 5; poll += 1) {
      await wrapper.setProps({ node: { ...node, output: { progress: poll } } });
      await flushPromises();
    }
    expect(api.nodeVisits).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('同轮批次改变节点身份和状态只读取新节点一次', async () => {
    const wrapper = mount(NodeRunDetails, {
      props: { runId: 'run-1', node: { ...node }, nodeNames: {} },
    });
    await flushPromises();
    await wrapper.setProps({
      node: { ...node, nodeId: 'Download', status: 'waiting' },
    });
    await flushPromises();
    expect(api.nodeVisits).toHaveBeenCalledTimes(2);
    expect(api.nodeVisits).toHaveBeenLastCalledWith(
      'run-1',
      'Download',
      undefined,
    );
    wrapper.unmount();
  });
});
