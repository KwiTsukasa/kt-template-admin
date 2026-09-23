/* eslint-disable vue/multi-word-component-names, vue/one-component-per-file, vue/require-default-prop */
/* @vitest-environment happy-dom */

import type { BotApi } from '#/api/bot';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';

import ConfigPage from '@test-source/apps/web-antdv-next/src/views/bot/account/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accountList: vi.fn(),
  goBack: vi.fn(),
  route: undefined as any,
}));

vi.mock('vue-router', () => ({ useRoute: () => mocks.route }));
vi.mock('#/hooks/usePageReturn', () => ({
  usePageReturn: () => mocks.goBack,
}));
vi.mock('#/api/bot', () => ({ getBotAccountList: mocks.accountList }));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('main', slots.default?.()),
  }),
}));
vi.mock('@vben/icons', () => ({
  ArrowLeft: defineComponent({ setup: () => () => h('i') }),
}));
vi.mock('antdv-next', () => {
  const Slot = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  });
  return {
    Alert: defineComponent({
      props: { title: String, action: null },
      setup(props) {
        return () => h('div', { role: 'alert' }, [props.title, props.action]);
      },
    }),
    Button: defineComponent({
      setup(_, { attrs, slots }) {
        return () => h('button', attrs, slots.default?.());
      },
    }),
    Spin: defineComponent({
      props: { spinning: Boolean },
      setup(props, { slots }) {
        return () =>
          h(
            'div',
            { 'data-spinning': String(props.spinning) },
            slots.default?.(),
          );
      },
    }),
    Tag: Slot,
  };
});
vi.mock(
  '@test-source/apps/web-antdv-next/src/views/bot/account/components/AccountConfigPanel',
  () => ({
    default: defineComponent({
      props: { account: Object },
      setup(props) {
        return () =>
          h('div', {
            'data-panel-self-id':
              (props.account as BotApi.Account | undefined)?.selfId || '',
          });
      },
    }),
  }),
);

/**
 * 构造具有真实账号身份的可控列表项。
 * @param selfId - 本次路由和接口匹配的 Bot Self ID。
 * @returns 用于配置页身份检查的账号记录。
 */
function account(selfId: string): BotApi.Account {
  return {
    connectStatus: 'online',
    connectionMode: 'reverse-ws',
    enabled: true,
    id: selfId,
    name: `Bot ${selfId}`,
    selfId,
  };
}

/**
 * 让账号读取完成顺序由测试显式控制。
 * @returns 可兑现或拒绝的账号列表请求。
 */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.route = reactive({ query: { selfId: 'A' } });
  mocks.accountList.mockImplementation(async (params) => ({
    list: [account(params.selfId)],
    total: 1,
  }));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('bot account config identity', () => {
  it('keeps B after a late A response and never mounts A panel in B', async () => {
    const first = deferred<{ list: BotApi.Account[]; total: number }>();
    mocks.accountList.mockImplementationOnce(() => first.promise);
    const wrapper = mount(ConfigPage);
    mocks.route.query.selfId = 'B';
    await flushPromises();
    expect(
      wrapper.get('[data-panel-self-id]').attributes('data-panel-self-id'),
    ).toBe('B');
    first.resolve({ list: [account('A')], total: 1 });
    await flushPromises();
    expect(
      wrapper.get('[data-panel-self-id]').attributes('data-panel-self-id'),
    ).toBe('B');
    wrapper.unmount();
  });

  it('ends loading and shows a missing-id state after a pending account is cleared', async () => {
    const first = deferred<{ list: BotApi.Account[]; total: number }>();
    mocks.accountList.mockImplementationOnce(() => first.promise);
    const wrapper = mount(ConfigPage);
    mocks.route.query.selfId = '';
    await flushPromises();
    expect(wrapper.text()).toContain('缺少账号 Self ID');
    expect(wrapper.get('[data-spinning]').attributes('data-spinning')).toBe(
      'false',
    );
    first.resolve({ list: [account('A')], total: 1 });
    await flushPromises();
    expect(wrapper.find('[data-panel-self-id]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows a retryable failure instead of an empty config after an account read rejects', async () => {
    mocks.accountList.mockRejectedValueOnce(new Error('offline'));
    const wrapper = mount(ConfigPage);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('账号读取失败');
    expect(wrapper.find('[data-panel-self-id]').exists()).toBe(false);
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === '重试');
    await retry?.trigger('click');
    await flushPromises();
    expect(mocks.accountList).toHaveBeenCalledTimes(2);
    expect(
      wrapper.get('[data-panel-self-id]').attributes('data-panel-self-id'),
    ).toBe('A');
    wrapper.unmount();
  });

  it('keeps B when an A retry finishes after the route switches', async () => {
    const retryA = deferred<{ list: BotApi.Account[]; total: number }>();
    mocks.accountList.mockRejectedValueOnce(new Error('offline'));
    mocks.accountList.mockImplementationOnce(() => retryA.promise);
    const wrapper = mount(ConfigPage);
    await flushPromises();
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === '重试');
    await retry?.trigger('click');
    mocks.route.query.selfId = 'B';
    await flushPromises();
    retryA.resolve({ list: [account('A')], total: 1 });
    await flushPromises();
    expect(
      wrapper.get('[data-panel-self-id]').attributes('data-panel-self-id'),
    ).toBe('B');
    wrapper.unmount();
  });

  it('distinguishes a confirmed missing account from a failed request', async () => {
    mocks.accountList.mockResolvedValueOnce({ list: [], total: 0 });
    const wrapper = mount(ConfigPage);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('未找到账号 A');
    expect(wrapper.find('[data-panel-self-id]').exists()).toBe(false);
    expect(
      wrapper.findAll('button').some((button) => button.text() === '重试'),
    ).toBe(false);
    wrapper.unmount();
  });

  it('treats a missing account-list payload as unknown rather than not found', async () => {
    mocks.accountList.mockResolvedValueOnce({ total: 0 });
    const wrapper = mount(ConfigPage);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('账号读取失败');
    expect(wrapper.text()).not.toContain('未找到账号 A');
    wrapper.unmount();
  });

  it('does not publish an account result after unmount', async () => {
    const pending = deferred<{ list: BotApi.Account[]; total: number }>();
    mocks.accountList.mockImplementationOnce(() => pending.promise);
    const wrapper = mount(ConfigPage);
    wrapper.unmount();
    pending.resolve({ list: [account('A')], total: 1 });
    await flushPromises();
    expect(mocks.accountList).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-panel-self-id]').exists()).toBe(false);
  });
});
