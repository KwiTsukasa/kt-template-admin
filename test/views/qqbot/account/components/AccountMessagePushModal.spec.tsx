/* @vitest-environment happy-dom */

/* eslint-disable no-template-curly-in-string, vue/one-component-per-file, vue/require-default-prop */

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import AccountMessagePushModal from '@test-source/apps/web-antdv-next/src/views/qqbot/account/components/AccountMessagePushModal';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FormValues {
  enabled: boolean;
  subscriptionId: string;
  targets: QqbotMessagePushApi.QqbotMessagePublishTargetInput[];
  templateId: string;
}

const mocks = vi.hoisted(() => {
  const modalApi = {
    close: vi.fn(async () => {}),
    getData: vi.fn(),
    lock: vi.fn(),
    open: vi.fn(),
    setData: vi.fn(),
    unlock: vi.fn(),
  };
  const formApi = {
    getValues: vi.fn(),
    resetForm: vi.fn(async () => {}),
    resetValidate: vi.fn(async () => {}),
    setValues: vi.fn(),
    validate: vi.fn(async () => ({ valid: true })),
  };
  return {
    arrayRule: vi.fn(),
    create: vi.fn(),
    currentValues: {
      enabled: true,
      subscriptionId: '',
      targets: [],
      templateId: '',
    } as FormValues,
    formApi,
    formOptions: undefined as any,
    modalApi,
    modalOptions: undefined as any,
    stringRule: vi.fn(),
    update: vi.fn(),
  };
});

function createRule(): any {
  const rule: any = {};
  for (const method of [
    'array',
    'max',
    'min',
    'object',
    'optional',
    'or',
    'regex',
  ]) {
    rule[method] = vi.fn(() => rule);
  }
  return rule;
}

vi.mock('#/adapter/form', () => ({
  useVbenForm: vi.fn((options) => {
    mocks.formOptions = options;
    const Form = defineComponent({
      name: 'MockBindingForm',
      setup() {
        return () => {
          const targetField = mocks.formOptions.schema.find(
            (field: any) => field.fieldName === 'targets',
          );
          const TargetPicker = targetField?.component;
          return h('form', { 'data-testid': 'binding-form' }, [
            TargetPicker
              ? h(TargetPicker, {
                  ...(typeof targetField.componentProps === 'function'
                    ? targetField.componentProps()
                    : targetField.componentProps),
                  'onUpdate:value': (
                    value: QqbotMessagePushApi.QqbotMessagePublishTargetInput[],
                  ) => {
                    mocks.currentValues.targets = value;
                  },
                  value: mocks.currentValues.targets,
                })
              : null,
          ]);
        };
      },
    });
    return [Form, mocks.formApi];
  }),
  z: {
    array: mocks.arrayRule,
    enum: vi.fn(createRule),
    literal: vi.fn(createRule),
    object: vi.fn(createRule),
    string: mocks.stringRule,
  },
}));

