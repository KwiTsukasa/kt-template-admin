/* eslint-disable vue/multi-word-component-names, vue/one-component-per-file */
/* @vitest-environment happy-dom */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';

import RuleList from '@test-source/apps/web-antdv-next/src/views/bot/rule/list';
import { message } from 'antdv-next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const values = { keyword: 'A keyword', replyContent: 'A reply' };
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
  createBotRule: mocks.create,
  deleteBotRule: vi.fn(),
  getBotRuleList: vi.fn(async () => ({ list: [], total: 0 })),
  toggleBotRule: vi.fn(),
  updateBotRule: mocks.update,
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
    mocks.modalOptions = options;
    return [
      defineComponent({
        props: { confirmDisabled: Boolean },
        setup: (props) => () =>
          h('section', { 'data-disabled': String(props.confirmDisabled) }),
      }),
      mocks.modalApi,
    ];
  },
}));
vi.mock('@vben/icons', () => ({
  Plus: defineComponent({ render: () => h('i') }),
}));
vi.mock('antdv-next', () => ({
  message: { success: vi.fn(), warning: vi.fn() },
  Tag: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
}));

/**
 * 控制旧规则校验或重置完成时序以检验新会话身份。
 * @returns 可手动兑现的异步表单结果。
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * 经页面已声明的行操作打开不同规则，保留真实入口顺序。
 * @param id - 要编辑的规则标识。
 */
function openEdit(id: string) {
  const action = mocks.tableOptions.rowActions.find(
    (item: { key: string }) => item.key === 'edit',
  );
  action.onClick({ id, keyword: `${id} keyword`, replyContent: `${id} reply` });
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe('bot rule modal intent', () => {
  it('does not save an old A confirmation under the B editing identity', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const wrapper = mount(RuleList);
    openEdit('A');
    await flushPromises();
    const old = mocks.modalOptions.onConfirm();
    openEdit('B');
    await flushPromises();
    validation.resolve({ valid: true });
    await old;
    expect(mocks.update).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('keeps B unready while an old A reset is pending and finally shows B fields', async () => {
    const oldReset = deferred<undefined>();
    mocks.formApi.resetForm.mockReturnValueOnce(oldReset.promise);
    const wrapper = mount(RuleList);
    openEdit('A');
    openEdit('B');
    await flushPromises();
    expect(wrapper.get('section').attributes('data-disabled')).toBe('true');
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).not.toHaveBeenCalled();
    oldReset.resolve(undefined);
    await flushPromises();
    expect(wrapper.get('section').attributes('data-disabled')).toBe('false');
    expect(mocks.values.keyword).toBe('B keyword');
    wrapper.unmount();
  });

  it('does not close B when an already-sent A save settles', async () => {
    const save = deferred<unknown>();
    mocks.update.mockReturnValueOnce(save.promise);
    const wrapper = mount(RuleList);
    openEdit('A');
    await flushPromises();
    const old = mocks.modalOptions.onConfirm();
    await flushPromises();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'A' }),
    );
    openEdit('B');
    await flushPromises();
    save.resolve({});
    await old;
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(vi.mocked(message.success)).not.toHaveBeenCalled();
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'B' }),
    );
    wrapper.unmount();
  });

  it('deduplicates confirmation and keeps the form for explicit retry after failure', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    mocks.update.mockRejectedValueOnce(new Error('save failed'));
    const wrapper = mount(RuleList);
    openEdit('A');
    await flushPromises();
    const first = mocks.modalOptions.onConfirm();
    const second = mocks.modalOptions.onConfirm();
    expect(mocks.formApi.validate).toHaveBeenCalledOnce();
    validation.resolve({ valid: true });
    await Promise.all([first, second]);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.values.keyword).toBe('A keyword');
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('invalidates pending validation on real KeepAlive deactivation and opens B afterward', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const active = ref(true);
    const Host = defineComponent({
      setup() {
        return () =>
          h(KeepAlive, null, {
            default: () =>
              active.value ? h(RuleList) : h('div', 'other route'),
          });
      },
    });
    const host = mount(Host);
    openEdit('A');
    await flushPromises();
    const old = mocks.modalOptions.onConfirm();
    active.value = false;
    await nextTick();
    validation.resolve({ valid: true });
    await old;
    expect(mocks.update).not.toHaveBeenCalled();
    active.value = true;
    await nextTick();
    openEdit('B');
    await flushPromises();
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'B' }),
    );
    host.unmount();
  });
});
