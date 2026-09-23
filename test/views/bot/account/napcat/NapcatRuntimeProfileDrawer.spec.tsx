/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import type { BotApi } from '#/api/bot';
import type { BotNapcatApi } from '#/api/bot/napcat';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import NapcatRuntimeProfileDrawer from '@test-source/apps/web-antdv-next/src/views/bot/account/napcat/NapcatRuntimeProfileDrawer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getBotNapcatRuntimeDetail } from '#/api/bot/napcat';

vi.mock('#/api/bot/napcat', () => ({
  getBotNapcatRuntimeDetail: vi.fn(),
}));

vi.mock('antdv-next', async () => {
  const { default: Tag } = await import('antdv-next/dist/tag/index');
  return {
    Tag,
    Alert: defineComponent({
      props: { title: String },
      setup: (props) => () => h('div', { role: 'alert' }, props.title),
    }),
    Button: defineComponent({
      emits: ['click'],
      setup:
        (_, { emit, slots }) =>
        () =>
          h('button', { onClick: () => emit('click') }, slots.default?.()),
    }),
    Drawer: defineComponent({
      name: 'MockDrawer',
      props: {
        open: Boolean,
        title: String,
      },
      setup(props, { slots }) {
        return () =>
          props.open
            ? h('aside', [h('h2', props.title as string), slots.default?.()])
            : null;
      },
    }),
    Spin: defineComponent({
      name: 'MockSpin',
      props: {
        spinning: Boolean,
      },
      setup(_, { slots }) {
        return () => h('div', slots.default?.());
      },
    }),
  };
});

/**
 * 为运行态请求创建手动兑现结果，验证账号切换后的迟到响应不会覆盖新账号。
 * @returns 可控制完成顺序的详情请求。
 */
