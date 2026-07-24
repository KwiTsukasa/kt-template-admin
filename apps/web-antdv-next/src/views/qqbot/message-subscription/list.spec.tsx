/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MessageSubscriptionList from './list';

const mocks = vi.hoisted(() => ({
  accessCodes: new Set<string>(),
  api: {
    delete: vi.fn(),
    getList: vi.fn(),
    getOptions: vi.fn(),
    getSources: vi.fn(),
    toggle: vi.fn(),
  },
  modalOpenCreate: vi.fn(),
  modalOpenEdit: vi.fn(),
  tableApi: {
    reload: vi.fn(),
  },
  tableOptions: undefined as any,
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => mocks.accessCodes.has(code)),
  }),
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    name: 'MockPage',
    props: { autoContentHeight: Boolean },
    /** Renders a stable marker exposing the root height contract. */
    setup(props, { slots }) {
      return () =>
        h(
          'main',
          {
            'data-auto-content-height': String(props.autoContentHeight),
            'data-testid': 'page-root',
          },
          slots.default?.(),
        );
    },
  }),
}));

vi.mock('antdv-next', () => ({
  Tag: defineComponent({
    name: 'MockTag',
    /** Renders enabled-state tag text for the body-cell contract. */
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock('#/components/ktTable', () => ({
  KtTable: defineComponent({
    name: 'MockKtTable',
    /** Renders the native table marker and its built-in explicit refresh control. */
    setup(_, { slots }) {
      return () =>
        h('section', { 'data-testid': 'subscription-table' }, [
          h(
            'button',
            {
              'data-testid': 'explicit-refresh',
              onClick: () => mocks.tableApi.reload(),
            },
            'refresh',
          ),
          slots.bodyCell?.({
            column: { key: 'enabled' },
            record: { enabled: true },
          }),
        ]);
    },
  }),
  useKtTable: vi.fn((options) => {
    mocks.tableOptions = options;
    return [vi.fn(), mocks.tableApi];
  }),
}));

vi.mock('./components/MessageSubscriptionModal', () => ({
  default: defineComponent({
    name: 'MockMessageSubscriptionModal',
    emits: ['saved'],
    /** Exposes create/edit commands and one deterministic saved trigger. */
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
}));

vi.mock('#/api/qqbot/message-push', () => ({
  deleteMessageSubscription: mocks.api.delete,
  getMessagePushSources: mocks.api.getSources,
  getMessageSubscriptionList: mocks.api.getList,
  getStunMappingPortChangedOptions: mocks.api.getOptions,
  setMessageSubscriptionEnabled: mocks.api.toggle,
}));

/** Creates one table row whose identifiers exceed JavaScript's safe integer. */
function createRow(): QqbotMessagePushApi.MessageSubscriptionView {
  return {
    createTime: '2026-07-24 10:00:00',
    enabled: true,
    id: '10000000000000001',
    invalidReasonCode: null,
    name: '帕鲁端口变更',
    remark: null,
    sourceConfig: {
      ddnsRecordId: '2041700000000000002',
      portForwardId: '2041700000000000001',
    },
    sourceKey: 'network.stun.mapping-port-changed',
    sourceName: 'STUN 映射端口变更',
    sourceSummary: 'Pal UDP · pal.kwitsukasa.top',
    updateTime: '2026-07-24 10:00:00',
    valid: true,
  };
}

describe('message subscription list', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.accessCodes = new Set([
      'QqBot:MessageSubscription:Create',
      'QqBot:MessageSubscription:Delete',
      'QqBot:MessageSubscription:List',
      'QqBot:MessageSubscription:Toggle',
      'QqBot:MessageSubscription:Update',
    ]);
    mocks.tableOptions = undefined;
    mocks.tableApi.reload.mockResolvedValue(undefined);
    mocks.api.getSources.mockResolvedValue([
      {
        description: 'STUN 端口变化',
        displayName: 'STUN 映射端口变更',
        sourceKey: 'network.stun.mapping-port-changed',
        subscriptionFields: [],
        variables: [],
        version: 1,
      },
    ]);
    mocks.api.getOptions.mockResolvedValue({
      ddnsRecords: [],
      portForwards: [],
    });
    mocks.api.getList.mockResolvedValue({
      items: [createRow()],
      total: 1,
    });
    mocks.api.toggle.mockResolvedValue(createRow());
    mocks.api.delete.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders one auto-height Page root and one native KtTable', async () => {
    const wrapper = mount(MessageSubscriptionList);
    await flushPromises();

    expect(wrapper.findAll('[data-testid="page-root"]')).toHaveLength(1);
    expect(
      wrapper
        .get('[data-testid="page-root"]')
        .attributes('data-auto-content-height'),
    ).toBe('true');
    expect(wrapper.findAll('[data-testid="subscription-table"]')).toHaveLength(
      1,
    );
    expect(mocks.tableOptions.immediate).toBe(false);
    expect(mocks.tableOptions.rowKey).toBe('id');
  });

  it('pins the exact filters, columns, and strict page-result proxy', async () => {
    mount(MessageSubscriptionList);
    await flushPromises();
    const pageResult = { items: [createRow()], total: 1 };
    mocks.api.getList.mockResolvedValueOnce(pageResult);

    await expect(
      mocks.tableOptions.api.list({
        enabled: true,
        name: 'STUN',
        pageNo: 1,
        pageSize: 10,
        sourceKey: 'network.stun.mapping-port-changed',
      }),
    ).resolves.toBe(pageResult);

    expect(
      mocks.tableOptions.formOptions.schema.map(
        (field: any) => field.fieldName,
      ),
    ).toEqual(['name', 'sourceKey', 'enabled']);
    expect(mocks.tableOptions.columns.map((column: any) => column.key)).toEqual(
      ['name', 'source', 'sourceSummary', 'enabled', 'remark', 'updateTime'],
    );
  });

  it('makes zero requests and renders no table or modal without List permission', async () => {
    mocks.accessCodes = new Set([
      'QqBot:MessageSubscription:Create',
      'QqBot:MessageSubscription:Update',
    ]);
    const wrapper = mount(MessageSubscriptionList);
    await flushPromises();

    expect(mocks.tableApi.reload).not.toHaveBeenCalled();
    expect(mocks.api.getSources).not.toHaveBeenCalled();
    expect(mocks.api.getOptions).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="subscription-table"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="modal-saved"]').exists()).toBe(false);
  });

  it('loads list and metadata once, then remains timer-free for 60 seconds', async () => {
    mount(MessageSubscriptionList);
    await flushPromises();

    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.api.getSources).toHaveBeenCalledOnce();
    expect(mocks.api.getOptions).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(60_000);
    await flushPromises();

    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.api.getSources).toHaveBeenCalledOnce();
    expect(mocks.api.getOptions).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('assigns the exact create/edit/toggle/delete permissions and confirmation', () => {
    mount(MessageSubscriptionList);

    expect(mocks.tableOptions.buttons[0].permissionCodes).toEqual([
      'QqBot:MessageSubscription:Create',
    ]);
    expect(
      Object.fromEntries(
        mocks.tableOptions.rowActions.map((action: any) => [
          action.key,
          action.permissionCodes,
        ]),
      ),
    ).toEqual({
      delete: ['QqBot:MessageSubscription:Delete'],
      edit: ['QqBot:MessageSubscription:Update'],
      toggle: ['QqBot:MessageSubscription:Toggle'],
    });
    expect(
      mocks.tableOptions.rowActions.find(
        (action: any) => action.key === 'delete',
      ).confirm,
    ).toBeTypeOf('function');
  });

  it('reloads the row context once after successful string-ID mutations', async () => {
    mount(MessageSubscriptionList);
    const row = createRow();
    const context = { reload: vi.fn(async () => {}) };
    const toggle = mocks.tableOptions.rowActions.find(
      (action: any) => action.key === 'toggle',
    );
    const remove = mocks.tableOptions.rowActions.find(
      (action: any) => action.key === 'delete',
    );

    await toggle.onClick(row, context);
    await remove.onClick(row, context);

    expect(mocks.api.toggle).toHaveBeenCalledWith('10000000000000001', false);
    expect(mocks.api.delete).toHaveBeenCalledWith('10000000000000001');
    expect(context.reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload the row context after failed mutations', async () => {
    mount(MessageSubscriptionList);
    const row = createRow();
    const context = { reload: vi.fn(async () => {}) };
    const toggle = mocks.tableOptions.rowActions.find(
      (action: any) => action.key === 'toggle',
    );
    const remove = mocks.tableOptions.rowActions.find(
      (action: any) => action.key === 'delete',
    );
    mocks.api.toggle.mockRejectedValueOnce(new Error('toggle failed'));
    mocks.api.delete.mockRejectedValueOnce(new Error('delete failed'));

    await expect(toggle.onClick(row, context)).rejects.toThrow('toggle failed');
    await expect(remove.onClick(row, context)).rejects.toThrow('delete failed');

    expect(context.reload).not.toHaveBeenCalled();
  });

  it('opens the page modal and reloads the list once after saved', async () => {
    const wrapper = mount(MessageSubscriptionList);
    await flushPromises();
    mocks.tableApi.reload.mockClear();
    const row = createRow();

    await mocks.tableOptions.buttons[0].onClick({});
    await mocks.tableOptions.rowActions
      .find((action: any) => action.key === 'edit')
      .onClick(row, { reload: vi.fn() });
    await wrapper.get('[data-testid="modal-saved"]').trigger('click');

    expect(mocks.modalOpenCreate).toHaveBeenCalledOnce();
    expect(mocks.modalOpenEdit).toHaveBeenCalledWith(row);
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
  });

  it('explicit refresh reloads only the list and leaves metadata cached', async () => {
    const wrapper = mount(MessageSubscriptionList);
    await flushPromises();
    mocks.tableApi.reload.mockClear();

    await wrapper.get('[data-testid="explicit-refresh"]').trigger('click');
    await flushPromises();

    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.api.getSources).toHaveBeenCalledOnce();
    expect(mocks.api.getOptions).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
