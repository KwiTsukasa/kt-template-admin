/* @vitest-environment happy-dom */

/* eslint-disable no-template-curly-in-string, vue/one-component-per-file, vue/require-default-prop */

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import AccountMessagePushPanel from '@test-source/apps/web-antdv-next/src/views/qqbot/account/components/AccountMessagePushPanel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = {
    accessCodes: new Set<string>(),
    api: {
      deleteBinding: vi.fn(),
      getBindings: vi.fn(),
      getSubscriptions: vi.fn(),
      getTargets: vi.fn(),
      getTemplates: vi.fn(),
      toggleBinding: vi.fn(),
    },
    modalOpenCreate: vi.fn(),
    modalOpenEdit: vi.fn(),
    registeredTableOptions: undefined as any,
    registerTable: vi.fn(),
    renderedPage: undefined as any,
    tableApi: {
      reload: vi.fn(),
    },
    tableOptions: undefined as any,
  };
  state.registerTable.mockImplementation(() => {
    state.registeredTableOptions = state.tableOptions;
  });
  state.tableApi.reload.mockImplementation(async () => {
    if (!state.registeredTableOptions) {
      throw new Error('[MockKtTable]: table is not registered yet.');
    }
    const page = await state.registeredTableOptions.api.list({
      pageNo: 1,
      pageSize: 10,
    });
    state.renderedPage = page;
    return page;
  });
  return state;
});

vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => mocks.accessCodes.has(code)),
  }),
}));

vi.mock('@vben/icons', () => ({
  Plus: defineComponent({
    name: 'MockPlusIcon',
    setup: () => () => h('i'),
  }),
}));

vi.mock('antdv-next', () => ({
  Space: defineComponent({
    name: 'MockSpace',
    setup:
      (_: unknown, { slots }: any) =>
      () =>
        h('span', slots.default?.()),
  }),
  Tag: defineComponent({
    name: 'MockTag',
    setup:
      (_: unknown, { slots }: any) =>
      () =>
        h('span', slots.default?.()),
  }),
}));