function deferred() {
  let resolve!: (value: BotNapcatApi.RuntimeProfileDetail) => void;
  const promise = new Promise<BotNapcatApi.RuntimeProfileDetail>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * 构造含已知状态的 NapCat 账号，确保 Tag 同时展示状态前缀和中文值。
 * @param id - 当前抽屉展示的账号身份。
 * @returns 不含敏感字段的账号响应。
 */
function account(id: string): BotApi.Account {
  return {
    connectStatus: 'online',
    connectionMode: 'reverse-ws',
    enabled: true,
    id,
    name: id,
    napcat: { profileStatus: 'ok', riskMode: 'normal' },
    selfId: id,
  };
}

describe('napcat runtime profile drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and renders sanitized runtime profile evidence', async () => {
    vi.mocked(getBotNapcatRuntimeDetail).mockResolvedValue({
      accountId: 'account-1',
      inspectionTimeoutMs: 15_000,
      protocolProfile: {
        reverseWsUrl: 'ws://host/bot/onebot/reverse?token=[REDACTED]',
      },
      runtimeProfile: {
        imageRef: 'kt-napcat-desktop-cn@sha256:profiledigest',
        locale: 'zh_CN.UTF-8',
        shmSize: '512m',
      },
    });

    const wrapper = mount(NapcatRuntimeProfileDrawer, {
      props: {
        account: {
          connectStatus: 'online',
          connectionMode: 'reverse-ws',
          enabled: true,
          id: 'account-1',
          name: '主账号',
          selfId: '10001',
        },
        open: true,
      },
    });
    await flushPromises();

    expect(getBotNapcatRuntimeDetail).toHaveBeenCalledWith('account-1');
    expect(wrapper.text()).toContain('NapCat 运行态证据');
    expect(wrapper.text()).toContain('kt-napcat-desktop-cn');
    expect(wrapper.text()).toContain('zh_CN.UTF-8');
    expect(wrapper.text()).toContain('[REDACTED]');
  });

  it('renders complete Profile and risk labels using the installed Tag', async () => {
    vi.mocked(getBotNapcatRuntimeDetail).mockResolvedValue({
      accountId: 'A',
      riskMode: { riskMode: 'normal' },
      runtimeProfile: { profileStatus: 'synced' },
    });
    const wrapper = mount(NapcatRuntimeProfileDrawer, {
      props: { account: account('A'), open: true },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Profile 正常');
    expect(wrapper.text()).toContain('风险 正常');
    wrapper.unmount();
  });

  it.each([
    ['drifted', '漂移'],
    ['failed', '失败'],
  ])(
    'uses current detail %s instead of the list old ok snapshot',
    async (status, label) => {
      vi.mocked(getBotNapcatRuntimeDetail).mockResolvedValue({
        accountId: 'A',
        runtimeProfile: { profileStatus: status },
      });
      const wrapper = mount(NapcatRuntimeProfileDrawer, {
        props: { account: account('A'), open: true },
      });
      await flushPromises();
      expect(wrapper.text()).toContain(`Profile ${label}`);
      expect(wrapper.text()).not.toContain('Profile 正常');
      expect(wrapper.text()).toContain('风险 未知');
      wrapper.unmount();
    },
  );

  it('does not show A detail after switching the open drawer to B', async () => {
    const old = deferred();
    vi.mocked(getBotNapcatRuntimeDetail)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({
        accountId: 'B',
        runtimeProfile: { imageRef: 'B image' },
      });
    const wrapper = mount(NapcatRuntimeProfileDrawer, {
      props: { account: account('A'), open: true },
    });
    await wrapper.setProps({ account: account('B') });
    await flushPromises();
    old.resolve({ accountId: 'A', runtimeProfile: { imageRef: 'A image' } });
    await flushPromises();
    expect(wrapper.text()).toContain('B image');
    expect(wrapper.text()).not.toContain('A image');
    wrapper.unmount();
  });

  it('does not keep A detail visible when B read fails', async () => {
    vi.mocked(getBotNapcatRuntimeDetail)
      .mockResolvedValueOnce({
        accountId: 'A',
        runtimeProfile: { imageRef: 'A image' },
      })
      .mockRejectedValueOnce(new Error('read unavailable'));
    const wrapper = mount(NapcatRuntimeProfileDrawer, {
      props: { account: account('A'), open: true },
    });
    await flushPromises();
    await wrapper.setProps({ account: account('B') });
    await flushPromises();
    expect(wrapper.text()).not.toContain('A image');
    expect(wrapper.text()).toContain('读取失败');
    expect(wrapper.text()).toContain('Profile 未知');
    expect(wrapper.text()).not.toContain('Profile 正常');
    wrapper.unmount();
  });

  it('rejects a response whose accountId differs from the requested account', async () => {
    vi.mocked(getBotNapcatRuntimeDetail).mockResolvedValue({
      accountId: 'B',
      runtimeProfile: { imageRef: 'wrong account image' },
    });
    const wrapper = mount(NapcatRuntimeProfileDrawer, {
      props: { account: account('A'), open: true },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('返回账号不匹配');
    expect(wrapper.text()).not.toContain('wrong account image');
    wrapper.unmount();
  });

  it('keeps a closed request from replacing the next open session', async () => {
    const old = deferred();
    vi.mocked(getBotNapcatRuntimeDetail)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({
        accountId: 'A',
        runtimeProfile: { imageRef: 'new session image' },
      });
    const wrapper = mount(NapcatRuntimeProfileDrawer, {
      props: { account: account('A'), open: true },
    });
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    await flushPromises();
    old.resolve({
      accountId: 'A',
      runtimeProfile: { imageRef: 'old session image' },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('new session image');
    expect(wrapper.text()).not.toContain('old session image');
    wrapper.unmount();
  });

  it('retries a failed current account read without retaining the failed snapshot', async () => {
    vi.mocked(getBotNapcatRuntimeDetail)
      .mockRejectedValueOnce(new Error('read unavailable'))
      .mockResolvedValueOnce({
        accountId: 'A',
        inspectionTimeoutMs: 15_000,
        runtimeProfile: { imageRef: 'recovered image' },
      });
    const wrapper = mount(NapcatRuntimeProfileDrawer, {
      props: { account: account('A'), open: true },
    });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('读取失败');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(getBotNapcatRuntimeDetail).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('recovered image');
    expect(wrapper.text()).toContain('15000 ms');
    wrapper.unmount();
  });
});
