/* eslint-disable vue/multi-word-component-names, vue/one-component-per-file */
/* @vitest-environment happy-dom */

import type { BotApi } from '#/api/bot';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';

import AccountList from '@test-source/apps/web-antdv-next/src/views/bot/account/list';
import { message } from 'antdv-next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const values = {
    accessToken: '',
    connectionMode: 'reverse-ws',
    enabled: true,
    loginPassword: '',
    name: '',
    remark: '',
    selfId: '',
  };
  const formApi = {
    getValues: vi.fn(async () => ({ ...values })),
    resetForm: vi.fn(async () => undefined),
    resetValidate: vi.fn(async () => undefined),
    setValues: vi.fn(async (next) => Object.assign(values, next)),
    validate: vi.fn(async () => ({ valid: true })),
  };
  const modalApi = {
    close: vi.fn(async () => undefined),
    getData: vi.fn(),
    lock: vi.fn(),
    open: vi.fn(),
    setData: vi.fn(),
    unlock: vi.fn(),
  };
  return {
    create: vi.fn(),
    formApi,
    modalApi,
    modalOptions: undefined as any,
    reload: vi.fn(async () => undefined),
    tableOptions: undefined as any,
    tableSlots: undefined as any,
    update: vi.fn(),
    values,
  };
});

vi.mock('#/adapter/form', () => ({
  useVbenForm: () => [
    defineComponent({ setup: () => () => h('form') }),
    mocks.formApi,
  ],
}));
vi.mock('#/api/bot', () => ({
  createBotAccount: mocks.create,
  deleteBotAccount: vi.fn(),
  getBotAccountList: vi.fn(async () => ({ list: [], total: 0 })),
  kickBotAccount: vi.fn(),
  updateBotAccount: mocks.update,
}));
vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    setup(_, { slots }) {
      mocks.tableSlots = slots;
      return () => h('div');
    },
  }),
  useKtTable: (options: unknown) => {
    mocks.tableOptions = options;
    return [vi.fn(), { reload: mocks.reload }];
  },
}));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('main', slots.default?.()),
  }),
  useVbenModal: (options: unknown) => {
    mocks.modalOptions = options;
    return [
      defineComponent({
        props: { confirmDisabled: Boolean },
        setup: (props) => () =>
          h('section', {
            'data-confirm-disabled': String(props.confirmDisabled),
          }),
      }),
      mocks.modalApi,
    ];
  },
}));
vi.mock('@vben/icons', () => ({
  Plus: defineComponent({ render: () => h('i') }),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('antdv-next', () => ({
  message: { success: vi.fn(), warning: vi.fn() },
  Space: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  }),
  Tag: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
  Typography: {
    Text: defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('span', slots.default?.()),
    }),
  },
}));
vi.mock(
  '@test-source/apps/web-antdv-next/src/views/bot/account/napcat/NapcatLoginModal',
  () => ({
    default: defineComponent({ setup: () => () => h('div') }),
  }),
);
vi.mock(
  '@test-source/apps/web-antdv-next/src/views/bot/account/napcat/NapcatRuntimeProfileDrawer',
  () => ({
    default: defineComponent({ setup: () => () => h('div') }),
  }),
);

/**
 * 控制旧账号校验或重置的完成顺序，检验下一次弹窗打开的归属。
 * @returns 可手动完成的异步表单步骤。
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * 构造不同持久 id 的 NapCat 账号，确保编辑提交不能借用新账号标识。
 * @param id - 列表账号 id。
 * @returns 无凭据的账号展示记录。
 */
function account(id: string): BotApi.Account {
  return {
    connectStatus: 'online',
    connectionMode: 'reverse-ws',
    enabled: true,
    id,
    name: `${id} name`,
    selfId: `${id} qq`,
  };
}

/**
 * 调用现有表格操作配置中的编辑入口，保留真实父页打开顺序。
 * @param row - 用户点击的账号记录。
 */
function openEdit(row: BotApi.Account) {
  mocks.tableOptions.rowActions
    .find((action: { key: string }) => action.key === 'edit')
    .onClick(row);
}

/**
 * 使用现有表格新建按钮开启账号表单，验证默认值和新会话身份。
 */
