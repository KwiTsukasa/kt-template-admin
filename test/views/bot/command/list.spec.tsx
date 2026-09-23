/* eslint-disable vue/multi-word-component-names, vue/one-component-per-file */
/* @vitest-environment happy-dom */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';

import CommandList from '@test-source/apps/web-antdv-next/src/views/bot/command/list';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const commandValues = { code: 'A', name: 'A' };
  const testValues = { targetType: 'private', text: '/A' };
  const commandForm = {
    getValues: vi.fn(async () => ({ ...commandValues })),
    resetForm: vi.fn(async () => undefined),
    resetValidate: vi.fn(async () => undefined),
    setFieldValue: vi.fn(async () => undefined),
    setValues: vi.fn(async (next) => Object.assign(commandValues, next)),
    validate: vi.fn(async () => ({ valid: true })),
  };
  const testForm = {
    getValues: vi.fn(async () => ({ ...testValues })),
    resetForm: vi.fn(async () => undefined),
    resetValidate: vi.fn(async () => undefined),
    setValues: vi.fn(async (next) => Object.assign(testValues, next)),
    validate: vi.fn(async () => ({ valid: true })),
  };
  const modalApis = [0, 1].map(() => ({
    close: vi.fn(async () => undefined),
    getData: vi.fn(),
    lock: vi.fn(),
    open: vi.fn(),
    setData: vi.fn(),
    unlock: vi.fn(),
  }));
  return {
    commandForm,
    commandValues,
    create: vi.fn(),
    metadata: vi.fn(),
    modalApis,
    modalOptions: [] as any[],
    operations: vi.fn(),
    reload: vi.fn(async () => undefined),
    tableOptions: undefined as any,
    test: vi.fn(),
    testForm,
    testValues,
    update: vi.fn(),
  };
});

vi.mock('#/adapter/form', () => {
  let index = 0;
  return {
    useVbenForm: () => [
      defineComponent({ setup: () => () => h('form') }),
      [mocks.commandForm, mocks.testForm][index++ % 2],
    ],
  };
});
vi.mock('#/api/bot', () => ({
  createBotCommand: mocks.create,
  deleteBotCommand: vi.fn(),
  getBotCommandList: vi.fn(async () => ({ list: [], total: 0 })),
  testBotCommand: mocks.test,
  toggleBotCommand: vi.fn(),
  updateBotCommand: mocks.update,
}));
vi.mock('#/api/plugin-platform/plugin', () => ({
  getPluginList: mocks.metadata,
  getPluginOperationList: mocks.operations,
}));
vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({ setup: () => () => h('div') }),
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
    const index = mocks.modalOptions.length;
    mocks.modalOptions.push(options);
    return [
      defineComponent({
        props: { confirmDisabled: Boolean, loading: Boolean },
        setup:
          (props, { slots }) =>
          () =>
            h(
              'section',
              {
                'data-disabled': String(props.confirmDisabled),
                'data-loading': String(props.loading),
              },
              slots.default?.(),
            ),
      }),
      mocks.modalApis[index],
    ];
  },
}));
vi.mock('@vben/icons', () => ({
  Plus: defineComponent({ render: () => h('i') }),
}));
vi.mock('antdv-next', () => ({
  Alert: defineComponent({
    props: { title: { default: '', type: String } },
    setup: (props) => () => h('div', { role: 'alert' }, props.title),
  }),
  Button: defineComponent({
    emits: ['click'],
    setup:
      (_, { emit, slots }) =>
      () =>
        h('button', { onClick: () => emit('click') }, slots.default?.()),
  }),
  message: { success: vi.fn(), warning: vi.fn() },
  Tag: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
}));

/**
 * 控制旧命令校验或元数据完成时序，验证下一轮目标不会串写。
 * @returns 可手动兑现的异步步骤。
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

/**
 * 经表格行操作打开命令编辑或测试，复用页面真实入口配置。
 * @param kind - 本轮操作的编辑或试发种类。
 * @param id - 要操作的命令 id。
 */
function openRow(kind: 'edit' | 'test', id: string) {
  const action = mocks.tableOptions.rowActions.find(
    (item: { key: string }) => item.key === kind,
  );
  action.onClick({ aliases: [id], code: id, id, name: id });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modalOptions.length = 0;
  Object.assign(mocks.testValues, { targetType: 'private', text: '/A' });
  mocks.testForm.getValues
    .mockReset()
    .mockImplementation(async () => ({ ...mocks.testValues }));
  mocks.commandForm.getValues
    .mockReset()
    .mockImplementation(async () => ({ ...mocks.commandValues }));
  for (const [index, api] of mocks.modalApis.entries()) {
    api.getData.mockImplementation(
      () => api.setData.mock.calls.at(-1)?.[0] || {},
    );
    api.setData.mockImplementation(() => api);
    api.open.mockImplementation(() => {
      void mocks.modalOptions[index].onOpenChange?.(true);
      return api;
    });
  }
  mocks.metadata.mockResolvedValue([]);
  mocks.operations.mockResolvedValue([]);
  mocks.create.mockResolvedValue({});
  mocks.update.mockResolvedValue({});
  mocks.test.mockResolvedValue({ matched: true });
});

