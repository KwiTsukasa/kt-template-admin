/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import type { BotApi } from '#/api/bot';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { useKtTableActions } from '@test-source/apps/web-antdv-next/src/components/kt-table/hooks/useKtTableActions';
import AccountConfigPanel from '@test-source/apps/web-antdv-next/src/views/bot/account/components/AccountConfigPanel';
import AccountMessagePushPanel from '@test-source/apps/web-antdv-next/src/views/bot/account/components/AccountMessagePushPanel';
import { Modal } from 'antdv-next';
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
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
  modalConfirm: vi.fn(),
}));

vi.mock('#/api/bot', () => ({
  bindNapcatPlugin: mocks.api.bindEvent,
  bindBotAccountCommand: mocks.api.bindCommand,
  bindBotAccountRule: mocks.api.bindRule,
  getBotCommandList: mocks.api.getCommands,
  getNapcatPluginList: mocks.api.getEvents,
  getBotRuleList: mocks.api.getRules,
  unbindNapcatPlugin: mocks.api.unbindEvent,
  unbindBotAccountCommand: mocks.api.unbindCommand,
  unbindBotAccountRule: mocks.api.unbindRule,
}));

vi.mock('#/components/kt-table', () => ({
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
  Alert: defineComponent({
    props: { action: null, title: String },
    setup(props) {
      return () => h('div', { role: 'alert' }, [props.title, props.action]);
    },
  }),
  Button: defineComponent({
    setup(_, { attrs, slots }) {
      return () => h('button', attrs, slots.default?.());
    },
  }),
  message: {
    success: mocks.messageSuccess,
    warning: mocks.messageWarning,
  },
  Modal: { confirm: mocks.modalConfirm },
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
  Tooltip: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
}));

vi.mock('#/locales', () => ({ $t: (key: string) => key }));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/bot/account/components/AccountMessagePushPanel',
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

/**
 * 构造可切换身份的配置账号，供跨账号响应和写入归属回归使用。
 * @param selfId - 当前账号的唯一 Self ID。
 * @returns 带该身份的最小有效账号记录。
 */
function createAccount(selfId = '10000000000000001'): BotApi.Account {
  return {
    connectStatus: 'online',
    connectionMode: 'reverse-ws',
    enabled: true,
    id: '1',
    name: 'Bot A',
    selfId,
  };
}

