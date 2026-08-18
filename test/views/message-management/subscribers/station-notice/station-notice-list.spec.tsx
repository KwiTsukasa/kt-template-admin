/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { MessageManagementApi } from '#/api/message-management';
import type { StationNoticeMessageSubscriberApi } from '#/api/message-management/subscribers/station-notice';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import StationNoticeList from '@test-source/apps/web-antdv-next/src/views/message-management/subscribers/station-notice/list';
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

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
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

vi.mock('#/api/message-management/subscribers/station-notice', () => ({
  deleteStationNoticeMessageBinding: mocks.api.delete,
  getStationNoticeMessageBindings: mocks.api.getBindings,
  setStationNoticeMessageBindingEnabled: mocks.api.toggle,
}));

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    setup(_, { slots }) {
      return () =>
        h('section', { 'data-testid': 'station-binding-table' }, [
          slots.bodyCell?.({
            column: { key: 'templates' },
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
  '@test-source/apps/web-antdv-next/src/views/message-management/subscribers/station-notice/components/StationNoticeBindingModal',
  () => ({
    default: defineComponent({ render: () => h('div') }),
  }),
);

/**
 * 构造归属站内信订阅者且绑定两个模板的统一订阅。
 *
 * @returns 站内信配置页面使用的统一订阅视图。
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
    subscriberKey: 'station-notice',
    subscriberName: '站内信',
    templates: [
      { id: '20000000000000001', name: '简讯', sortOrder: 0 },
      { id: '20000000000000002', name: '详情', sortOrder: 1 },
    ],
    updateTime: '2026-08-18 09:00:00',
    valid: true,
  };
}

/**
 * 构造接入统一订阅后的站内信私有配置。
 *
 * @returns 带完整模板摘要和角色策略的站内信配置视图。
 */
function createBinding(): StationNoticeMessageSubscriberApi.BindingView {
  return {
    available: true,
    createTime: '2026-08-18 09:00:00',
    enabled: true,
    id: '30000000000000001',
    invalidReasonCode: null,
    notifyRoleCode: 'super',
    sourceKey: 'network.changed',
    sourceName: '网络状态变化',
    subscriptionId: '10000000000000001',
    subscriptionName: '网络状态通知',
    templates: createSubscription().templates,
    title: '网络连接状态变化',
    updateTime: '2026-08-18 09:00:00',
  };
}

describe('station notice message subscriber list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accessCodes = new Set([
      'MessageManagement:Push:Create',
      'MessageManagement:Push:Delete',
      'MessageManagement:Push:List',
      'MessageManagement:Push:Toggle',
      'MessageManagement:Push:Update',
    ]);
    mocks.api.getBindings.mockResolvedValue([createBinding()]);
    mocks.api.getSubscriptions.mockResolvedValue({
      items: [createSubscription()],
      total: 1,
    });
    mocks.api.toggle.mockResolvedValue(createBinding());
    mocks.api.delete.mockResolvedValue(null);
  });

  it('loads only station-notice subscriptions and renders every bound template', async () => {
    const wrapper = mount(StationNoticeList);
    await flushPromises();

    expect(mocks.api.getSubscriptions).toHaveBeenCalledWith({
      pageNo: 1,
      pageSize: 100,
      subscriberKey: 'station-notice',
    });
    expect(wrapper.text()).toContain('简讯');
    expect(wrapper.text()).toContain('详情');
    expect(wrapper.find('[data-testid="station-binding-table"]').exists()).toBe(
      true,
    );
  });

  it('mutates only station-notice private configuration', async () => {
    mount(StationNoticeList);
    const row = createBinding();
    const context = { reload: vi.fn(async () => {}) };
    const actions = Object.fromEntries(
      mocks.tableOptions.rowActions.map((action: any) => [action.key, action]),
    );

    await actions.toggle.onClick(row, context);
    await actions.delete.onClick(row, context);
    expect(mocks.api.toggle).toHaveBeenCalledWith(row.id, false);
    expect(mocks.api.delete).toHaveBeenCalledWith(row.id);
    expect(context.reload).toHaveBeenCalledTimes(2);
  });
});
