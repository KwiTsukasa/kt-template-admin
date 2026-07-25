/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import type { QqbotApi } from '#/api/qqbot';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import AccountConfigPanel from '@test-source/apps/web-antdv-next/src/views/qqbot/account/components/AccountConfigPanel';
import AccountMessagePushPanel from '@test-source/apps/web-antdv-next/src/views/qqbot/account/components/AccountMessagePushPanel';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  api: {
    bindCommand: vi.fn(),
    bindEvent: vi.fn(),
    bindRule: vi.fn(),
    getCommands: vi.fn(),
    getEvents: vi.fn(),
    getRules: vi.fn(),
    unbindCommand: vi.fn(),
    unbindEvent: vi.fn(),
    unbindRule: vi.fn(),
  },
  legacyTableProps: [] as Array<Record<string, any>>,
}));

vi.mock('#/api/qqbot', () => ({
  bindQqbotAccountCommand: mocks.api.bindCommand,
  bindQqbotAccountRule: mocks.api.bindRule,
  getQqbotCommandList: mocks.api.getCommands,
  getQqbotRuleList: mocks.api.getRules,
  unbindQqbotAccountCommand: mocks.api.unbindCommand,
  unbindQqbotAccountRule: mocks.api.unbindRule,
}));

vi.mock('#/api/qqbot/plugin', () => ({
  bindQqbotEventPlugin: mocks.api.bindEvent,
  getQqbotEventPluginList: mocks.api.getEvents,
  unbindQqbotEventPlugin: mocks.api.unbindEvent,
}));

vi.mock('#/components/ktTable', () => ({
  KtTable: defineComponent({
    name: 'MockLegacyKtTable',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => {
        mocks.legacyTableProps.push(attrs);
        return h('section', { 'data-testid': 'legacy-table' }, [
          slots.title?.(),
          slots.headerControls?.(),
        ]);
      };
    },
  }),
}));

vi.mock('antdv-next', () => ({
  message: {
    success: vi.fn(),
    warning: vi.fn(),
  },
  Spin: defineComponent({
    name: 'MockSpin',
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  }),
  Tabs: defineComponent({
    name: 'MockTabs',
    props: {
      activeKey: String,
      items: Array,
    },
    emits: ['update:activeKey'],
    setup(props, { emit }) {
      return () =>
        h(
          'nav',
          (
            props.items as Array<{ key: string; label: string }> | undefined
          )?.map((item) =>
            h(
              'button',
              {
                'data-tab-key': item.key,
                onClick: () => emit('update:activeKey', item.key),
              },
              item.label,
            ),
          ),
        );
    },
  }),
  Tag: defineComponent({
    name: 'MockTag',
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/qqbot/account/components/AccountMessagePushPanel',
  () => ({
    default: defineComponent({
      name: 'AccountMessagePushPanel',
      props: {
        headerControls: Function,
        selfId: String,
        title: Function,
      },
      setup(props) {
        return () =>
          h('section', { 'data-testid': 'message-push-panel' }, [
            (props.title as (() => unknown) | undefined)?.(),
            (props.headerControls as (() => unknown) | undefined)?.(),
          ] as any);
      },
    }),
  }),
);

function createAccount(): QqbotApi.Account {
  return {
    connectStatus: 'online',
    connectionMode: 'reverse-ws',
    enabled: true,
    id: '1',
    name: 'Bot A',
    selfId: '10000000000000001',
  };
}

describe('qqbot account config panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.legacyTableProps.length = 0;
    mocks.api.getCommands.mockResolvedValue({ list: [], total: 0 });
    mocks.api.getEvents.mockResolvedValue([]);
    mocks.api.getRules.mockResolvedValue({ list: [], total: 0 });
  });

  it('appends the exact fourth tab after all existing tabs', async () => {
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount() },
    });
    await flushPromises();

    expect(
      wrapper
        .findAll('[data-tab-key]')
        .map((tab) => [tab.attributes('data-tab-key'), tab.text()]),
    ).toEqual([
      ['command', '在线命令'],
      ['event', '事件触发'],
      ['rule', '自动回复规则'],
      ['message-push', '消息推送'],
    ]);
  });

  it('keeps the three legacy tabs on their original KtTable boundary', async () => {
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount() },
    });
    await flushPromises();
    const expectedColumns = {
      command: [
        'name',
        'code',
        'aliases',
        'pluginKey',
        'targetType',
        'enabled',
        'bound',
      ],
      event: ['name', 'key', 'triggerType', 'description', 'bound'],
      rule: [
        'name',
        'keyword',
        'matchType',
        'targetType',
        'replyContent',
        'enabled',
        'bound',
      ],
    };

    for (const key of ['command', 'event', 'rule']) {
      await wrapper.get(`[data-tab-key="${key}"]`).trigger('click');
      await flushPromises();
      expect(wrapper.findAll('[data-testid="legacy-table"]')).toHaveLength(1);
      expect(wrapper.find('[data-testid="message-push-panel"]').exists()).toBe(
        false,
      );
      const latest = mocks.legacyTableProps.at(-1);
      expect(
        latest?.columns.map((column: { key: string }) => column.key),
      ).toEqual(expectedColumns[key as keyof typeof expectedColumns]);
      expect(
        latest?.rowActions.map((action: { key: string }) => action.key),
      ).toEqual(['bind', 'unbind']);
      expect(Array.isArray(latest?.dataSource)).toBe(true);
      expect(typeof latest?.rowKey).toBe(
        key === 'event' ? 'function' : 'string',
      );
    }
  });

  it('passes the exact implicit publisher and existing header callbacks', async () => {
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount() },
    });
    await wrapper.get('[data-tab-key="message-push"]').trigger('click');
    await flushPromises();

    const panel = wrapper.getComponent(AccountMessagePushPanel);
    expect(panel.props('selfId')).toBe('10000000000000001');
    expect(panel.props('title')).toBeTypeOf('function');
    expect(panel.props('headerControls')).toBeTypeOf('function');
    expect(wrapper.text()).toContain('Self ID：10000000000000001');
    expect(wrapper.text()).toContain('Bot A');
    expect(wrapper.find('[data-testid="legacy-table"]').exists()).toBe(false);
  });

  it('preserves one stable outer element root across tab changes', async () => {
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount() },
    });
    const root = wrapper.element;

    await wrapper.get('[data-tab-key="message-push"]').trigger('click');
    await flushPromises();
    expect(wrapper.element).toBe(root);
    expect(wrapper.findAll('.qqbot-account-config-panel')).toHaveLength(1);

    await wrapper.get('[data-tab-key="command"]').trigger('click');
    await flushPromises();
    expect(wrapper.element).toBe(root);
    expect(wrapper.findAll('.qqbot-account-config-panel')).toHaveLength(1);
  });
});