/**
 * 控制面板分类读取或写入完成的先后顺序。
 * @returns 可手动兑现的异步结果。
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

describe('bot account config panel', () => {
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
    wrapper.unmount();
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
    wrapper.unmount();
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
    expect(wrapper.text()).not.toContain('Self ID：10000000000000001');
    expect(wrapper.text()).not.toContain('账号功能配置');
    expect(wrapper.find('[data-testid="legacy-table"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('preserves one stable outer element root across tab changes', async () => {
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount() },
    });
    const root = wrapper.element;

    await wrapper.get('[data-tab-key="message-push"]').trigger('click');
    await flushPromises();
    expect(wrapper.element).toBe(root);
    expect(wrapper.findAll('.bot-account-config-panel')).toHaveLength(1);
    wrapper.unmount();

    await wrapper.get('[data-tab-key="command"]').trigger('click');
    await flushPromises();
    expect(wrapper.element).toBe(root);
    expect(wrapper.findAll('.bot-account-config-panel')).toHaveLength(1);
  });

  it('rejects late A command snapshots after the panel switches to B', async () => {
    const pendingA = deferred<{ list: BotApi.Command[]; total: number }>();
    mocks.api.getCommands.mockImplementation(async (params) => {
      if (params.selfId === 'A') return pendingA.promise;
      return {
        list: [
          {
            id: params.selfId || 'template',
            name: params.selfId || 'template',
          },
        ],
        total: 1,
      };
    });
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    await wrapper.setProps({ account: createAccount('B') });
    await flushPromises();
    pendingA.resolve({
      list: [{ id: 'A', name: 'A' } as BotApi.Command],
      total: 1,
    });
    await flushPromises();
    const latest = mocks.legacyTableProps.at(-1);
    expect(latest?.dataSource.map((row: BotApi.Command) => row.id)).toEqual([
      'template',
      'B',
    ]);
    wrapper.unmount();
  });

  it('shows a command-category failure without declaring unknown bindings empty', async () => {
    mocks.api.getCommands.mockRejectedValueOnce(new Error('commands offline'));
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('命令读取失败');
    expect(wrapper.find('[data-testid="legacy-table"]').exists()).toBe(false);
    const bind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'bind');
    expect(bind.rowVisible({ id: 'cmd-1' })).toBe(false);
    await bind.onClick({ id: 'cmd-1' });
    expect(mocks.api.bindCommand).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does not treat a missing bound-command list as an empty binding set', async () => {
    mocks.api.getCommands.mockImplementation(async (params) => {
      if (params.selfId) return { total: 0 };
      return { list: [{ id: 'cmd-1', name: '命令一' }], total: 1 };
    });
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('命令读取失败');
    expect(wrapper.find('[data-testid="legacy-table"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('rejects an event snapshot for another selfId instead of exposing its actions', async () => {
    mocks.api.getEvents.mockResolvedValueOnce([
      { bound: false, key: 'plugin-b', selfId: 'B' },
    ]);
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    await wrapper.get('[data-tab-key="event"]').trigger('click');
    expect(wrapper.text()).toContain('事件插件读取失败');
    expect(wrapper.find('[data-testid="legacy-table"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('keeps event data usable when command reads fail and retries only commands', async () => {
    mocks.api.getCommands.mockRejectedValueOnce(new Error('commands offline'));
    mocks.api.getEvents.mockResolvedValueOnce([
      { bound: false, key: 'plugin-1', selfId: 'A' },
    ]);
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    await wrapper.get('[data-tab-key="event"]').trigger('click');
    expect(mocks.legacyTableProps.at(-1)?.dataSource).toMatchObject([
      { key: 'plugin-1', selfId: 'A' },
    ]);
    const eventCalls = mocks.api.getEvents.mock.calls.length;
    const ruleCalls = mocks.api.getRules.mock.calls.length;
    await wrapper.get('[data-tab-key="command"]').trigger('click');
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === '重试');
    await retry?.trigger('click');
    await flushPromises();
    expect(mocks.api.getEvents).toHaveBeenCalledTimes(eventCalls);
    expect(mocks.api.getRules).toHaveBeenCalledTimes(ruleCalls);
    expect(wrapper.text()).not.toContain('命令读取失败');
    wrapper.unmount();
  });

  it('pins and deduplicates an A write while B is displayed, then reads A if the user returns', async () => {
    const pendingWrite = deferred<undefined>();
    const command = { id: 'cmd-1', name: '命令一' } as BotApi.Command;
    mocks.api.getCommands.mockImplementation(async (params) => ({
      list: params.selfId ? [] : [command],
      total: params.selfId ? 0 : 1,
    }));
    mocks.api.bindCommand.mockImplementationOnce(() => pendingWrite.promise);
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const bind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'bind');
    const write = bind.onClick(command);
    expect(bind.rowVisible(command)).toBe(false);
    await bind.onClick(command);
    expect(mocks.api.bindCommand).toHaveBeenCalledOnce();
    expect(mocks.api.bindCommand).toHaveBeenCalledWith('A', 'cmd-1');
    await wrapper.setProps({ account: createAccount('B') });
    await flushPromises();
    const bReads = mocks.api.getCommands.mock.calls.filter(
      ([params]) => params.selfId === 'B',
    ).length;
    pendingWrite.resolve(undefined);
    await write;
    await flushPromises();
    expect(
      mocks.api.getCommands.mock.calls.filter(
        ([params]) => params.selfId === 'B',
      ),
    ).toHaveLength(bReads);
    const aReads = mocks.api.getCommands.mock.calls.filter(
      ([params]) => params.selfId === 'A',
    ).length;
    await wrapper.setProps({ account: createAccount('A') });
    await flushPromises();
    expect(
      mocks.api.getCommands.mock.calls.filter(
        ([params]) => params.selfId === 'A',
      ),
    ).toHaveLength(aReads + 1);
    wrapper.unmount();
  });

  it('reads A again when its pending write finishes after the user returns from B', async () => {
    const pendingWrite = deferred<undefined>();
    const command = { id: 'cmd-1', name: '命令一' } as BotApi.Command;
    mocks.api.getCommands.mockImplementation(async (params) => ({
      list: params.selfId ? [] : [command],
      total: params.selfId ? 0 : 1,
    }));
    mocks.api.bindCommand.mockImplementationOnce(() => pendingWrite.promise);
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const bind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'bind');
    const write = bind.onClick(command);
    await wrapper.setProps({ account: createAccount('B') });
    await wrapper.setProps({ account: createAccount('A') });
    await flushPromises();
    const aReads = mocks.api.getCommands.mock.calls.filter(
      ([params]) => params.selfId === 'A',
    ).length;
    pendingWrite.resolve(undefined);
    await write;
    await flushPromises();
    expect(
      mocks.api.getCommands.mock.calls.filter(
        ([params]) => params.selfId === 'A',
      ),
    ).toHaveLength(aReads + 1);
    wrapper.unmount();
  });

  it('rejects late event rows from A and keeps rule failures local', async () => {
    const pendingA = deferred<BotApi.AdapterPluginBinding[]>();
    mocks.api.getEvents.mockImplementation((selfId) => {
      if (selfId === 'A') return pendingA.promise;
      return Promise.resolve([{ bound: false, key: 'plugin-b', selfId: 'B' }]);
    });
    mocks.api.getRules.mockImplementation(async (params) => {
      if (params.selfId === 'B') throw new Error('rules offline');
      return { list: [], total: 0 };
    });
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await wrapper.setProps({ account: createAccount('B') });
    await flushPromises();
    pendingA.resolve([
      {
        bound: false,
        key: 'plugin-a',
        selfId: 'A',
      } as BotApi.AdapterPluginBinding,
    ]);
    await flushPromises();
    await wrapper.get('[data-tab-key="event"]').trigger('click');
    expect(mocks.legacyTableProps.at(-1)?.dataSource).toMatchObject([
      { key: 'plugin-b', selfId: 'B' },
    ]);
    await wrapper.get('[data-tab-key="rule"]').trigger('click');
    expect(wrapper.text()).toContain('规则读取失败');
    expect(wrapper.find('[data-testid="legacy-table"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('writes event and rule identities and reloads only their own category', async () => {
    const rule = { id: 'rule-1', name: '规则一' } as BotApi.Rule;
    const plugin = {
      bound: false,
      key: 'plugin-1',
      name: '插件一',
      selfId: 'A',
    } as BotApi.AdapterPluginBinding;
    mocks.api.getEvents.mockResolvedValue([plugin]);
    mocks.api.getRules.mockImplementation(async () => ({
      list: [rule],
      total: 1,
    }));
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    await wrapper.get('[data-tab-key="event"]').trigger('click');
    const eventCalls = mocks.api.getEvents.mock.calls.length;
    const commandCalls = mocks.api.getCommands.mock.calls.length;
    const ruleCalls = mocks.api.getRules.mock.calls.length;
    const bindEvent = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'bind');
    await bindEvent.onClick(plugin);
    expect(mocks.api.bindEvent).toHaveBeenCalledWith('A', 'plugin-1');
    expect(mocks.api.getEvents).toHaveBeenCalledTimes(eventCalls + 1);
    expect(mocks.api.getCommands).toHaveBeenCalledTimes(commandCalls);
    expect(mocks.api.getRules).toHaveBeenCalledTimes(ruleCalls);

    await wrapper.get('[data-tab-key="rule"]').trigger('click');
    const unbindRule = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'unbind');
    await unbindRule.onClick(rule);
    expect(mocks.api.unbindRule).toHaveBeenCalledWith('A', 'rule-1');
    expect(mocks.api.getRules).toHaveBeenCalledTimes(ruleCalls + 2);
    expect(mocks.api.getEvents).toHaveBeenCalledTimes(eventCalls + 1);
    wrapper.unmount();
  });

  it('rejects an A confirmation after the account session changed A to B to A', async () => {
    const command = { id: 'cmd-1', name: '命令一' } as BotApi.Command;
    mocks.api.getCommands.mockImplementation(async (params) => ({
      list: params.selfId ? [command] : [command],
      total: 1,
    }));
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const unbind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'unbind');
    expect(unbind.confirm(command)).toContain('账号 A');
    await wrapper.setProps({ account: createAccount('B') });
    await wrapper.setProps({ account: createAccount('A') });
    await flushPromises();
    await unbind.onClick(command);
    expect(mocks.api.unbindCommand).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('shares only an in-flight A write across unmount and remount, then reloads settled facts', async () => {
    const pendingWrite = deferred<undefined>();
    const command = { id: 'cmd-1', name: '命令一' } as BotApi.Command;
    let saved = false;
    mocks.api.getCommands.mockImplementation(async (params) => ({
      list: params.selfId ? (saved ? [command] : []) : [command],
      total: params.selfId && !saved ? 0 : 1,
    }));
    mocks.api.bindCommand.mockImplementationOnce(() => pendingWrite.promise);
    const first = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const firstBind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'bind');
    const write = firstBind.onClick(command);
    first.unmount();

    const second = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const secondBind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'bind');
    expect(secondBind.rowVisible(command)).toBe(false);
    await secondBind.onClick(command);
    expect(mocks.api.bindCommand).toHaveBeenCalledOnce();
    const readsBeforeSettle = mocks.api.getCommands.mock.calls.filter(
      ([params]) => params.selfId === 'A',
    ).length;
    saved = true;
    pendingWrite.resolve(undefined);
    await write;
    await flushPromises();
    expect(
      mocks.api.getCommands.mock.calls.filter(
        ([params]) => params.selfId === 'A',
      ),
    ).toHaveLength(readsBeforeSettle + 1);
    const secondUnbind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'unbind');
    expect(secondUnbind.rowVisible(command)).toBe(true);
    second.unmount();
  });

  it('recovers authoritative command state after a failed write without a success toast or pending lock', async () => {
    const command = { id: 'cmd-1', name: '命令一' } as BotApi.Command;
    mocks.api.getCommands.mockImplementation(async (params) => ({
      list: params.selfId ? [] : [command],
      total: params.selfId ? 0 : 1,
    }));
    mocks.api.bindCommand.mockRejectedValueOnce(new Error('network unknown'));
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const bind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'bind');
    const commandReads = mocks.api.getCommands.mock.calls.length;
    const eventReads = mocks.api.getEvents.mock.calls.length;
    const ruleReads = mocks.api.getRules.mock.calls.length;
    await expect(bind.onClick(command)).resolves.toBeUndefined();
    await flushPromises();
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(mocks.messageWarning).toHaveBeenCalled();
    expect(mocks.api.getCommands).toHaveBeenCalledTimes(commandReads + 2);
    expect(mocks.api.getEvents).toHaveBeenCalledTimes(eventReads);
    expect(mocks.api.getRules).toHaveBeenCalledTimes(ruleReads);
    expect(bind.rowVisible(command)).toBe(true);
    mocks.api.bindCommand.mockResolvedValueOnce(true);
    await bind.onClick(command);
    expect(mocks.api.bindCommand).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('resolves a failed unbind callback with a warning and rereads the bound fact', async () => {
    const command = { id: 'cmd-1', name: '命令一' } as BotApi.Command;
    mocks.api.getCommands.mockResolvedValue({ list: [command], total: 1 });
    mocks.api.unbindCommand.mockRejectedValueOnce(new Error('network unknown'));
    const wrapper = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const unbind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'unbind');
    const reads = mocks.api.getCommands.mock.calls.length;
    await expect(unbind.onClick(command)).resolves.toBeUndefined();
    await flushPromises();
    expect(mocks.api.unbindCommand).toHaveBeenCalledWith('A', 'cmd-1');
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(mocks.messageWarning).toHaveBeenCalled();
    expect(mocks.api.getCommands).toHaveBeenCalledTimes(reads + 2);
    expect(unbind.rowVisible(command)).toBe(true);
    wrapper.unmount();
  });

  it('handles a failed unbind through the real KtTable row click and confirm callback', async () => {
    const command = { id: 'cmd-1', name: '命令一' } as BotApi.Command;
    mocks.api.getCommands.mockResolvedValue({ list: [command], total: 1 });
    mocks.api.unbindCommand.mockRejectedValueOnce(new Error('network unknown'));
    const panel = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const unbind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'unbind');
    const context = {
      formApi: {},
      getRows: vi.fn(() => []),
      getSearchValues: vi.fn(async () => ({})),
      registerHook: vi.fn(),
      reload: vi.fn(async () => {}),
      reset: vi.fn(async () => {}),
      search: vi.fn(async () => {}),
      selectedRowKeys: vi.fn(() => []),
      selectedRows: vi.fn(() => []),
      setSearchValues: vi.fn(async () => {}),
      unregisterHook: vi.fn(),
    } as any;
    const runtime = useKtTableActions({
      context,
      permissions: {
        filterVisibleActions: (actions: any[]) => actions,
        filterVisibleButtons: (buttons: any[]) => buttons,
        resolveBoolean: (value: unknown, fallback: boolean) =>
          typeof value === 'boolean' ? value : fallback,
      },
      props: {
        buttons: [],
        modules: [],
        rowActions: [unbind],
        showDefaultButtons: false,
      } as any,
      reload: context.reload,
      reset: context.reset,
      runHook: vi.fn(async () => {}),
      search: context.search,
    });
    const Harness = defineComponent({
      setup() {
        return () => runtime.renderRowAction(unbind, command);
      },
    });
    const button = mount(Harness);
    await button.get('button').trigger('click');
    expect(Modal.confirm).toHaveBeenCalledOnce();
    const onOk = vi.mocked(Modal.confirm).mock.lastCall?.[0]
      .onOk as () => Promise<void>;
    await expect(onOk()).resolves.toBeUndefined();
    await flushPromises();
    expect(mocks.api.unbindCommand).toHaveBeenCalledWith('A', 'cmd-1');
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(mocks.messageWarning).toHaveBeenCalled();
    button.unmount();
    panel.unmount();
  });

  it('releases a failed A write after unmount and notifies the new A panel', async () => {
    const pendingWrite = deferred<undefined>();
    const command = { id: 'cmd-1', name: '命令一' } as BotApi.Command;
    mocks.api.getCommands.mockImplementation(async (params) => ({
      list: params.selfId ? [] : [command],
      total: params.selfId ? 0 : 1,
    }));
    mocks.api.bindCommand.mockImplementationOnce(() => pendingWrite.promise);
    const first = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const bind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'bind');
    const write = bind.onClick(command);
    first.unmount();
    const second = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const aReads = mocks.api.getCommands.mock.calls.filter(
      ([params]) => params.selfId === 'A',
    ).length;
    const secondBind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'bind');
    expect(secondBind.rowVisible(command)).toBe(false);
    pendingWrite.reject(new Error('network unknown'));
    await expect(write).resolves.toBeUndefined();
    await flushPromises();
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(
      mocks.api.getCommands.mock.calls.filter(
        ([params]) => params.selfId === 'A',
      ),
    ).toHaveLength(aReads + 1);
    expect(secondBind.rowVisible(command)).toBe(true);
    mocks.api.bindCommand.mockResolvedValueOnce(true);
    await secondBind.onClick(command);
    expect(mocks.api.bindCommand).toHaveBeenCalledTimes(2);
    second.unmount();
  });

  it('does not refresh B when an unmounted A write fails', async () => {
    const pendingWrite = deferred<undefined>();
    const command = { id: 'cmd-1', name: '命令一' } as BotApi.Command;
    mocks.api.getCommands.mockImplementation(async (params) => ({
      list: params.selfId ? [] : [command],
      total: params.selfId ? 0 : 1,
    }));
    mocks.api.bindCommand.mockImplementationOnce(() => pendingWrite.promise);
    const first = mount(AccountConfigPanel, {
      props: { account: createAccount('A') },
    });
    await flushPromises();
    const bind = mocks.legacyTableProps
      .at(-1)
      ?.rowActions.find((action: { key: string }) => action.key === 'bind');
    const write = bind.onClick(command);
    first.unmount();
    const second = mount(AccountConfigPanel, {
      props: { account: createAccount('B') },
    });
    await flushPromises();
    const bReads = mocks.api.getCommands.mock.calls.filter(
      ([params]) => params.selfId === 'B',
    ).length;
    pendingWrite.reject(new Error('network unknown'));
    await expect(write).resolves.toBeUndefined();
    await flushPromises();
    expect(
      mocks.api.getCommands.mock.calls.filter(
        ([params]) => params.selfId === 'B',
      ),
    ).toHaveLength(bReads);
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    second.unmount();
  });
});
