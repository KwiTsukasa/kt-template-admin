/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { MessageManagementApi } from '#/api/message-management';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MessageSubscriptionList from '@test-source/apps/web-antdv-next/src/views/message-management/subscription/list';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tableApi = {
    reload: vi.fn(async () =>
      mocks.tableOptions.api.list({ pageNo: 1, pageSize: 10 }),
    ),
  };
  return {
    accessCodes: new Set<string>(),
    api: {
      delete: vi.fn(),
      getList: vi.fn(),
      getSources: vi.fn(),
      getSubscribers: vi.fn(),
      getTemplates: vi.fn(),
      toggle: vi.fn(),
    },
    modalOpenCreate: vi.fn(),
    modalOpenEdit: vi.fn(),
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

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    name: 'MockPage',
    setup(_, { slots }) {
      return () => h('main', { 'data-testid': 'page-root' }, slots.default?.());
    },
  }),
}));

vi.mock('@vben/icons', () => ({
  Plus: defineComponent({ render: () => h('i') }),
}));

vi.mock('antdv-next', () => ({
  Space: defineComponent({
    name: 'MockSpace',
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  }),
  Tag: defineComponent({
    name: 'MockTag',
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock('#/api/message-management', () => ({
  deleteMessageSubscription: mocks.api.delete,
  getMessageSources: mocks.api.getSources,
  getMessageSubscribers: mocks.api.getSubscribers,
  getMessageSubscriptionList: mocks.api.getList,
  getMessageTemplateList: mocks.api.getTemplates,
  setMessageSubscriptionEnabled: mocks.api.toggle,
}));

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    name: 'MockKtTable',
    setup(_, { slots }) {
      return () =>
        h('section', { 'data-testid': 'subscription-table' }, [
          slots.bodyCell?.({
            column: { key: 'templates' },
            record: createSubscription(),
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
  '@test-source/apps/web-antdv-next/src/views/message-management/subscription/components/MessageSubscriptionModal',
  () => ({
    default: defineComponent({
      name: 'MockMessageSubscriptionModal',
      props: {
        sources: { default: () => [], type: Array },
        subscribers: { default: () => [], type: Array },
        templates: { default: () => [], type: Array },
      },
      emits: ['saved'],
      setup(_, { emit, expose }) {
        expose({
          openCreate: mocks.modalOpenCreate,
          openEdit: mocks.modalOpenEdit,
        });
        return () =>
          h(
            'button',
            {
              'data-testid': 'modal-saved',
              onClick: () => emit('saved'),
            },
            'saved',
          );
      },
    }),
  }),
);

/**
 * 构造带两个有序模板和唯一订阅者的统一消息订阅。
 *
 * @returns 可供列表及行操作测试使用的订阅视图。
 */
function createSubscription(): MessageManagementApi.MessageSubscriptionView {
  return {
    createTime: '2026-08-18 09:00:00',
    enabled: true,
    id: '10000000000000001',
    invalidReasonCode: null,
    name: '网络状态通知',
    remark: null,
    sourceConfig: { channelId: 'channel-a' },
    sourceKey: 'network.changed',
    sourceName: '网络状态变化',
    sourceSummary: 'channel-a',
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
 * 构造消息管理页面使用的来源协议定义。
 *
 * @returns 无动态字段的网络消息源定义。
 */
function createSource(): MessageManagementApi.SystemMessageSourceDefinition {
  return {
    description: 'network source',
    displayName: '网络状态变化',
    sourceKey: 'network.changed',
    subscriptionFields: [],
    variables: [],
    version: 1,
  };
}

/**
 * 构造列表目录使用的消息模板。
 *
 * @returns 与订阅消息源一致的启用模板。
 */
function createTemplate(): MessageManagementApi.MessageTemplateView {
  return {
    content: 'content',
    createTime: '2026-08-18 09:00:00',
    enabled: true,
    id: '20000000000000001',
    name: '简讯',
    referenceCount: 1,
    remark: null,
    sourceKey: 'network.changed',
    sourceName: '网络状态变化',
    updateTime: '2026-08-18 09:00:00',
  };
}

describe('message management subscription list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accessCodes = new Set([
      'MessageManagement:Subscription:Create',
      'MessageManagement:Subscription:Delete',
      'MessageManagement:Subscription:List',
      'MessageManagement:Subscription:Toggle',
      'MessageManagement:Subscription:Update',
    ]);
    mocks.api.getList.mockResolvedValue({
      items: [createSubscription()],
      total: 1,
    });
    mocks.api.getSources.mockResolvedValue([createSource()]);
    mocks.api.getSubscribers.mockResolvedValue([
      {
        description: 'QQ delivery',
        displayName: 'Bot',
        subscriberKey: 'bot',
        version: 1,
      },
    ]);
    mocks.api.getTemplates.mockResolvedValue({
      items: [createTemplate()],
      total: 1,
    });
    mocks.api.toggle.mockResolvedValue(createSubscription());
    mocks.api.delete.mockResolvedValue(true);
  });

  it('loads protocol catalogs and renders every template bound to a subscription', async () => {
    const wrapper = mount(MessageSubscriptionList);
    await flushPromises();

    expect(wrapper.findAll('[data-testid="page-root"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-testid="subscription-table"]')).toHaveLength(
      1,
    );
    expect(wrapper.text()).toContain('简讯');
    expect(wrapper.text()).toContain('详情');
    expect(mocks.api.getSources).toHaveBeenCalledOnce();
    expect(mocks.api.getSubscribers).toHaveBeenCalledOnce();
    expect(mocks.api.getTemplates).toHaveBeenCalledWith({
      pageNo: 1,
      pageSize: 100,
    });
    expect(mocks.tableOptions.columns.map((column: any) => column.key)).toEqual(
      [
        'name',
        'templates',
        'subscriber',
        'source',
        'sourceSummary',
        'enabled',
        'remark',
        'updateTime',
      ],
    );
    expect(
      mocks.tableOptions.formOptions.schema.map(
        (field: any) => field.fieldName,
      ),
    ).toEqual(['name', 'templateId', 'subscriberKey', 'sourceKey', 'enabled']);
  });

  it('uses message-management permissions and keeps row mutations scoped to the subscription', async () => {
    mount(MessageSubscriptionList);
    const row = createSubscription();
    const context = { reload: vi.fn(async () => {}) };
    const actions = Object.fromEntries(
      mocks.tableOptions.rowActions.map((action: any) => [action.key, action]),
    );

    expect(mocks.tableOptions.buttons[0].permissionCodes).toEqual([
      'MessageManagement:Subscription:Create',
    ]);
    expect(actions.edit.permissionCodes).toEqual([
      'MessageManagement:Subscription:Update',
    ]);
    await actions.toggle.onClick(row, context);
    await actions.delete.onClick(row, context);
    expect(mocks.api.toggle).toHaveBeenCalledWith(row.id, false);
    expect(mocks.api.delete).toHaveBeenCalledWith(row.id);
    expect(context.reload).toHaveBeenCalledTimes(2);
  });

  it('does not load or render protocol data without list permission', async () => {
    mocks.accessCodes = new Set();
    const wrapper = mount(MessageSubscriptionList);
    await flushPromises();

    expect(wrapper.find('[data-testid="subscription-table"]').exists()).toBe(
      false,
    );
    expect(mocks.tableApi.reload).not.toHaveBeenCalled();
    expect(mocks.api.getSources).not.toHaveBeenCalled();
    expect(mocks.api.getSubscribers).not.toHaveBeenCalled();
    expect(mocks.api.getTemplates).not.toHaveBeenCalled();
  });
});
