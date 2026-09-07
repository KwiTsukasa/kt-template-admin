/* @vitest-environment happy-dom */
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PermissionList from '#/views/bot/permission/list';
import { buildPermissionTree } from '#/views/bot/permission/permissionTree';
import { usePermissionOptions } from '#/views/bot/permission/usePermissionOptions';

const mocks = vi.hoisted(() => {
  const values: Record<string, any> = {};
  const formApi = {
    getValues: vi.fn(async () => ({ ...values })),
    resetForm: vi.fn(async () => {
      for (const key of Object.keys(values)) delete values[key];
    }),
    resetValidate: vi.fn(),
    updateSchema: vi.fn(),
    setValues: vi.fn(async (next) => {
      Object.assign(values, next);
    }),
    setFieldValue: vi.fn(async (key, value) => {
      values[key] = value;
    }),
    validate: vi.fn(async () => ({ valid: true })),
  };
  const modalApi = {
    data: {} as any,
    close: vi.fn(),
    getData: () => modalApi.data,
    lock: vi.fn(),
    unlock: vi.fn(),
    open: vi.fn(),
    setData: (data: any) => {
      modalApi.data = data;
      return modalApi;
    },
  };
  return {
    values,
    formApi,
    modalApi,
    form: undefined as any,
    modal: undefined as any,
    table: undefined as any,
    options: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    reload: vi.fn(),
    reset: vi.fn(),
  };
});
vi.mock('#/api/bot', () => ({
  getBotPermissionOptions: mocks.options,
  createBotPermission: mocks.create,
  updateBotPermission: mocks.update,
  getBotPermissionList: mocks.list,
  deleteBotPermission: vi.fn(),
}));
vi.mock('#/adapter/form', () => ({
  useVbenForm: (options: any) => {
    mocks.form = options;
    return [defineComponent({ render: () => h('form') }), mocks.formApi];
  },
}));
vi.mock('@vben/icons', () => ({
  Plus: defineComponent({ render: () => h('i') }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('main', slots.default?.()),
  }),
  useVbenModal: (options: any) => {
    mocks.modal = options;
    return [
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('section', slots.default?.()),
      }),
      mocks.modalApi,
    ];
  },
}));
vi.mock('antdv-next', () => ({
  message: { success: vi.fn(), warning: vi.fn() },
  Tag: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
  Tabs: defineComponent({
    props: ['items', 'activeKey'],
    emits: ['update:activeKey'],
    setup:
      (props, { emit }) =>
      () =>
        h(
          'nav',
          props.items.map((item: any) =>
            h(
              'button',
              { onClick: () => emit('update:activeKey', item.key) },
              item.label,
            ),
          ),
        ),
  }),
}));
vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    props: ['columns'],
    setup:
      (props, { slots }) =>
      () =>
        h('div', [
          slots.headerControls?.(),
          h(
            'header',
            props.columns.map((column: any) =>
              h('span', { 'data-column': column.key }, column.title),
            ),
          ),
        ]),
  }),
  useKtTable: (options: any) => {
    mocks.table = options;
    return [
      vi.fn(),
      { reload: mocks.reload, reset: mocks.reset, formApi: mocks.formApi },
    ];
  },
}));

const options = () => ({
  accounts: [
    {
      label: 'Bot A (bot-a)',
      value: 'bot-a',
      connectionMode: 'reverse-ws',
      enabled: true,
    },
  ],
  targets: [
    { label: '群 A', value: 'group-a' },
    { label: '群 B', value: 'group-b' },
  ],
  users: [
    { label: '甲', value: 'user-a' },
    { label: '乙', value: 'user-b' },
  ],
  source: 'live' as const,
  notice: '',
});
const row = (id: string, selfId: string, targetId = 'group-a') => ({
  id,
  selfId,
  targetId,
  targetType: 'group' as const,
  preciseUser: true,
  userIds: ['user-a', 'user-b'],
  enabled: true,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.options.mockReset().mockImplementation(async () => options());
  mocks.list.mockResolvedValue({
    list: [row('1', 'bot-a'), row('2', '', 'group-b')],
    total: 2,
  });
});

