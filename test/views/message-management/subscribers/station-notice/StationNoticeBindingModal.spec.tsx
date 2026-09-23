/* eslint-disable vue/one-component-per-file */
/* @vitest-environment happy-dom */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';

import StationNoticeBindingModal from '@test-source/apps/web-antdv-next/src/views/message-management/subscribers/station-notice/components/StationNoticeBindingModal';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const values = {
    enabled: true,
    notifyRoleCode: 'super',
    subscriptionId: '1',
    title: 'A title',
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
    update: vi.fn(),
    values,
  };
});

vi.mock('#/adapter/form', () => {
  const rule: Record<string, any> = {};
  for (const method of ['max', 'min', 'regex', 'trim']) {
    rule[method] = () => rule;
  }
  return {
    useVbenForm: () => [
      defineComponent({ setup: () => () => h('form') }),
      mocks.formApi,
    ],
    z: { string: () => rule },
  };
});
vi.mock('@vben/common-ui', () => ({
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
vi.mock('#/api/message-management/subscribers/station-notice', () => ({
  createStationNoticeMessageBinding: mocks.create,
  updateStationNoticeMessageBinding: mocks.update,
}));

/**
 * 控制旧会话表单校验、初始化或保存完成的先后顺序。
 * @returns 可手动兑现的异步结果。
 */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

/**
 * 用不同持久身份构造编辑会话，验证旧确认不会提交到新记录。
 * @param id - 本次编辑的站内信绑定标识。
 * @returns 包含真实订阅与角色字段的编辑记录。
 */
function row(id: string) {
  return {
    enabled: true,
    id,
    notifyRoleCode: 'super',
    subscriptionId: '1',
    title: `${id} title`,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.values, {
    enabled: true,
    notifyRoleCode: 'super',
    subscriptionId: '1',
    title: 'A title',
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

describe('station notice binding modal session', () => {
  const subscriptions = [
    {
      enabled: true,
      id: '1',
      subscriberKey: 'station-notice',
      valid: true,
    },
  ] as any;

  it('does not save A validation using B editing identity or fields', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const wrapper = mount(StationNoticeBindingModal, {
      props: { subscriptions },
    });
    (wrapper.vm as any).openEdit(row('A'));
    await flushPromises();
    const stale = mocks.modalOptions.onConfirm();
    (wrapper.vm as any).openEdit(row('B'));
    await flushPromises();
    validation.resolve({ valid: true });
    await stale;
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.values.title).toBe('B title');
    wrapper.unmount();
  });

  it('does not let an old reset overwrite the new editing session', async () => {
    const oldReset = deferred<undefined>();
    mocks.formApi.resetForm.mockImplementationOnce(() => oldReset.promise);
    const wrapper = mount(StationNoticeBindingModal, {
      props: { subscriptions },
    });
    (wrapper.vm as any).openEdit(row('A'));
    (wrapper.vm as any).openEdit(row('B'));
    await flushPromises();
    oldReset.resolve(undefined);
    await flushPromises();
    expect(mocks.values.title).toBe('B title');
    wrapper.unmount();
  });

  it('does not confirm B against A fields while B initialization waits for A reset', async () => {
    const oldReset = deferred<undefined>();
    mocks.formApi.resetForm.mockReturnValueOnce(oldReset.promise);
    const wrapper = mount(StationNoticeBindingModal, {
      props: { subscriptions },
    });
    (wrapper.vm as any).openEdit(row('A'));
    (wrapper.vm as any).openEdit(row('B'));
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
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith('B', {
      enabled: true,
      notifyRoleCode: 'super',
      subscriptionId: '1',
      title: 'B title',
    });
    wrapper.unmount();
  });

  it('initializes B when Vben open is called on an already-open modal without another open-change event', async () => {
    mocks.modalApi.open
      .mockImplementationOnce(() => {
        void mocks.modalOptions.onOpenChange?.(true);
        return mocks.modalApi;
      })
      .mockImplementation(() => mocks.modalApi);
    const wrapper = mount(StationNoticeBindingModal, {
      props: { subscriptions },
    });
    (wrapper.vm as any).openEdit(row('A'));
    await flushPromises();
    (wrapper.vm as any).openEdit(row('B'));
    await flushPromises();
    expect(mocks.values.title).toBe('B title');
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith('B', {
      enabled: true,
      notifyRoleCode: 'super',
      subscriptionId: '1',
      title: 'B title',
    });
    wrapper.unmount();
  });

  it('does not close a new B session when an already-sent A save completes', async () => {
    const save = deferred<unknown>();
    mocks.update.mockReturnValueOnce(save.promise);
    const wrapper = mount(StationNoticeBindingModal, {
      props: { subscriptions },
    });
    (wrapper.vm as any).openEdit(row('A'));
    await flushPromises();
    const stale = mocks.modalOptions.onConfirm();
    await flushPromises();
    expect(mocks.update).toHaveBeenCalledWith('A', expect.any(Object));
    (wrapper.vm as any).openEdit(row('B'));
    await flushPromises();
    save.resolve({});
    await stale;
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(wrapper.emitted('saved')).toBeUndefined();
    wrapper.unmount();
  });

  it('claims confirmation before validation and sends only one create request', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const wrapper = mount(StationNoticeBindingModal, {
      props: { subscriptions },
    });
    (wrapper.vm as any).openCreate();
    await flushPromises();
    Object.assign(mocks.values, { subscriptionId: '1', title: 'A title' });
    const first = mocks.modalOptions.onConfirm();
    const second = mocks.modalOptions.onConfirm();
    expect(mocks.formApi.validate).toHaveBeenCalledOnce();
    validation.resolve({ valid: true });
    await Promise.all([first, second]);
    expect(mocks.create).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('keeps form values and permits explicit retry after a failed save', async () => {
    mocks.update.mockRejectedValueOnce(new Error('save offline'));
    const wrapper = mount(StationNoticeBindingModal, {
      props: { subscriptions },
    });
    (wrapper.vm as any).openEdit(row('A'));
    await flushPromises();
    await expect(mocks.modalOptions.onConfirm()).resolves.toBeUndefined();
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(mocks.values.title).toBe('A title');
    expect(mocks.update).toHaveBeenCalledOnce();
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.modalApi.close).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('invalidates old validation on real KeepAlive deactivation before delayed modal close', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const active = ref(true);
    const Host = defineComponent({
      setup() {
        return () =>
          h(KeepAlive, null, {
            default: () =>
              active.value
                ? h(StationNoticeBindingModal, { subscriptions })
                : h('div', 'other tab'),
          });
      },
    });
    const host = mount(Host);
    const modal = host.getComponent(StationNoticeBindingModal);
    (modal.vm as any).$?.exposed?.openEdit(row('A'));
    await flushPromises();
    const old = mocks.modalOptions.onConfirm();
    active.value = false;
    await nextTick();
    validation.resolve({ valid: true });
    await old;
    expect(mocks.update).not.toHaveBeenCalled();
    active.value = true;
    await nextTick();
    (
      host.getComponent(StationNoticeBindingModal).vm as any
    ).$?.exposed?.openEdit(row('B'));
    await flushPromises();
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith('B', expect.any(Object));
    host.unmount();
  });
});
