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

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: { workstreamId: '01a0a738-8f7d-7e32-870e-a9c9d05c6211' },
  }),
}));

vi.mock('#/api/system/workflow-coordination', () => ({
  getCoordinationEventsUrl: () => '/coordination/events',
  getCoordinationSnapshot: vi.fn(),
}));

vi.mock('antdv-next', () => {
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
    Empty: defineComponent({
      props: { description: { type: String, default: '' } },
      setup(props) {
        return () => h('p', props.description);
      },
    }),
    Input: defineComponent({
      props: { value: { type: String, default: '' } },
      emits: ['update:value'],
      setup(props, { attrs, emit }) {
        return () =>
          h('input', {
            ...attrs,
            value: props.value,
            onInput: (event: Event) =>
              emit('update:value', (event.target as HTMLInputElement).value),
          });
      },
    }),
    Select: defineComponent({
      props: {
        value: { type: String, default: '' },
        options: { type: Array as PropType<any[]>, default: () => [] },
      },
      emits: ['change'],
      setup(props, { attrs, emit }) {
        return () =>
          h(
            'select',
            {
              ...attrs,
              value: props.value,
              onChange: (event: Event) =>
                emit('change', (event.target as HTMLSelectElement).value),
            },
            props.options?.map((item) =>
              h('option', { value: item.value }, item.label),
            ),
          );
      },
    }),
    Space: Box,
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
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(
    () => undefined,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('协调工作台', () => {
  it('uses real task cards for explicit location and does not scroll on SSE updates', async () => {
    let resolveSnapshot: (value: CoordinationSnapshot) => void = () =>
      undefined;
    vi.mocked(getCoordinationSnapshot).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
    const wrapper = mount(CoordinationPage, { attachTo: document.body });
    await nextTick();
    expect(wrapper.text()).toContain('正在读取任务快照');
    resolveSnapshot(snapshot);
    await flushPromises();
    await nextTick();
    expect(wrapper.get(`[data-task-id="${currentId}"]`).text()).toContain(
      '当前任务',
    );
    expect(wrapper.find('table').exists()).toBe(false);
    expect(wrapper.text()).toContain('共享资源');
    expect(wrapper.text()).toContain('协调记录');

    const locate = wrapper
      .findAll('button')
      .find((button) => button.text() === '定位当前任务');
    await locate?.trigger('click');
    await nextTick();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'smooth',
    });
    expect(document.activeElement).toBe(
      wrapper.get(`[data-task-id="${currentId}"]`).element,
    );
    vi.mocked(HTMLElement.prototype.scrollIntoView).mockClear();
    FakeEventSource.instances[0]?.listeners.get('coordination-snapshot')?.(
      new MessageEvent('coordination-snapshot', {
        data: JSON.stringify({ ...snapshot, revision: 2 }),
      }),
    );
    await nextTick();
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();

    await wrapper.get('input[aria-label="搜索任务"]').setValue('当前任务');
    await wrapper.get('select[aria-label="任务状态"]').setValue('已完成');
    expect(wrapper.find(`[data-task-id="${ownerId}"]`).exists()).toBe(false);
    await wrapper
      .get('.kt-coordination__resource-card button')
      .trigger('click');
    await nextTick();
    expect(wrapper.get('input').element.value).toBe('');
    expect(wrapper.get('select').element.value).toBe('');
    expect(
      wrapper.get(`[data-task-id="${ownerId}"]`).attributes('aria-pressed'),
    ).toBe('true');
    expect(document.activeElement).toBe(
      wrapper.get(`[data-task-id="${ownerId}"]`).element,
    );
    wrapper.unmount();
  });

  it('keeps unknown owners disabled and allows completed tasks through the history switch', async () => {
    const completedId = '01a0a738-8f7d-7e32-870e-a9c9d05c6213';
    vi.mocked(getCoordinationSnapshot).mockResolvedValue({
      ...snapshot,
      tasks: [
        ...snapshot.tasks,
        {
          ...(snapshot.tasks[0] as CoordinationSnapshot['tasks'][number]),
          workstreamId: completedId,
          objective: '历史任务',
          status: 'completed',
        },
      ],
      claims: [
        ...snapshot.claims,
        {
          ...(snapshot.claims[0] as CoordinationSnapshot['claims'][number]),
          workstreamId: 'unknown-owner',
          key: 'unknown-resource',
        },
      ],
    });
    const wrapper = mount(CoordinationPage);
    await flushPromises();
    expect(wrapper.find(`[data-task-id="${completedId}"]`).exists()).toBe(
      false,
    );
    const unknown = wrapper
      .findAll('.kt-coordination__resource-card')
      .find((card) => card.text().includes('unknown-resource'));
    expect(unknown?.get('button').attributes('disabled')).toBeDefined();
    expect(unknown?.text()).toContain('所有者状态不可读，保留占用');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('包含历史'))
      ?.trigger('click');
    expect(wrapper.get(`[data-task-id="${completedId}"]`).text()).toContain(
      '已完成',
    );
    expect(
      wrapper.get('.kt-coordination__technical').attributes('open'),
    ).toBeUndefined();
    wrapper.unmount();
  });
});