describe('permission account and group state', () => {
  it('keeps one child per permission with its member array and puts unspecified accounts in 全局', () => {
    const rows = [
      row('1', 'bot-a'),
      row('2', '', 'group-b'),
      row('3', 'missing'),
    ];
    const tree = buildPermissionTree(rows, options().accounts);
    expect(tree.map((group) => group.groupLabel)).toEqual([
      '全局',
      'Bot A (bot-a)',
      'missing',
    ]);
    expect(tree[1]?.children).toEqual([rows[0]]);
    expect(tree[1]?.children?.[0]?.userIds).toEqual(['user-a', 'user-b']);
    expect(rows).toHaveLength(3);
  });

  it('discards stale group responses and responses arriving after the form closes', async () => {
    let first: (value: any) => void = () => {};
    let second: (value: any) => void = () => {};
    mocks.options
      .mockReset()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            first = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            second = resolve;
          }),
      );
    const state = usePermissionOptions();
    const a = state.load({ selfId: 'bot-a', targetId: 'group-a' });
    const b = state.load({ selfId: 'bot-a', targetId: 'group-b' });
    second({ ...options(), users: [{ value: 'group-b-user', label: 'B' }] });
    await b;
    first(options());
    await a;
    expect(state.data.value.users.map((item) => item.value)).toEqual([
      'group-b-user',
    ]);
    mocks.options.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve;
        }),
    );
    const closed = state.load({ selfId: 'bot-a', targetId: 'group-a' });
    state.clear();
    first(options());
    await closed;
    expect(state.data.value.users).toEqual([]);
    expect(state.loading.value).toBe(false);
  });

  it('keeps saved members available for editing when absent from current candidates', async () => {
    const state = usePermissionOptions();
    await state.load(
      { selfId: 'bot-a', targetId: 'former-group' },
      { targetId: 'former-group', userIds: ['former-a', 'former-b'] },
    );
    expect(state.data.value.targets.map((item) => item.value)).toContain(
      'former-group',
    );
    expect(state.data.value.users.map((item) => item.value)).toEqual([
      'user-a',
      'user-b',
      'former-a',
      'former-b',
    ]);
    mocks.options.mockRejectedValueOnce(new Error('offline'));
    await state.load({ selfId: 'bot-b' });
    expect(state.data.value.users).toEqual([]);
    expect(state.data.value.notice).toContain('失败');
  });

  it('hides group fields in QQ tab, uses account Select and group multi-select, and submits one array payload', async () => {
    const wrapper = mount(PermissionList);
    await flushPromises();
    expect(wrapper.find('[data-column="preciseUser"]').exists()).toBe(false);
    expect(wrapper.find('[data-column="userId"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('过滤模式');
    expect(
      mocks.table.formOptions.schema
        .find((field: any) => field.fieldName === 'userId')
        .dependencies.if(),
    ).toBe(false);
    const groupTab = wrapper
      .findAll('button')
      .find((button) => button.text() === '群聊')!;
    await groupTab.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-column="userId"]').exists()).toBe(true);
    expect(
      mocks.table.formOptions.schema
        .find((field: any) => field.fieldName === 'userId')
        .dependencies.if(),
    ).toBe(true);
    expect(
      mocks.form.schema.find((field: any) => field.fieldName === 'selfId')
        .component,
    ).toBe('Select');
    expect(
      mocks.form.schema
        .find((field: any) => field.fieldName === 'userIds')
        .componentProps().mode,
    ).toBe('multiple');
    mocks.table.rowActions[0].onClick(row('1', 'bot-a'));
    mocks.modal.onOpenChange(true);
    await flushPromises();
    await mocks.form.handleValuesChange(
      { ...mocks.values, targetId: 'group-b' },
      ['targetId'],
    );
    expect(mocks.values.userIds).toEqual([]);
    expect(mocks.options).toHaveBeenLastCalledWith({
      selfId: 'bot-a',
      targetType: 'group',
      targetId: 'group-b',
    });
    await mocks.form.handleValuesChange({ ...mocks.values, selfId: 'bot-b' }, [
      'selfId',
    ]);
    expect(mocks.values.targetId).toBe('');
    expect(mocks.options).toHaveBeenLastCalledWith({
      selfId: 'bot-b',
      targetType: 'group',
      targetId: '',
    });
    mocks.table.buttons[0].onClick();
    mocks.modal.onOpenChange(true);
    await flushPromises();
    Object.assign(mocks.values, {
      selfId: 'bot-a',
      targetId: 'group-a',
      targetType: 'group',
      preciseUser: true,
      userIds: ['user-a', 'user-b'],
    });
    await mocks.modal.onConfirm();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(
      'allowlist',
      expect.objectContaining({
        targetId: 'group-a',
        userId: '',
        userIds: ['user-a', 'user-b'],
      }),
    );
    const tree = await mocks.table.api.list({ pageNo: 1 });
    expect(tree.list[0].groupLabel).toBe('全局');
    expect(mocks.table.rowActions[0].rowVisible(tree.list[0])).toBe(false);
    expect(mocks.table.rowActions[0].rowVisible(tree.list[1].children[0])).toBe(
      true,
    );
    expect(mocks.table.showPagination).toBe(false);
    wrapper.unmount();
  });

  it('restores all selected members and updates the same group id in the blacklist', async () => {
    const wrapper = mount(PermissionList);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '黑名单')!
      .trigger('click');
    mocks.table.rowActions[0].onClick(row('kept-id', 'bot-a'));
    mocks.modal.onOpenChange(true);
    await flushPromises();
    expect(mocks.values.userIds).toEqual(['user-a', 'user-b']);
    await mocks.form.handleValuesChange({ ...mocks.values }, [
      'selfId',
      'targetId',
      'preciseUser',
      'userIds',
    ]);
    expect(mocks.values.targetId).toBe('group-a');
    expect(mocks.values.userIds).toEqual(['user-a', 'user-b']);
    mocks.values.userIds = ['user-b'];
    await mocks.modal.onConfirm();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(
      'blocklist',
      expect.objectContaining({
        id: 'kept-id',
        targetId: 'group-a',
        userIds: ['user-b'],
      }),
    );
    expect(mocks.create).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
