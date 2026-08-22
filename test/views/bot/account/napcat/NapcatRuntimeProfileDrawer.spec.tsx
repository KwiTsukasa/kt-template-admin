/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import NapcatRuntimeProfileDrawer from '@test-source/apps/web-antdv-next/src/views/bot/account/napcat/NapcatRuntimeProfileDrawer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getBotNapcatRuntimeDetail } from '#/api/bot/napcat';

vi.mock('#/api/bot/napcat', () => ({
  getBotNapcatRuntimeDetail: vi.fn(),
}));

vi.mock('antdv-next', () => ({
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
  Tag: defineComponent({
    name: 'MockTag',
    props: {
      color: String,
    },
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

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
});
