/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { PropType } from 'vue';

import type { CoordinationSnapshot } from '#/api/system/workflow-coordination';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import CoordinationPage from '@test-source/apps/web-antdv-next/src/views/llm/coordination/index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCoordinationSnapshot } from '#/api/system/workflow-coordination';

const currentId = '01a0a738-8f7d-7e32-870e-a9c9d05c6211';
const ownerId = '01a0a738-8f7d-7e32-870e-a9c9d05c6212';
const state = vi.hoisted(() => ({
  taskScrollTo: undefined as ReturnType<typeof vi.fn> | undefined,
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: { workstreamId: '01a0a738-8f7d-7e32-870e-a9c9d05c6211' },
  }),
}));

vi.mock('#/api/system/workflow-coordination', () => ({
  getCoordinationEventsUrl: () => '/coordination/events',
  getCoordinationSnapshot: vi.fn(),
}));

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    props: {
      dataSource: { default: () => [], type: Array as PropType<any[]> },
      rowActions: { default: () => [], type: Array as PropType<any[]> },
      rowKey: { default: '', type: String },
    },
    setup(props, { expose }) {
      const scrollTo = vi.fn();
      if (props.rowKey === 'workstreamId') state.taskScrollTo = scrollTo;
      expose({ scrollTo });
      return () =>
        h(
          'div',
          { 'data-table': props.rowKey },
          props.dataSource.flatMap((record) => [
            h('span', String(record.objective ?? record.key ?? '')),
            ...props.rowActions.map((action) =>
              h(
                'button',
                { onClick: () => action.onClick(record) },
                action.label,
              ),
            ),
          ]),
        );
    },
  }),
}));

vi.mock('antdv-next', async () => {
  const tabsModule = await import('antdv-next/dist/tabs/index');
  const Tabs = tabsModule.default;
  const Box = defineComponent({
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  });
  return {
    Alert: Box,
    Button: defineComponent({
      setup(_, { attrs, slots }) {
        return () => h('button', attrs, slots.default?.());
      },
    }),
    Empty: Box,
    Input: Box,
    Select: Box,
    Space: Box,
    Tabs,
    Tag: Box,
    Tooltip: Box,
  };
});

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, (event: MessageEvent<string>) => void>();

  constructor() {
    FakeEventSource.instances.push(this);
  }

  /**
   * 保存页面订阅的事件回调，供测试模拟快照推送。
   * @param type - 页面订阅的 SSE 事件名。
   * @param listener - 处理该事件的回调。
   */
  addEventListener(
    type: string,
    listener: (event: MessageEvent<string>) => void,
  ) {
    this.listeners.set(type, listener);
  }

  /** 关闭测试连接，不影响其他状态。 */
  close() {}
}

const snapshot: CoordinationSnapshot = {
  schemaVersion: 1,
  snapshotId: 'snapshot',
  observedAt: '2026-09-23T12:00:00Z',
  unreadableTasks: 0,
  revision: 1,
  tasks: [
    {
      workstreamId: currentId,
      objective: '当前任务',
      status: 'active',
      updatedAt: '2026-09-23T12:00:00Z',
      actionId: 'current',
      nextStep: '继续',
      executionDepth: 1,
      revision: 1,
    },
    {
      workstreamId: ownerId,
      objective: '资源所有者',
      status: 'active',
      updatedAt: '2026-09-20T12:00:00Z',
      actionId: 'owner',
      nextStep: '核对',
      executionDepth: 1,
      revision: 1,
    },
  ],
  claims: [
    {
      workstreamId: ownerId,
      actionId: 'owner',
      kind: 'file',
      key: 'tasks.md',
      acquiredAt: '2026-09-23T12:00:00Z',
    },
  ],
  events: [],
};

beforeEach(() => {
  state.taskScrollTo = undefined;
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(
    () => undefined,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('协调页显式定位', () => {
  it('异步数据与真实页签切换后定位目标，SSE 更新不抢滚动', async () => {
    let resolveSnapshot: (value: CoordinationSnapshot) => void = () =>
      undefined;
    vi.mocked(getCoordinationSnapshot).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
    const wrapper = mount(CoordinationPage);
    resolveSnapshot(snapshot);
    await flushPromises();
    await nextTick();
    expect(wrapper.find('[data-table="workstreamId"]').text()).toContain(
      '当前任务',
    );

    await wrapper.get('button').trigger('click');
    await nextTick();
    expect(state.taskScrollTo?.mock.calls.at(-1)).toEqual([
      { key: currentId, align: 'start' },
    ]);
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({ top: 0 });

    state.taskScrollTo?.mockClear();
    vi.mocked(HTMLElement.prototype.scrollTo).mockClear();
    const stream = FakeEventSource.instances[0];
    stream?.listeners.get('coordination-snapshot')?.(
      new MessageEvent('coordination-snapshot', {
        data: JSON.stringify({ ...snapshot, revision: 2 }),
      }),
    );
    await nextTick();
    expect(state.taskScrollTo).not.toHaveBeenCalled();
    expect(HTMLElement.prototype.scrollTo).not.toHaveBeenCalled();

    const resourceTab = wrapper
      .findAll('.ant-tabs-tab')
      .find((tab) => tab.text().includes('共享资源'));
    await resourceTab?.trigger('click');
    await nextTick();
    await wrapper.find('[data-table="id"] button').trigger('click');
    await nextTick();
    expect(state.taskScrollTo?.mock.calls.at(-1)).toEqual([
      { key: ownerId, align: 'start' },
    ]);
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(wrapper.find('[data-table="workstreamId"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