vi.mock('#/components/ktTable', () => ({
  KtTable: defineComponent({
    name: 'MockAccountMessagePushKtTable',
    emits: ['register'],
    setup(_, { emit, slots }) {
      emit('register', {});
      return () =>
        h('section', { 'data-testid': 'message-push-table' }, [
          slots.title?.(),
          slots.headerControls?.(),
        ]);
    },
  }),
  useKtTable: vi.fn((options) => {
    mocks.tableOptions = options;
    return [mocks.registerTable, mocks.tableApi];
  }),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/qqbot/account/components/AccountMessagePushModal',
  () => ({
    default: defineComponent({
      name: 'MockAccountMessagePushModal',
      props: {
        selfId: String,
        subscriptions: Array,
        targetOptions: Object,
        targetOptionsLoading: Boolean,
        templates: Array,
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

vi.mock('#/api/qqbot/message-push', () => ({
  deleteAccountMessagePushBinding: mocks.api.deleteBinding,
  getAccountMessagePushBindings: mocks.api.getBindings,
  getAccountMessagePushTargets: mocks.api.getTargets,
  getMessageSubscriptionList: mocks.api.getSubscriptions,
  getMessageTemplateList: mocks.api.getTemplates,
  setAccountMessagePushBindingEnabled: mocks.api.toggleBinding,
}));

function createBinding(
  overrides: Partial<QqbotMessagePushApi.QqbotMessagePublishBindingView> = {},
): QqbotMessagePushApi.QqbotMessagePublishBindingView {
  return {
    available: true,
    createTime: '2026-07-24 10:00:00',
    enabled: true,
    id: '10000000000000001',
    invalidReasonCode: null,
    sourceKey: 'network.stun.mapping-port-changed',
    sourceName: 'STUN 映射端口变更',
    subscriptionId: '20000000000000001',
    subscriptionName: '帕鲁端口变更',
    targets: [
      {
        enabled: true,
        id: '30000000000000001',
        targetId: '40000000000000001',
        targetName: '测试群',
        targetType: 'group',
      },
    ],
    templateId: '50000000000000001',
    templateName: '默认模板',
    updateTime: '2026-07-24 10:00:00',
    ...overrides,
  };
}

function createSubscription(
  id = '20000000000000001',
): QqbotMessagePushApi.MessageSubscriptionView {
  return {
    createTime: '2026-07-24 10:00:00',
    enabled: true,
    id,
    invalidReasonCode: null,
    name: `订阅 ${id}`,
    remark: null,
    sourceConfig: {
      ddnsRecordId: '60000000000000001',
      portForwardId: '70000000000000001',
    },
    sourceKey: 'network.stun.mapping-port-changed',
    sourceName: 'STUN 映射端口变更',
    sourceSummary: '帕鲁 · pal.kwitsukasa.top',
    updateTime: '2026-07-24 10:00:00',
    valid: true,
  };
}

function createTemplate(
  id = '50000000000000001',
): QqbotMessagePushApi.MessageTemplateView {
  return {
    content: '当前STUN的端口已变更为${{endpoint}}',
    createTime: '2026-07-24 10:00:00',
    enabled: true,
    id,
    name: `模板 ${id}`,
    referenceCount: 0,
    remark: null,
    sourceKey: 'network.stun.mapping-port-changed',
    sourceName: 'STUN 映射端口变更',
    updateTime: '2026-07-24 10:00:00',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mountPanel(selfId = '10000000000000001') {
  return mount(AccountMessagePushPanel, {
    props: {
      headerControls: () => h('div', { 'data-testid': 'account-tabs' }),
      selfId,
      title: () => h('div', { 'data-testid': 'account-title' }),
    },
  });
}

describe('account message-push panel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.accessCodes = new Set([
      'QqBot:Account:MessagePush:Create',
      'QqBot:Account:MessagePush:Delete',
      'QqBot:Account:MessagePush:List',
      'QqBot:Account:MessagePush:Toggle',
      'QqBot:Account:MessagePush:Update',
    ]);
    mocks.registeredTableOptions = undefined;
    mocks.renderedPage = undefined;
    mocks.tableOptions = undefined;
    mocks.api.getBindings.mockResolvedValue([createBinding()]);
    mocks.api.getSubscriptions.mockResolvedValue({
      items: [createSubscription()],
      total: 1,
    });
    mocks.api.getTemplates.mockResolvedValue({
      items: [createTemplate()],
      total: 1,
    });
    mocks.api.getTargets.mockResolvedValue({
      available: true,
      options: [
        {
          label: '测试群',
          targetId: '40000000000000001',
          targetType: 'group',
        },
      ],
      reasonCode: null,
    });
    mocks.api.toggleBinding.mockResolvedValue(createBinding());
    mocks.api.deleteBinding.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers one native table and performs one full authorized load', async () => {
    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.findAll('.qqbot-account-message-push-panel')).toHaveLength(
      1,
    );
    expect(wrapper.findAll('[data-testid="message-push-table"]')).toHaveLength(
      1,
    );
    expect(wrapper.find('[data-testid="account-title"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="account-tabs"]').exists()).toBe(true);
    expect(mocks.registerTable).toHaveBeenCalledOnce();
    expect(mocks.tableOptions).toMatchObject({
      immediate: false,
      rowKey: 'id',
      showPagination: false,
      showTableSetting: false,
    });
    expect(mocks.api.getBindings).toHaveBeenCalledOnce();
    expect(mocks.api.getBindings).toHaveBeenCalledWith('10000000000000001');
    expect(mocks.api.getSubscriptions).toHaveBeenCalledWith({
      pageNo: 1,
      pageSize: 100,
    });
    expect(mocks.api.getTemplates).toHaveBeenCalledWith({
      pageNo: 1,
      pageSize: 100,
    });
    expect(mocks.api.getTargets).toHaveBeenCalledWith('10000000000000001');
    expect(mocks.renderedPage).toEqual({
      items: [createBinding()],
      total: 1,
    });
  });

  it('hard-gates registration and every request when List is missing', async () => {
    mocks.accessCodes = new Set([
      'QqBot:Account:MessagePush:Create',
      'QqBot:Account:MessagePush:Update',
    ]);
    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.find('[data-testid="message-push-table"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="modal-saved"]').exists()).toBe(false);
    expect(mocks.registerTable).not.toHaveBeenCalled();
    expect(mocks.tableApi.reload).not.toHaveBeenCalled();
    expect(mocks.api.getBindings).not.toHaveBeenCalled();
    expect(mocks.api.getSubscriptions).not.toHaveBeenCalled();
    expect(mocks.api.getTemplates).not.toHaveBeenCalled();
    expect(mocks.api.getTargets).not.toHaveBeenCalled();
  });

  it('lets List-only users load metadata without target discovery', async () => {
    mocks.accessCodes = new Set(['QqBot:Account:MessagePush:List']);
    mountPanel();
    await flushPromises();

    expect(mocks.api.getBindings).toHaveBeenCalledOnce();
    expect(mocks.api.getSubscriptions).toHaveBeenCalledOnce();
    expect(mocks.api.getTemplates).toHaveBeenCalledOnce();
    expect(mocks.api.getTargets).not.toHaveBeenCalled();
  });

  it('loads all global metadata pages up to the server total', async () => {
    mocks.api.getSubscriptions
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, index) =>
          createSubscription(`2${String(index).padStart(16, '0')}`),
        ),
        total: 101,
      })
      .mockResolvedValueOnce({
        items: [createSubscription('29999999999999999')],
        total: 101,
      });
    mocks.api.getTemplates
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, index) =>
          createTemplate(`5${String(index).padStart(16, '0')}`),
        ),
        total: 101,
      })
      .mockResolvedValueOnce({
        items: [createTemplate('59999999999999999')],
        total: 101,
      });
    const wrapper = mountPanel();
    await flushPromises();

    expect(mocks.api.getSubscriptions).toHaveBeenNthCalledWith(2, {
      pageNo: 2,
      pageSize: 100,
    });
    expect(mocks.api.getTemplates).toHaveBeenNthCalledWith(2, {
      pageNo: 2,
      pageSize: 100,
    });
    const modal = wrapper.getComponent({ name: 'MockAccountMessagePushModal' });
    expect(modal.props('subscriptions')).toHaveLength(101);
    expect(modal.props('templates')).toHaveLength(101);
  });

  it('stops after a short page even when the reported total is stale and high', async () => {
    mocks.api.getSubscriptions.mockResolvedValue({
      items: [createSubscription()],
      total: 100_000,
    });
    const wrapper = mountPanel();
    await flushPromises();

    expect(mocks.api.getSubscriptions).toHaveBeenCalledOnce();
    expect(
      wrapper
        .getComponent({ name: 'MockAccountMessagePushModal' })
        .props('subscriptions'),
    ).toHaveLength(1);
  });

  it('stops safely when a metadata page is empty', async () => {
    mocks.api.getSubscriptions.mockResolvedValue({
      items: [],
      total: 100_000,
    });
    const wrapper = mountPanel();
    await flushPromises();

    expect(mocks.api.getSubscriptions).toHaveBeenCalledOnce();
    expect(
      wrapper
        .getComponent({ name: 'MockAccountMessagePushModal' })
        .props('subscriptions'),
    ).toEqual([]);
  });

  it.each([
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative', -1],
  ])('stops safely for an invalid %s total', async (_label, total) => {
    const items = Array.from({ length: 100 }, (_, index) =>
      createSubscription(`2${String(index).padStart(16, '0')}`),
    );
    mocks.api.getSubscriptions.mockResolvedValue({ items, total });
    const wrapper = mountPanel();
    await flushPromises();

    expect(mocks.api.getSubscriptions).toHaveBeenCalledOnce();
    expect(
      wrapper
        .getComponent({ name: 'MockAccountMessagePushModal' })
        .props('subscriptions'),
    ).toHaveLength(100);
  });

  it('uses a revision guard for real selfId changes and ignores stale rows', async () => {
    const wrapper = mountPanel('10001');
    await flushPromises();
    vi.clearAllMocks();
    const oldRequest =
      deferred<QqbotMessagePushApi.QqbotMessagePublishBindingView[]>();
    mocks.api.getBindings
      .mockImplementationOnce(() => oldRequest.promise)
      .mockResolvedValueOnce([
        createBinding({ id: '90000000000000003', subscriptionName: 'new' }),
      ]);

    await wrapper.setProps({ selfId: '10002' });
    await wrapper.setProps({ selfId: '10003' });
    await flushPromises();
    oldRequest.resolve([
      createBinding({ id: '90000000000000002', subscriptionName: 'old' }),
    ]);
    await flushPromises();

    expect(mocks.api.getBindings).toHaveBeenNthCalledWith(1, '10002');
    expect(mocks.api.getBindings).toHaveBeenNthCalledWith(2, '10003');
    expect(mocks.renderedPage).toEqual({
      items: [
        createBinding({
          id: '90000000000000003',
          subscriptionName: 'new',
        }),
      ],
      total: 1,
    });

    const callsBeforeIdentical = mocks.api.getBindings.mock.calls.length;
    await wrapper.setProps({ selfId: '10003' });
    await flushPromises();
    expect(mocks.api.getBindings).toHaveBeenCalledTimes(callsBeforeIdentical);
  });

  it('pins columns, exact permissions, and account-scoped actions', () => {
    mountPanel();

    expect(mocks.tableOptions.columns.map((column: any) => column.key)).toEqual(
      [
        'subscription',
        'source',
        'template',
        'targets',
        'enabled',
        'updateTime',
      ],
    );
    expect(
      Object.fromEntries(
        mocks.tableOptions.buttons.map((button: any) => [
          button.key,
          button.permissionCodes,
        ]),
      ),
    ).toEqual({
      create: ['QqBot:Account:MessagePush:Create'],
      refresh: ['QqBot:Account:MessagePush:List'],
    });
    expect(
      Object.fromEntries(
        mocks.tableOptions.rowActions.map((action: any) => [
          action.key,
          action.permissionCodes,
        ]),
      ),
    ).toEqual({
      delete: ['QqBot:Account:MessagePush:Delete'],
      edit: ['QqBot:Account:MessagePush:Update'],
      toggle: ['QqBot:Account:MessagePush:Toggle'],
    });
    expect(
      mocks.tableOptions.rowActions.find(
        (action: any) => action.key === 'delete',
      ).confirm,
    ).toBeTypeOf('function');
  });

  it('opens create/edit and reloads bindings once after modal saved', async () => {
    const wrapper = mountPanel();
    await flushPromises();
    mocks.tableApi.reload.mockClear();
    mocks.api.getBindings.mockClear();
    const row = createBinding();

    await mocks.tableOptions.buttons
      .find((button: any) => button.key === 'create')
      .onClick({});
    await mocks.tableOptions.rowActions
      .find((action: any) => action.key === 'edit')
      .onClick(row, {});
    await wrapper.get('[data-testid="modal-saved"]').trigger('click');
    await flushPromises();

    expect(mocks.modalOpenCreate).toHaveBeenCalledOnce();
    expect(mocks.modalOpenEdit).toHaveBeenCalledWith(row);
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.api.getBindings).toHaveBeenCalledOnce();
  });

  it('reloads once after successful toggle/delete and never after rejection', async () => {
    mountPanel();
    await flushPromises();
    const row = createBinding();
    const context = { reload: vi.fn(async () => {}) };
    const toggle = mocks.tableOptions.rowActions.find(
      (action: any) => action.key === 'toggle',
    );
    const remove = mocks.tableOptions.rowActions.find(
      (action: any) => action.key === 'delete',
    );

    await toggle.onClick(row, context);
    await remove.onClick(row, context);
    expect(mocks.api.toggleBinding).toHaveBeenCalledWith(
      '10000000000000001',
      '10000000000000001',
      false,
    );
    expect(mocks.api.deleteBinding).toHaveBeenCalledWith(
      '10000000000000001',
      '10000000000000001',
    );
    expect(context.reload).toHaveBeenCalledTimes(2);

    context.reload.mockClear();
    mocks.api.toggleBinding.mockRejectedValueOnce(new Error('toggle failed'));
    mocks.api.deleteBinding.mockRejectedValueOnce(new Error('delete failed'));
    await expect(toggle.onClick(row, context)).rejects.toThrow('toggle failed');
    await expect(remove.onClick(row, context)).rejects.toThrow('delete failed');
    expect(context.reload).not.toHaveBeenCalled();
  });

  it('explicit refresh reloads only bindings and idle time adds no work', async () => {
    mountPanel();
    await flushPromises();
    mocks.tableApi.reload.mockClear();
    mocks.api.getBindings.mockClear();
    const subscriptionCalls = mocks.api.getSubscriptions.mock.calls.length;
    const templateCalls = mocks.api.getTemplates.mock.calls.length;
    const targetCalls = mocks.api.getTargets.mock.calls.length;

    const refresh = mocks.tableOptions.buttons.find(
      (button: any) => button.key === 'refresh',
    );
    expect(refresh.operation).toBe('reload');
    await mocks.tableApi.reload();
    await flushPromises();

    expect(mocks.api.getBindings).toHaveBeenCalledOnce();
    expect(mocks.api.getSubscriptions).toHaveBeenCalledTimes(subscriptionCalls);
    expect(mocks.api.getTemplates).toHaveBeenCalledTimes(templateCalls);
    expect(mocks.api.getTargets).toHaveBeenCalledTimes(targetCalls);

    vi.advanceTimersByTime(60_000);
    await flushPromises();
    expect(mocks.api.getBindings).toHaveBeenCalledOnce();
    expect(mocks.api.getSubscriptions).toHaveBeenCalledTimes(subscriptionCalls);
    expect(mocks.api.getTemplates).toHaveBeenCalledTimes(templateCalls);
    expect(mocks.api.getTargets).toHaveBeenCalledTimes(targetCalls);
    expect(vi.getTimerCount()).toBe(0);
  });
});
