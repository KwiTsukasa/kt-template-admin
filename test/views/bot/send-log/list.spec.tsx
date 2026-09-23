/* eslint-disable vue/multi-word-component-names, vue/one-component-per-file */
/* @vitest-environment happy-dom */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';

import SendLogPage from '@test-source/apps/web-antdv-next/src/views/bot/send-log/list';
import { message } from 'antdv-next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const values = {
    message: '',
    selfId: '',
    targetId: '',
    targetType: 'private' as string,
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
    lock: vi.fn(),
    open: vi.fn(),
    unlock: vi.fn(),
  };
  return {
    formApi,
    formOptions: undefined as any,
    group: vi.fn(),
    modalApi,
    modalOptions: undefined as any,
    private: vi.fn(),
    reload: vi.fn(async () => undefined),
    tableOptions: undefined as any,
    values,
  };
});

vi.mock('#/adapter/form', () => ({
  useVbenForm: (options: unknown) => {
    mocks.formOptions = options;
    return [defineComponent({ setup: () => () => h('form') }), mocks.formApi];
  },
}));
vi.mock('#/api/bot', () => ({
  getBotSendLogList: vi.fn(async () => ({ list: [], total: 0 })),
  sendBotGroup: mocks.group,
  sendBotPrivate: mocks.private,
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
        setup:
          (props, { slots }) =>
          () =>
            h(
              'section',
              { 'data-confirm-disabled': String(props.confirmDisabled) },
              slots.default?.(),
            ),
      }),
      mocks.modalApi,
    ];
  },
}));
vi.mock('antdv-next', () => ({
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  Tag: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('span', slots.default?.()),
  }),
}));

/**
 * 控制旧发送会话校验、表单读取或请求完成的先后顺序。
 * @returns 可手动兑现的异步结果。
 */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.values, {
    message: '',
    selfId: '',
    targetId: '',
    targetType: 'private',
  });
  mocks.modalApi.open.mockImplementation(() => {
    mocks.modalOptions.onOpenChange?.(true);
  });
  mocks.private.mockResolvedValue({});
  mocks.group.mockResolvedValue({});
});

/**
 * 经页面已配置的手动发送按钮打开同一 Vben 弹窗。
 */
function openSend() {
  mocks.tableOptions.buttons
    .find((button: { key: string }) => button.key === 'send')
    .onClick();
}