describe('bot command modal intent', () => {
  it('does not save old A validation under B command id', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.commandForm.validate.mockReturnValueOnce(validation.promise);
    const wrapper = mount(CommandList);
    openRow('edit', 'A');
    await flushPromises();
    const old = mocks.modalOptions[0].onConfirm();
    openRow('edit', 'B');
    await flushPromises();
    validation.resolve({ valid: true });
    await old;
    expect(mocks.update).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does not retarget an old test to a newer command after values resolve', async () => {
    const values = deferred<{ targetType: string; text: string }>();
    mocks.testForm.getValues.mockReturnValueOnce(values.promise);
    const wrapper = mount(CommandList);
    openRow('test', 'A');
    await flushPromises();
    const old = mocks.modalOptions[1].onConfirm();
    await flushPromises();
    expect(mocks.testForm.getValues).toHaveBeenCalledOnce();
    openRow('test', 'B');
    await flushPromises();
    values.resolve({ targetType: 'private', text: '/A text' });
    await old;
    expect(mocks.test).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('keeps a dispatched test bound to A id and full text without showing its result in B', async () => {
    const sent = deferred<{ matched: boolean; replyText: string }>();
    mocks.test.mockReturnValueOnce(sent.promise);
    const wrapper = mount(CommandList);
    openRow('test', 'A');
    await flushPromises();
    Object.assign(mocks.testValues, {
      targetType: 'group',
      text: '/A full text',
    });
    const old = mocks.modalOptions[1].onConfirm();
    await flushPromises();
    expect(mocks.test).toHaveBeenCalledWith({
      commandId: 'A',
      targetType: 'group',
      text: '/A full text',
    });
    openRow('test', 'B');
    await flushPromises();
    sent.resolve({ matched: true, replyText: 'old A reply' });
    await old;
    expect(wrapper.text()).not.toContain('old A reply');
    wrapper.unmount();
  });

  it('keeps native modal loading during metadata wait and prepares the exact command afterward', async () => {
    const metadata = deferred<any[]>();
    mocks.metadata.mockReturnValueOnce(metadata.promise);
    const wrapper = mount(CommandList);
    openRow('edit', 'A');
    await flushPromises();
    expect(wrapper.findAll('section')[0]?.attributes('data-loading')).toBe(
      'true',
    );
    expect(wrapper.findAll('section')[0]?.attributes('data-disabled')).toBe(
      'true',
    );
    await mocks.modalOptions[0].onConfirm();
    expect(mocks.update).not.toHaveBeenCalled();
    metadata.resolve([]);
    await flushPromises();
    expect(wrapper.findAll('section')[0]?.attributes('data-loading')).toBe(
      'false',
    );
    expect(wrapper.findAll('section')[0]?.attributes('data-disabled')).toBe(
      'false',
    );
    expect(mocks.commandValues.code).toBe('A');
    wrapper.unmount();
  });

  it('offers retry after metadata failure and keeps confirmation disabled until prepared', async () => {
    const metadata = deferred<any[]>();
    mocks.metadata.mockReturnValueOnce(metadata.promise);
    const wrapper = mount(CommandList);
    mocks.tableOptions.buttons
      .find((item: { key: string }) => item.key === 'create')
      .onClick();
    metadata.reject(new Error('metadata offline'));
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toContain(
      '插件元数据读取失败',
    );
    expect(wrapper.findAll('section')[0]?.attributes('data-disabled')).toBe(
      'true',
    );
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.findAll('section')[0]?.attributes('data-disabled')).toBe(
      'false',
    );
    wrapper.unmount();
  });

  it('invalidates command confirmation during real KeepAlive deactivation', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.commandForm.validate.mockReturnValueOnce(validation.promise);
    const active = ref(true);
    const Host = defineComponent({
      setup() {
        return () =>
          h(KeepAlive, null, {
            default: () =>
              active.value ? h(CommandList) : h('div', 'other route'),
          });
      },
    });
    const host = mount(Host);
    openRow('edit', 'A');
    await flushPromises();
    const old = mocks.modalOptions[0].onConfirm();
    active.value = false;
    await nextTick();
    validation.resolve({ valid: true });
    await old;
    expect(mocks.update).not.toHaveBeenCalled();
    active.value = true;
    await nextTick();
    openRow('edit', 'B');
    await flushPromises();
    await mocks.modalOptions[0].onConfirm();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'B' }),
    );
    host.unmount();
  });

  it('claims command confirmation before validation and retries only after explicit failure', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.commandForm.validate.mockReturnValueOnce(validation.promise);
    mocks.update.mockRejectedValueOnce(new Error('save unavailable'));
    const wrapper = mount(CommandList);
    openRow('edit', 'A');
    await flushPromises();
    const first = mocks.modalOptions[0].onConfirm();
    const second = mocks.modalOptions[0].onConfirm();
    expect(mocks.commandForm.validate).toHaveBeenCalledOnce();
    validation.resolve({ valid: true });
    await Promise.all([first, second]);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.modalApis[0]?.close).not.toHaveBeenCalled();
    await mocks.modalOptions[0].onConfirm();
    expect(mocks.update).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});