function openCreate() {
  mocks.tableOptions.buttons
    .find((button: { key: string }) => button.key === 'manualCreate')
    .onClick();
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.values, {
    accessToken: '',
    connectionMode: 'reverse-ws',
    enabled: true,
    loginPassword: '',
    name: '',
    remark: '',
    selfId: '',
  });
  mocks.modalApi.getData.mockImplementation(
    () => mocks.modalApi.setData.mock.calls.at(-1)?.[0] || {},
  );
  mocks.modalApi.setData.mockImplementation(() => mocks.modalApi);
  mocks.modalApi.open.mockImplementation(() => {
    void mocks.modalOptions.onOpenChange?.(true);
    return mocks.modalApi;
  });
  mocks.create.mockResolvedValue({});
  mocks.update.mockResolvedValue({});
});

describe('napcat account list', () => {
  it('does not save old A validation under new B account id', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const wrapper = mount(AccountList);
    openEdit(account('A'));
    await flushPromises();
    const stale = mocks.modalOptions.onConfirm();
    openEdit(account('B'));
    await flushPromises();
    validation.resolve({ valid: true });
    await stale;
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('keeps a retained error record separate from current connected status', async () => {
    const wrapper = mount(AccountList);
    const row = {
      ...account('A'),
      lastError: '网络连接异常!',
      napcat: {
        containerStatus: 'running',
        oneBotOnline: true,
        qqLoginStatus: 'online',
      },
    } satisfies BotApi.Account;
    const Summary = defineComponent({
      setup: () => () =>
        h(
          'div',
          mocks.tableSlots.bodyCell({
            column: { key: 'runtimeSummary' },
            record: row,
          }),
        ),
    });
    const cell = mount(Summary);
    expect(cell.text()).toContain('QQ 与 OneBot 已连接');
    expect(cell.text()).toContain('最近错误记录：网络连接异常!');
    cell.unmount();
    wrapper.unmount();
  });

  it('does not confirm B against A fields while its reset waits for A', async () => {
    const oldReset = deferred<undefined>();
    mocks.formApi.resetForm.mockReturnValueOnce(oldReset.promise);
    const wrapper = mount(AccountList);
    openEdit(account('A'));
    openEdit(account('B'));
    await flushPromises();
    expect(wrapper.get('section').attributes('data-confirm-disabled')).toBe(
      'true',
    );
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).not.toHaveBeenCalled();
    oldReset.resolve(undefined);
    await flushPromises();
    expect(wrapper.get('section').attributes('data-confirm-disabled')).toBe(
      'false',
    );
    expect(mocks.values.name).toBe('B name');
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'B',
        name: 'B name',
        selfId: 'B qq',
      }),
    );
    wrapper.unmount();
  });

  it('keeps an already-sent A write from closing or unlocking B', async () => {
    const save = deferred<unknown>();
    mocks.update.mockReturnValueOnce(save.promise);
    const wrapper = mount(AccountList);
    openEdit(account('A'));
    await flushPromises();
    const old = mocks.modalOptions.onConfirm();
    await flushPromises();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'A' }),
    );
    openEdit(account('B'));
    await flushPromises();
    save.resolve({});
    await old;
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(vi.mocked(message.success)).not.toHaveBeenCalled();
    expect(mocks.reload).not.toHaveBeenCalled();
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'B' }),
    );
    wrapper.unmount();
  });

  it('claims once before validation and permits explicit retry after failed create', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    mocks.create.mockRejectedValueOnce(new Error('save unavailable'));
    const wrapper = mount(AccountList);
    openCreate();
    await flushPromises();
    Object.assign(mocks.values, { name: 'New', selfId: '10001' });
    const first = mocks.modalOptions.onConfirm();
    const second = mocks.modalOptions.onConfirm();
    expect(mocks.formApi.validate).toHaveBeenCalledOnce();
    validation.resolve({ valid: true });
    await Promise.all([first, second]);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(vi.mocked(message.success)).not.toHaveBeenCalled();
    expect(mocks.values.selfId).toBe('10001');
    await mocks.modalOptions.onConfirm();
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.modalApi.close).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('invalidates A validation on real KeepAlive deactivation before modal close', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const active = ref(true);
    const Host = defineComponent({
      setup() {
        return () =>
          h(KeepAlive, null, {
            default: () =>
              active.value ? h(AccountList) : h('div', 'other route'),
          });
      },
    });
    const host = mount(Host);
    openEdit(account('A'));
    await flushPromises();
    const old = mocks.modalOptions.onConfirm();
    active.value = false;
    await nextTick();
    validation.resolve({ valid: true });
    await old;
    expect(mocks.update).not.toHaveBeenCalled();
    active.value = true;
    await nextTick();
    openEdit(account('B'));
    await flushPromises();
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'B' }),
    );
    host.unmount();
  });
});
