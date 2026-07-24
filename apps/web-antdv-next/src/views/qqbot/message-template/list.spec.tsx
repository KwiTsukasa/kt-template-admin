/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MessageTemplateList from './list';

const mocks = vi.hoisted(() => {
  const registerTable = vi.fn();
  const tableApi = {
    reload: vi.fn(async () => {
      if (!mocks.tableOptions) {
        throw new Error('[MockKtTable]: table is not registered yet');
      }
      return mocks.tableOptions.api.list({ pageNo: 1, pageSize: 10 });
    }),
  };
  return {
    accessCodes: new Set<string>(),
    api: {
      delete: vi.fn(),
      detail: vi.fn(),
      getList: vi.fn(),
      getSources: vi.fn(),
      preview: vi.fn(),
      toggle: vi.fn(),
    },
    modalOpenCreate: vi.fn(),
    modalOpenEdit: vi.fn(),
    registerTable,
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
    props: { autoContentHeight: Boolean },
    /** Renders one stable route root and exposes the height contract. */
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

vi.mock('@vben/icons', () => ({
  Plus: defineComponent({ render: () => h('i') }),
}));

vi.mock('antdv-next/dist/tag/index', () => ({
  default: defineComponent({
    name: 'MockTag',
    /** Renders tag children as ordinary escaped text. */
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock('#/api/qqbot/message-push', () => ({
  deleteMessageTemplate: mocks.api.delete,
  getMessagePushSourceDetail: mocks.api.detail,
  getMessagePushSources: mocks.api.getSources,
  getMessageTemplateList: mocks.api.getList,
  previewMessageTemplate: mocks.api.preview,
  setMessageTemplateEnabled: mocks.api.toggle,
}));

vi.mock('#/components/ktTable', () => ({
  KtTable: defineComponent({
    name: 'MockKtTable',
    emits: ['register'],
    /** Emits the actual registration event before exposing refresh/list rendering. */
    setup(_, { emit, slots }) {
      emit('register', { registered: true });
      return () =>
        h('section', { 'data-testid': 'template-table' }, [
          h(
            'button',
            {
              'data-testid': 'explicit-refresh',
              onClick: () => mocks.tableApi.reload(),
            },
            'refresh',
          ),
          slots.bodyCell?.({
            column: { key: 'contentSummary' },
            record: createRow({ content: '[CQ:at,qq=12345] <plain>' }),
          }),
        ]);
    },
  }),
  useKtTable: vi.fn((options) => {
    mocks.tableOptions = undefined;
    mocks.registerTable.mockImplementation(() => {
      mocks.tableOptions = options;
    });
    return [mocks.registerTable, mocks.tableApi];
  }),
}));

vi.mock('./components/MessageTemplateModal', () => ({
  default: defineComponent({
    name: 'MockMessageTemplateModal',
    props: {
      canPreview: Boolean,
      sources: {
        default: () => [],
        type: Array,
      },
    },
    emits: ['saved'],
    /** Exposes create/edit and a saved trigger through the rendered modal marker. */
    setup(props, { emit, expose }) {
      expose({
        openCreate: mocks.modalOpenCreate,
        openEdit: mocks.modalOpenEdit,
      });
      return () =>
        h(
          'button',
          {
            'data-can-preview': String(props.canPreview),
            'data-testid': 'modal-saved',
            onClick: () => emit('saved'),
          },
          'saved',
        );
    },
  }),
}));

/** Creates one template row while preserving unsafe-integer IDs as strings. */
function createRow(
  overrides: Partial<QqbotMessagePushApi.MessageTemplateView> = {},
): QqbotMessagePushApi.MessageTemplateView {
  return {
    content: 'content',
    createTime: '2026-07-24 10:00:00',
    enabled: true,
    id: '10000000000000001',
    name: 'template',
    referenceCount: 0,
    remark: null,
    sourceKey: 'network.stun.mapping-port-changed',
    sourceName: 'STUN 映射端口变更',
    updateTime: '2026-07-24 10:00:00',
    ...overrides,
  };
}

/** Creates the page-lifetime source directory fixture. */
function createSources(): QqbotMessagePushApi.SystemMessageSourceDefinition[] {
  return [
    {
      description: 'STUN mapping changed',
      displayName: 'STUN 映射端口变更',
      sourceKey: 'network.stun.mapping-port-changed',
      subscriptionFields: [],
      variables: [],
      version: 1,
    },
  ];
}

describe('message template list', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.tableOptions = undefined;
    mocks.accessCodes = new Set([
      'QqBot:MessageTemplate:Create',
      'QqBot:MessageTemplate:Delete',
      'QqBot:MessageTemplate:List',
      'QqBot:MessageTemplate:Preview',
      'QqBot:MessageTemplate:Toggle',
      'QqBot:MessageTemplate:Update',
    ]);
    mocks.api.getList.mockResolvedValue({
      items: [createRow()],
      total: 1,
    });
    mocks.api.getSources.mockResolvedValue(createSources());
    mocks.api.toggle.mockResolvedValue({});
    mocks.api.delete.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders one stable Page root and requires native KtTable registration', async () => {
    const wrapper = mount(MessageTemplateList);
    await flushPromises();

    expect(wrapper.get('[data-testid="page-root"]').attributes()).toMatchObject(
      {
        'data-auto-content-height': 'true',
      },
    );
    expect(wrapper.findAll('[data-testid="page-root"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="template-table"]').exists()).toBe(true);
    expect(mocks.tableOptions.immediate).toBe(false);
    expect(mocks.tableOptions.rowKey).toBe('id');
    expect(mocks.registerTable).toHaveBeenCalledOnce();
    expect(mocks.api.getList).toHaveBeenCalledOnce();
  });

  it('pins exact filters, columns, and the unchanged strict page result', async () => {
    mount(MessageTemplateList);
    await flushPromises();
    const result = { items: [createRow()], total: 1 };
    mocks.api.getList.mockResolvedValueOnce(result);

    await expect(
      mocks.tableOptions.api.list({
        enabled: true,
        name: 'template',
        pageNo: 1,
        pageSize: 10,
        sourceKey: 'network.stun.mapping-port-changed',
      }),
    ).resolves.toBe(result);
    expect(
      mocks.tableOptions.formOptions.schema.map(
        (field: any) => field.fieldName,
      ),
    ).toEqual(['name', 'sourceKey', 'enabled']);
    expect(mocks.tableOptions.columns.map((column: any) => column.key)).toEqual(
      [
        'name',
        'source',
        'contentSummary',
        'referenceCount',
        'enabled',
        'updateTime',
      ],
    );
  });

  it('makes zero requests and registration side paths without List permission', async () => {
    mocks.accessCodes = new Set([
      'QqBot:MessageTemplate:Create',
      'QqBot:MessageTemplate:Preview',
    ]);
    const wrapper = mount(MessageTemplateList);
    await flushPromises();

    expect(mocks.registerTable).not.toHaveBeenCalled();
    expect(mocks.tableApi.reload).not.toHaveBeenCalled();
    expect(mocks.api.getList).not.toHaveBeenCalled();
    expect(mocks.api.getSources).not.toHaveBeenCalled();
    expect(mocks.api.detail).not.toHaveBeenCalled();
    expect(mocks.api.preview).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="template-table"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="modal-saved"]').exists()).toBe(false);
  });

  it('loads list/source once and stays request/timer-free for 60 seconds', async () => {
    mount(MessageTemplateList);
    await flushPromises();

    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.api.getList).toHaveBeenCalledOnce();
    expect(mocks.api.getSources).toHaveBeenCalledOnce();
    expect(mocks.api.detail).not.toHaveBeenCalled();
    expect(mocks.api.preview).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    await flushPromises();
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.api.getList).toHaveBeenCalledOnce();
    expect(mocks.api.getSources).toHaveBeenCalledOnce();
    expect(mocks.api.detail).not.toHaveBeenCalled();
    expect(mocks.api.preview).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('assigns all exact permissions and passes Preview independently to modal', async () => {
    const wrapper = mount(MessageTemplateList);
    await flushPromises();

    expect(mocks.tableOptions.buttons[0].permissionCodes).toEqual([
      'QqBot:MessageTemplate:Create',
    ]);
    expect(
      Object.fromEntries(
        mocks.tableOptions.rowActions.map((action: any) => [
          action.key,
          action.permissionCodes,
        ]),
      ),
    ).toEqual({
      delete: ['QqBot:MessageTemplate:Delete'],
      edit: ['QqBot:MessageTemplate:Update'],
      toggle: ['QqBot:MessageTemplate:Toggle'],
    });
    expect(
      wrapper.get('[data-testid="modal-saved"]').attributes('data-can-preview'),
    ).toBe('true');
  });

  it('disables referenced delete with a count reason and keeps confirmation otherwise', () => {
    mount(MessageTemplateList);
    const remove = mocks.tableOptions.rowActions.find(
      (action: any) => action.key === 'delete',
    );
    const referenced = createRow({ referenceCount: 3 });
    const unreferenced = createRow({ referenceCount: 0 });

    expect(remove.disabled(referenced)).toBe(true);
    expect(remove.disabledReason(referenced)).toContain('3');
    expect(remove.disabled(unreferenced)).toBe(false);
    expect(remove.disabledReason(unreferenced)).toBeUndefined();
    expect(remove.confirm(unreferenced)).toContain('template');
  });

  it('reloads successful row mutations once and rejected mutations zero times', async () => {
    mount(MessageTemplateList);
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

    context.reload.mockClear();
    mocks.api.toggle.mockRejectedValueOnce(new Error('toggle failed'));
    mocks.api.delete.mockRejectedValueOnce(new Error('delete failed'));
    await expect(toggle.onClick(row, context)).rejects.toThrow('toggle failed');
    await expect(remove.onClick(row, context)).rejects.toThrow('delete failed');
    expect(context.reload).not.toHaveBeenCalled();
  });

  it('opens modal, reloads once after saved, and refreshes list metadata-free', async () => {
    const wrapper = mount(MessageTemplateList);
    await flushPromises();
    mocks.tableApi.reload.mockClear();
    mocks.api.getList.mockClear();
    const row = createRow();

    await mocks.tableOptions.buttons[0].onClick({});
    await mocks.tableOptions.rowActions
      .find((action: any) => action.key === 'edit')
      .onClick(row, { reload: vi.fn() });
    await wrapper.get('[data-testid="modal-saved"]').trigger('click');
    await flushPromises();
    expect(mocks.modalOpenCreate).toHaveBeenCalledOnce();
    expect(mocks.modalOpenEdit).toHaveBeenCalledWith(row);
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.api.getList).toHaveBeenCalledOnce();
    expect(mocks.api.getSources).toHaveBeenCalledOnce();
    expect(mocks.api.detail).not.toHaveBeenCalled();
    expect(mocks.api.preview).not.toHaveBeenCalled();

    mocks.tableApi.reload.mockClear();
    mocks.api.getList.mockClear();
    await wrapper.get('[data-testid="explicit-refresh"]').trigger('click');
    await flushPromises();
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.api.getList).toHaveBeenCalledOnce();
    expect(mocks.api.getSources).toHaveBeenCalledOnce();
  });

  it('renders CQ-looking summaries as escaped plain text', async () => {
    const wrapper = mount(MessageTemplateList);
    await flushPromises();

    expect(wrapper.text()).toContain('[CQ:at,qq=12345] <plain>');
    expect(wrapper.html()).toContain('&lt;plain&gt;');
    expect(wrapper.html()).not.toContain('innerHTML');
  });
});