vi.mock('@vben/common-ui', () => ({
  useVbenModal: vi.fn((options) => {
    mocks.modalOptions = options;
    const Modal = defineComponent({
      name: 'MockBindingModal',
      setup(_, { slots }) {
        return () => h('section', slots.default?.());
      },
    });
    return [Modal, mocks.modalApi];
  }),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/qqbot/account/components/MessagePushTargetPicker',
  () => ({
    default: defineComponent({
      name: 'MockMessagePushTargetPicker',
      props: {
        available: Boolean,
        disabled: Boolean,
        loading: Boolean,
        options: Array,
        reasonCode: String,
        value: Array,
      },
      emits: ['update:value'],
      setup(_, { emit }) {
        return () =>
          h(
            'button',
            {
              'data-testid': 'target-picker',
              onClick: () =>
                emit('update:value', [
                  { targetId: '12345', targetType: 'group' },
                ]),
            },
            'target-picker',
          );
      },
    }),
    isValidMessagePushTargetId: (targetId: string) =>
      /^[1-9]\d{4,19}$/.test(targetId),
  }),
);

vi.mock('#/api/qqbot/message-push', () => ({
  createAccountMessagePushBinding: mocks.create,
  updateAccountMessagePushBinding: mocks.update,
}));

function createSubscriptions(): QqbotMessagePushApi.MessageSubscriptionView[] {
  return [
    {
      createTime: '2026-07-24 10:00:00',
      enabled: true,
      id: '20000000000000001',
      invalidReasonCode: null,
      name: 'STUN A',
      remark: null,
      sourceConfig: {
        ddnsRecordId: '60000000000000001',
        portForwardId: '70000000000000001',
      },
      sourceKey: 'network.stun.mapping-port-changed',
      sourceName: 'STUN 端口变更',
      sourceSummary: 'A',
      updateTime: '2026-07-24 10:00:00',
      valid: true,
    },
    {
      createTime: '2026-07-24 10:00:00',
      enabled: true,
      id: '20000000000000002',
      invalidReasonCode: null,
      name: 'STUN B',
      remark: null,
      sourceConfig: {
        ddnsRecordId: '60000000000000002',
        portForwardId: '70000000000000002',
      },
      sourceKey: 'network.stun.mapping-port-changed',
      sourceName: 'STUN 端口变更',
      sourceSummary: 'B',
      updateTime: '2026-07-24 10:00:00',
      valid: true,
    },
    {
      createTime: '2026-07-24 10:00:00',
      enabled: true,
      id: '20000000000000003',
      invalidReasonCode: null,
      name: 'Other',
      remark: null,
      sourceConfig: {
        ddnsRecordId: '60000000000000003',
        portForwardId: '70000000000000003',
      },
      sourceKey: 'system.other',
      sourceName: 'Other',
      sourceSummary: 'Other',
      updateTime: '2026-07-24 10:00:00',
      valid: true,
    },
  ];
}

function createTemplates(): QqbotMessagePushApi.MessageTemplateView[] {
  return [
    {
      content: '${{endpoint}}',
      createTime: '2026-07-24 10:00:00',
      enabled: true,
      id: '50000000000000001',
      name: 'STUN 模板',
      referenceCount: 0,
      remark: null,
      sourceKey: 'network.stun.mapping-port-changed',
      sourceName: 'STUN 端口变更',
      updateTime: '2026-07-24 10:00:00',
    },
    {
      content: 'other',
      createTime: '2026-07-24 10:00:00',
      enabled: true,
      id: '50000000000000002',
      name: 'Other 模板',
      referenceCount: 0,
      remark: null,
      sourceKey: 'system.other',
      sourceName: 'Other',
      updateTime: '2026-07-24 10:00:00',
    },
  ];
}

function createBinding(): QqbotMessagePushApi.QqbotMessagePublishBindingView {
  return {
    available: true,
    createTime: '2026-07-24 10:00:00',
    enabled: false,
    id: '10000000000000001',
    invalidReasonCode: null,
    sourceKey: 'network.stun.mapping-port-changed',
    sourceName: 'STUN 端口变更',
    subscriptionId: '20000000000000001',
    subscriptionName: 'STUN A',
    targets: [
      {
        enabled: true,
        id: '30000000000000001',
        targetId: '40000000000000001',
        targetName: '保留群名',
        targetType: 'group',
      },
      {
        enabled: true,
        id: '30000000000000002',
        targetId: '40000000000000002',
        targetName: null,
        targetType: 'private',
      },
    ],
    templateId: '50000000000000001',
    templateName: 'STUN 模板',
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

function mountModal(selfId = '10000000000000001') {
  return mount(AccountMessagePushModal, {
    props: {
      selfId,
      subscriptions: createSubscriptions(),
      targetOptions: {
        available: false,
        options: [],
        reasonCode: 'onebot_unavailable',
      },
      targetOptionsLoading: false,
      templates: createTemplates(),
    },
  });
}

describe('account message-push modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.arrayRule.mockImplementation(createRule);
    mocks.stringRule.mockImplementation(createRule);
    mocks.currentValues = {
      enabled: true,
      subscriptionId: '20000000000000001',
      targets: [{ targetId: '40000000000000001', targetType: 'group' }],
      templateId: '50000000000000001',
    };
    mocks.formApi.getValues.mockImplementation(async () => ({
      ...mocks.currentValues,
      targets: mocks.currentValues.targets.map((target) => ({ ...target })),
    }));
    mocks.formApi.resetForm.mockImplementation(async () => {
      mocks.currentValues = {
        enabled: true,
        subscriptionId: '',
        targets: [],
        templateId: '',
      };
    });
    mocks.formApi.setValues.mockImplementation(
      async (patch: Partial<FormValues>) => {
        mocks.currentValues = { ...mocks.currentValues, ...patch };
      },
    );
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

  it('renders the exact four fields and local value-model target picker', async () => {
    const wrapper = mountModal();
    const fields = mocks.formOptions.schema.map(
      (field: any) => field.fieldName,
    );

    expect(fields).toEqual([
      'subscriptionId',
      'templateId',
      'targets',
      'enabled',
    ]);
    expect(JSON.stringify(fields)).not.toMatch(/account|selfId/i);
    const targetField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'targets',
    );
    expect(targetField.modelPropName).toBe('value');
    expect(
      wrapper
        .get('[data-testid="binding-form"]')
        .find('[data-testid="target-picker"]')
        .exists(),
    ).toBe(true);

    await wrapper.get('[data-testid="target-picker"]').trigger('click');
    expect(mocks.currentValues.targets).toEqual([
      { targetId: '12345', targetType: 'group' },
    ]);
  });

  it('为消息推送表单标签预留统一单行宽度', () => {
    mountModal();

    expect(mocks.formOptions.commonConfig.labelClass).toBe(
      'w-32 whitespace-nowrap',
    );
  });

  it('uses Chinese validation messages for subscription, template, and targets', () => {
    mountModal();
    const fieldRule = (fieldName: string) =>
      mocks.formOptions.schema.find(
        (field: any) => field.fieldName === fieldName,
      ).rules;

    expect(fieldRule('subscriptionId').regex).toHaveBeenCalledWith(
      expect.any(RegExp),
      '请选择消息订阅',
    );
    expect(fieldRule('templateId').regex).toHaveBeenCalledWith(
      expect.any(RegExp),
      '请选择消息模板',
    );
    expect(fieldRule('targets').min).toHaveBeenCalledWith(
      1,
      '请至少选择一个推送目标',
    );
    expect(fieldRule('targets').max).toHaveBeenCalledWith(
      100,
      '推送目标不能超过 100 个',
    );

    for (const result of mocks.stringRule.mock.results) {
      const rule = result.value;
      for (const method of ['max', 'regex']) {
        for (const call of rule[method].mock.calls) {
          expect(call[1]).toMatch(/[\u4E00-\u9FFF]/u);
        }
      }
    }
  });

  it('isolates edit/create sessions and preserves only editable string data', async () => {
    const wrapper = mountModal();
    (wrapper.vm as any).openEdit(createBinding());
    await flushPromises();

    expect(mocks.formApi.setValues).toHaveBeenLastCalledWith({
      enabled: false,
      subscriptionId: '20000000000000001',
      targets: [
        {
          targetId: '40000000000000001',
          targetName: '保留群名',
          targetType: 'group',
        },
        {
          targetId: '40000000000000002',
          targetType: 'private',
        },
      ],
      templateId: '50000000000000001',
    });

    (wrapper.vm as any).openCreate();
    await flushPromises();
    expect(mocks.formApi.setValues).toHaveBeenLastCalledWith({
      enabled: true,
      subscriptionId: '',
      targets: [],
      templateId: '',
    });
    expect(mocks.formApi.resetForm).toHaveBeenCalledTimes(2);
    expect(mocks.formApi.resetValidate).toHaveBeenCalledTimes(2);
  });

  it('filters templates by source and clears only an incompatible choice', async () => {
    mountModal();
    const templateField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'templateId',
    );

    await mocks.formOptions.handleValuesChange(
      {
        subscriptionId: '20000000000000001',
        templateId: '50000000000000001',
      },
      ['subscriptionId'],
    );
    expect(templateField.componentProps().options).toEqual([
      expect.objectContaining({ value: '50000000000000001' }),
    ]);
    expect(mocks.formApi.setValues).not.toHaveBeenCalledWith({
      templateId: '',
    });

    await mocks.formOptions.handleValuesChange(
      {
        subscriptionId: '20000000000000002',
        templateId: '50000000000000001',
      },
      ['subscriptionId'],
    );
    expect(mocks.formApi.setValues).not.toHaveBeenCalledWith({
      templateId: '',
    });

    await mocks.formOptions.handleValuesChange(
      {
        subscriptionId: '20000000000000003',
        templateId: '50000000000000001',
      },
      ['subscriptionId'],
    );
    expect(mocks.formApi.setValues).toHaveBeenLastCalledWith({
      templateId: '',
    });
    expect(templateField.componentProps().options).toEqual([
      expect.objectContaining({ value: '50000000000000002' }),
    ]);
  });

  it('creates and updates exact four-member bodies with selfId only as path arg', async () => {
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    mocks.currentValues = {
      enabled: true,
      subscriptionId: '20000000000000001',
      targets: [
        {
          targetId: '40000000000000001',
          targetName: '测试群',
          targetType: 'group',
        },
      ],
      templateId: '50000000000000001',
    };
    await mocks.modalOptions.onConfirm();

    const expectedBody: QqbotMessagePushApi.QqbotMessagePublishBindingInput = {
      enabled: true,
      subscriptionId: '20000000000000001',
      targets: [
        {
          targetId: '40000000000000001',
          targetName: '测试群',
          targetType: 'group',
        },
      ],
      templateId: '50000000000000001',
    };
    expect(mocks.create).toHaveBeenCalledWith(
      '10000000000000001',
      expectedBody,
    );
    expect(
      Object.keys(mocks.create.mock.calls[0]?.[1] || {}).toSorted(),
    ).toEqual(['enabled', 'subscriptionId', 'targets', 'templateId']);
    expect(JSON.stringify(mocks.create.mock.calls[0]?.[1])).not.toMatch(
      /selfId|account/i,
    );

    (wrapper.vm as any).openEdit(createBinding());
    await flushPromises();
    mocks.currentValues = expectedBody;
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith(
      '10000000000000001',
      '10000000000000001',
      expectedBody,
    );
  });

  it('refuses empty, excessive, malformed, and non-string targets before API calls', async () => {
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();

    for (const targets of [
      [],
      Array.from({ length: 101 }, () => ({
        targetId: '12345',
        targetType: 'group' as const,
      })),
      [{ targetId: '01234', targetType: 'group' as const }],
      [{ targetId: 12_345 as unknown as string, targetType: 'group' as const }],
      [{ targetId: '12345', targetType: 'channel' as 'group' }],
    ]) {
      mocks.currentValues.targets = targets;
      await mocks.modalOptions.onConfirm();
    }

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does not persist or lock when normal form validation fails', async () => {
    mocks.formApi.validate.mockResolvedValueOnce({ valid: false });
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();

    await expect(mocks.modalOptions.onConfirm()).resolves.toBeUndefined();

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.modalApi.lock).not.toHaveBeenCalled();
    expect(mocks.modalApi.unlock).not.toHaveBeenCalled();
  });

  it('closes and invalidates an open session when the implicit selfId changes', async () => {
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();

    await wrapper.setProps({ selfId: '10000000000000002' });
    await flushPromises();
    await mocks.modalOptions.onConfirm();

    expect(mocks.modalApi.close).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does not persist or close a new-account session after old validation resumes', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    mocks.currentValues = {
      enabled: true,
      subscriptionId: '20000000000000001',
      targets: [{ targetId: '12345', targetType: 'group' }],
      templateId: '50000000000000001',
    };

    const staleConfirmation = mocks.modalOptions.onConfirm();
    await flushPromises();
    await wrapper.setProps({ selfId: '10000000000000002' });
    await flushPromises();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    mocks.currentValues = {
      enabled: true,
      subscriptionId: '20000000000000001',
      targets: [{ targetId: '54321', targetType: 'private' }],
      templateId: '50000000000000001',
    };
    const closeCountBeforeResume = mocks.modalApi.close.mock.calls.length;

    validation.resolve({ valid: true });
    await staleConfirmation;
    await flushPromises();

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.modalApi.lock).not.toHaveBeenCalled();
    expect(mocks.modalApi.close).toHaveBeenCalledTimes(closeCountBeforeResume);
    expect(mocks.modalApi.setData).toHaveBeenLastCalledWith(
      expect.objectContaining({ selfId: '10000000000000002' }),
    );
    expect(wrapper.emitted('saved')).toBeUndefined();
  });

  it('does not borrow a newer same-account edit identity after validation resumes', async () => {
    const validation = deferred<{ valid: boolean }>();
    mocks.formApi.validate.mockReturnValueOnce(validation.promise);
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    mocks.currentValues = {
      enabled: true,
      subscriptionId: '20000000000000001',
      targets: [{ targetId: '12345', targetType: 'group' }],
      templateId: '50000000000000001',
    };

    const staleConfirmation = mocks.modalOptions.onConfirm();
    await flushPromises();
    (wrapper.vm as any).openEdit(createBinding());
    await flushPromises();

    validation.resolve({ valid: true });
    await staleConfirmation;
    await flushPromises();

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.modalApi.lock).not.toHaveBeenCalled();
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(wrapper.emitted('saved')).toBeUndefined();
  });

  it('contains a rejected session and closes/emits exactly once on retry success', async () => {
    mocks.create.mockRejectedValueOnce(new Error('save failed'));
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    mocks.currentValues = {
      enabled: true,
      subscriptionId: '20000000000000001',
      targets: [{ targetId: '12345', targetType: 'group' }],
      templateId: '50000000000000001',
    };
    const expectedPayload = {
      enabled: true,
      subscriptionId: '20000000000000001',
      targets: [{ targetId: '12345', targetType: 'group' as const }],
      templateId: '50000000000000001',
    };

    await expect(mocks.modalOptions.onConfirm()).resolves.toBeUndefined();
    expect(mocks.modalApi.lock).toHaveBeenCalledOnce();
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(mocks.modalApi.unlock).toHaveBeenCalledOnce();
    expect(wrapper.emitted('saved')).toBeUndefined();
    expect(mocks.create).toHaveBeenNthCalledWith(
      1,
      '10000000000000001',
      expectedPayload,
    );

    mocks.create.mockResolvedValue({});
    await mocks.modalOptions.onConfirm();
    expect(mocks.modalApi.close).toHaveBeenCalledOnce();
    expect(mocks.modalApi.unlock).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(mocks.create).toHaveBeenNthCalledWith(
      2,
      '10000000000000001',
      expectedPayload,
    );
  });

  it('contains persistence failure when the real modal owner discards the callback promise', async () => {
    mocks.create.mockRejectedValueOnce(new Error('discarded save failed'));
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    mocks.currentValues = {
      enabled: true,
      subscriptionId: '20000000000000001',
      targets: [{ targetId: '12345', targetType: 'group' }],
      templateId: '50000000000000001',
    };

    void mocks.modalOptions.onConfirm();
    await vi.waitFor(() => {
      expect(mocks.modalApi.unlock).toHaveBeenCalledOnce();
    });

    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(wrapper.emitted('saved')).toBeUndefined();
    expect(mocks.create).toHaveBeenCalledOnce();
  });
});