describe('bot manual send modal session', () => {
  it.each(['channel', 'unexpected'])(
    'rejects unsupported %s without sending',
    async (targetType) => {
      const wrapper = mount(SendLogPage);
      openSend();
      await flushPromises();
      const sendType = mocks.formOptions.schema.find(
        (field: { fieldName: string }) => field.fieldName === 'targetType',
      );
      expect(
        sendType.componentProps.options.map(
          (item: { value: string }) => item.value,
        ),
      ).toEqual(['private', 'group']);
      const filterType = mocks.tableOptions.formOptions.schema.find(
        (field: { fieldName: string }) => field.fieldName === 'targetType',
      );
      expect(
        filterType.componentProps.options.map(
          (item: { value: string }) => item.value,
        ),
      ).toEqual(['private', 'group', 'channel']);
      Object.assign(mocks.values, {
        message: 'message',
        targetId: 'target-1',
        targetType,
      });
      await mocks.modalOptions.onConfirm();
      expect(mocks.private).not.toHaveBeenCalled();
      expect(mocks.group).not.toHaveBeenCalled();
      expect(mocks.modalApi.lock).not.toHaveBeenCalled();
      expect(vi.mocked(message.warning)).toHaveBeenCalledWith(
        '手动发送仅支持私聊或群聊',
      );
      wrapper.unmount();
    },
  );

  it('sends a supported group to the group API with the selected account', async () => {
    const wrapper = mount(SendLogPage);
    openSend();
    await flushPromises();
    Object.assign(mocks.values, {
      message: 'group message',
      selfId: 'bot-1',
      targetId: 'group-1',
      targetType: 'group',
    });
    await mocks.modalOptions.onConfirm();
    expect(mocks.group).toHaveBeenCalledOnce();
    expect(mocks.group).toHaveBeenCalledWith({
      groupId: 'group-1',
      message: 'group message',
      selfId: 'bot-1',
    });
    expect(mocks.private).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does not send B content from an old A validation after close and reopen', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const wrapper = mount(SendLogPage);
    openSend();
    await flushPromises();
    Object.assign(mocks.values, { targetId: 'A', message: 'A message' });
    const stale = mocks.modalOptions.onConfirm();
    mocks.modalOptions.onOpenChange(false);
    openSend();
    await flushPromises();
    Object.assign(mocks.values, { targetId: 'B', message: 'B message' });
    validation.resolve({ valid: true });
    await stale;
    expect(mocks.private).not.toHaveBeenCalled();
    expect(mocks.group).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does not let an old reset clear fields typed in a newer send session', async () => {
    const oldReset = deferred<undefined>();
    mocks.formApi.resetForm.mockReturnValueOnce(oldReset.promise);
    const wrapper = mount(SendLogPage);
    openSend();
    openSend();
    await flushPromises();
    oldReset.resolve(undefined);
    await flushPromises();
    expect(mocks.formApi.setValues).toHaveBeenCalledOnce();
    Object.assign(mocks.values, { targetId: 'B', message: 'B message' });
    await flushPromises();
    expect(mocks.values.targetId).toBe('B');
    expect(mocks.values.message).toBe('B message');
    wrapper.unmount();
  });

  it('does not confirm B using A fields before the new send form is ready', async () => {
    const oldReset = deferred<undefined>();
    mocks.formApi.resetForm.mockReturnValueOnce(oldReset.promise);
    const wrapper = mount(SendLogPage);
    openSend();
    openSend();
    await flushPromises();
    expect(wrapper.get('section').attributes('data-confirm-disabled')).toBe(
      'true',
    );
    Object.assign(mocks.values, { targetId: 'A', message: 'A message' });
    await mocks.modalOptions.onConfirm();
    expect(mocks.private).not.toHaveBeenCalled();
    oldReset.resolve(undefined);
    await flushPromises();
    expect(wrapper.get('section').attributes('data-confirm-disabled')).toBe(
      'false',
    );
    Object.assign(mocks.values, { targetId: 'B', message: 'B message' });
    await mocks.modalOptions.onConfirm();
    expect(mocks.private).toHaveBeenCalledWith({
      message: 'B message',
      selfId: undefined,
      userId: 'B',
    });
    wrapper.unmount();
  });

  it('does not close a new session when an A send already left the browser', async () => {
    const sent = deferred<unknown>();
    mocks.private.mockReturnValueOnce(sent.promise);
    const wrapper = mount(SendLogPage);
    openSend();
    await flushPromises();
    Object.assign(mocks.values, { targetId: 'A', message: 'A message' });
    const oldSubmit = mocks.modalOptions.onConfirm();
    await flushPromises();
    expect(mocks.private).toHaveBeenCalledWith({
      message: 'A message',
      selfId: undefined,
      userId: 'A',
    });
    mocks.modalOptions.onOpenChange(false);
    openSend();
    await flushPromises();
    Object.assign(mocks.values, { targetId: 'B', message: 'B message' });
    sent.resolve({});
    await oldSubmit;
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(mocks.values.targetId).toBe('B');
    wrapper.unmount();
  });

  it('claims a single send before validation and never auto-retries the same click', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const wrapper = mount(SendLogPage);
    openSend();
    await flushPromises();
    Object.assign(mocks.values, { targetId: 'A', message: 'A message' });
    const first = mocks.modalOptions.onConfirm();
    const second = mocks.modalOptions.onConfirm();
    expect(mocks.formApi.validate).toHaveBeenCalledOnce();
    validation.resolve({ valid: true });
    await Promise.all([first, second]);
    expect(mocks.private).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('keeps the typed payload and reports uncertain send failure without automatic retry', async () => {
    mocks.private.mockRejectedValueOnce(new Error('network unknown'));
    const wrapper = mount(SendLogPage);
    openSend();
    await flushPromises();
    Object.assign(mocks.values, { targetId: 'A', message: 'A message' });
    await expect(mocks.modalOptions.onConfirm()).resolves.toBeUndefined();
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(vi.mocked(message.success)).not.toHaveBeenCalled();
    expect(vi.mocked(message.warning)).toHaveBeenCalledWith(
      expect.stringContaining('发送结果未确认'),
    );
    expect(mocks.values.message).toBe('A message');
    expect(mocks.private).toHaveBeenCalledOnce();
    await mocks.modalOptions.onConfirm();
    expect(mocks.private).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('invalidates an old send during real KeepAlive deactivation before delayed modal close', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const active = ref(true);
    const Host = defineComponent({
      setup() {
        return () =>
          h(KeepAlive, null, {
            default: () =>
              active.value ? h(SendLogPage) : h('div', 'other tab'),
          });
      },
    });
    const host = mount(Host);
    openSend();
    await flushPromises();
    Object.assign(mocks.values, { targetId: 'A', message: 'A message' });
    const old = mocks.modalOptions.onConfirm();
    active.value = false;
    await nextTick();
    validation.resolve({ valid: true });
    await old;
    expect(mocks.private).not.toHaveBeenCalled();
    active.value = true;
    await nextTick();
    openSend();
    await flushPromises();
    Object.assign(mocks.values, { targetId: 'B', message: 'B message' });
    await mocks.modalOptions.onConfirm();
    expect(mocks.private).toHaveBeenCalledWith({
      message: 'B message',
      selfId: undefined,
      userId: 'B',
    });
    host.unmount();
  });
});
