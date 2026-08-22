/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { MessageManagementApi } from '#/api/message-management';
import type { BotMessageSubscriberApi } from '#/api/message-management/subscribers/bot';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import AccountMessagePushPanel from '@test-source/apps/web-antdv-next/src/views/bot/account/components/AccountMessagePushPanel';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tableApi = {
    reload: vi.fn(async () => mocks.tableOptions.api.list()),
  };
  return {
    accessCodes: new Set<string>(),
    api: {
      delete: vi.fn(),
      getBindings: vi.fn(),
      getSubscriptions: vi.fn(),
      getTargets: vi.fn(),
      toggle: vi.fn(),
    },
    tableApi,
    tableOptions: undefined as any,
  };
});

vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => mocks.accessCodes.has(code)),
  }),
}));

vi.mock('@vben/icons', () => ({
  Plus: defineComponent({ render: () => h('i') }),
}));

vi.mock('antdv-next', () => ({
  Space: defineComponent({
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  }),
  Tag: defineComponent({
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock('#/api/message-management', () => ({
  getMessageSubscriptionList: mocks.api.getSubscriptions,
}));

vi.mock('#/api/message-management/subscribers/bot', () => ({
  deleteBotMessageBinding: mocks.api.delete,
  getBotMessageBindings: mocks.api.getBindings,
  getBotMessageTargets: mocks.api.getTargets,
  setBotMessageBindingEnabled: mocks.api.toggle,
}));

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    setup(_, { slots }) {
      return () =>
        h('section', { 'data-testid': 'bot-binding-table' }, [
          slots.bodyCell?.({
            column: { key: 'template' },
            record: createBinding(),
          }),
        ]);
    },
  }),
  useKtTable: vi.fn((options) => {
    mocks.tableOptions = options;
    return [vi.fn(), mocks.tableApi];
  }),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/bot/account/components/AccountMessagePushModal',
  () => ({
    default: defineComponent({ render: () => h('div') }),
  }),
);

/**
 * 构造含两个模板的 Bot 统一订阅。
 *
 * @returns 可供账号面板目录加载的订阅视图。
 */
function createSubscription(): MessageManagementApi.MessageSubscriptionView {
  return {
    createTime: '2026-08-18 09:00:00',
    enabled: true,
    id: '10000000000000001',
    invalidReasonCode: null,
    name: '网络状态通知',
    remark: null,
    sourceConfig: {},
    sourceKey: 'network.changed',
    sourceName: '网络状态变化',
    sourceSummary: '-',
    subscriberKey: 'bot',
    subscriberName: 'Bot',
    templates: [
      { id: '20000000000000001', name: '简讯', sortOrder: 0 },
      { id: '20000000000000002', name: '详情', sortOrder: 1 },
    ],
    updateTime: '2026-08-18 09:00:00',
    valid: true,
  };
}

/**
 * 构造账号接入统一订阅后的 Bot 私有配置视图。
 *
 * @returns 带完整模板摘要与一个 QQ 目标的配置记录。
 */
function createBinding(): BotMessageSubscriberApi.PublishBindingView {
  return {
    available: true,
    createTime: '2026-08-18 09:00:00',
    enabled: true,
    id: '30000000000000001',
    invalidReasonCode: null,
    sourceKey: 'network.changed',
    sourceName: '网络状态变化',
    subscriptionId: '10000000000000001',
    subscriptionName: '网络状态通知',
    targets: [
      {
        enabled: true,
        id: '40000000000000001',
        targetId: '123456789',
        targetName: '测试群',
        targetType: 'group',
      },
    ],
    templates: createSubscription().templates,
    updateTime: '2026-08-18 09:00:00',
  };
}

describe('bot message subscriber account panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accessCodes = new Set([
      'Bot:Account:MessagePush:Create',
      'Bot:Account:MessagePush:Delete',
      'Bot:Account:MessagePush:List',
      'Bot:Account:MessagePush:Toggle',
      'Bot:Account:MessagePush:Update',
    ]);
    mocks.api.getBindings.mockResolvedValue([createBinding()]);
    mocks.api.getSubscriptions.mockResolvedValue({
      items: [createSubscription()],
      total: 1,
    });
    mocks.api.getTargets.mockResolvedValue({
      available: true,
      options: [],
      reasonCode: null,
    });
    mocks.api.toggle.mockResolvedValue(createBinding());
    mocks.api.delete.mockResolvedValue(true);
  });

  it('loads only Bot subscriptions and displays every bound template', async () => {
    const wrapper = mount(AccountMessagePushPanel, {
      props: {
        headerControls: () => null,
        selfId: '10001',
        title: () => 'Bot',
      },
    });
    await flushPromises();

    expect(mocks.api.getSubscriptions).toHaveBeenCalledWith({
      pageNo: 1,
      pageSize: 100,
      subscriberKey: 'bot',
    });
    expect(mocks.api.getTargets).toHaveBeenCalledWith('10001');
    expect(wrapper.text()).toContain('简讯');
    expect(wrapper.text()).toContain('详情');
    expect(
      mocks.tableOptions.columns.some(
        (column: any) => column.key === 'template',
      ),
    ).toBe(true);
  });

  it('toggles and removes only Bot private subscriber configuration', async () => {
    mount(AccountMessagePushPanel, {
      props: {
        headerControls: () => null,
        selfId: '10001',
        title: () => 'Bot',
      },
    });
    const row = createBinding();
    const context = { reload: vi.fn(async () => {}) };
    const actions = Object.fromEntries(
      mocks.tableOptions.rowActions.map((action: any) => [action.key, action]),
    );

    await actions.toggle.onClick(row, context);
    await actions.delete.onClick(row, context);
    expect(mocks.api.toggle).toHaveBeenCalledWith('10001', row.id, false);
    expect(mocks.api.delete).toHaveBeenCalledWith('10001', row.id);
    expect(context.reload).toHaveBeenCalledTimes(2);
  });
});
