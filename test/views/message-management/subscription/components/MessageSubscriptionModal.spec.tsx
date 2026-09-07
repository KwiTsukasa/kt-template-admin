/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { MessageManagementApi } from '#/api/message-management';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MessageSubscriptionModal from '@test-source/apps/web-antdv-next/src/views/message-management/subscription/components/MessageSubscriptionModal';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => {
  const formValues: Record<string, unknown> = {};
  const formApi = {
    getValues: vi.fn(async () => ({ ...formValues })),
    resetForm: vi.fn(async () => {}),
    resetValidate: vi.fn(async () => {}),
    setState: vi.fn(),
    setFieldValue: vi.fn(async (field: string, value: unknown) => {
      formValues[field] = value;
    }),
    setValues: vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(formValues, values);
    }),
    validate: vi.fn(async () => ({ valid: true })),
  };
  const modalApi = {
    close: vi.fn(async () => {}),
    data: undefined as any,
    getData: vi.fn(() => modalApi.data),
    lock: vi.fn(),
    open: vi.fn(),
    setData: vi.fn((data: unknown) => {
      modalApi.data = data;
      return modalApi;
    }),
    unlock: vi.fn(),
  };
  return {
    api: {
      create: vi.fn(),
      getSourceOptions: vi.fn(),
      update: vi.fn(),
    },
    formApi,
    formOptions: undefined as any,
    formValues,
    modalApi,
    modalOptions: undefined as any,
  };
});

/**
 * 构造支持链路字段的网络消息源协议定义。
 *
 * @returns 含一个必填动态字段的消息源定义。
 */
function createSource(): MessageManagementApi.SystemMessageSourceDefinition {
  return {
    description: 'network source',
    displayName: '网络状态变化',
    sourceKey: 'network.changed',
    subscriptionFields: [
      {
        key: 'channelId',
        label: '链路',
        optionCollection: 'channels',
        required: true,
        type: 'select',
      },
    ],
    variables: [],
    version: 1,
  };
}

/**
 * 构造给定标识与来源的消息模板目录记录。
 *
 * @param id - 模板稳定标识。
 * @param name - 模板展示名称。
 * @param sourceKey - 模板绑定的消息源键。
 * @returns 可供多选订阅表单使用的模板视图。
 */
function createTemplate(
  id: string,
  name: string,
  sourceKey = 'network.changed',
): MessageManagementApi.MessageTemplateView {
  return {
    content: name,
    createTime: '2026-08-18 09:00:00',
    enabled: true,
    id,
    name,
    referenceCount: 0,
    remark: null,
    sourceKey,
    sourceName: sourceKey,
    updateTime: '2026-08-18 09:00:00',
  };
}

/**
 * 构造 Bot 与站内信两个协议订阅者定义。
 *
 * @returns 消息管理对外公开的订阅者目录。
 */
function createSubscribers(): MessageManagementApi.MessageSubscriberDefinition[] {
  return [
    {
      description: 'QQ delivery',
      displayName: 'Bot',
      subscriberKey: 'bot',
      version: 1,
    },
    {
      description: 'station notice delivery',
      displayName: '站内信',
      subscriberKey: 'station-notice',
      version: 1,
    },
  ];
}

vi.mock('antdv-next', () => ({
  Button: defineComponent({
    setup(_, { slots }) {
      return () => h('button', slots.default?.());
    },
  }),
}));

vi.mock('#/adapter/form', async () => {
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const requireForm = createRequire(
    resolve('packages/@core/ui-kit/form-ui/package.json'),
  );
  return {
    useVbenForm: vi.fn((options) => {
      mocks.formOptions = options;
      const Form = defineComponent({
        name: 'MockSubscriptionForm',
        render: () => h('form'),
      });
      return [Form, mocks.formApi];
    }),
    z: requireForm('zod'),
  };
});

vi.mock('@vben/common-ui', () => ({
  useVbenModal: vi.fn((options) => {
    mocks.modalOptions = options;
    const Modal = defineComponent({
      name: 'MockSubscriptionModal',
      setup(_, { slots }) {
        return () => h('section', slots.default?.());
      },
    });
    return [Modal, mocks.modalApi];
  }),
}));

vi.mock('#/api/message-management', () => ({
  createMessageSubscription: mocks.api.create,
  getMessageSourceOptions: mocks.api.getSourceOptions,
  updateMessageSubscription: mocks.api.update,
}));

describe('message management subscription modal', () => {
  const templates = [
    createTemplate('20000000000000001', '简讯'),
    createTemplate('20000000000000002', '详情'),
    createTemplate('20000000000000003', '其他来源', 'system.changed'),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mocks.formValues)) {
      Reflect.deleteProperty(mocks.formValues, key);
    }
    mocks.modalApi.data = undefined;
    mocks.api.getSourceOptions.mockResolvedValue({
      channels: [
        {
          disabled: false,
          disabledReasonCode: null,
          label: '链路 A',
          value: 'channel-a',
        },
      ],
    });
    mocks.api.create.mockResolvedValue({});
    mocks.api.update.mockResolvedValue({});
  });

  it('reports Chinese required messages for missing, cleared and empty field values', async () => {
    const wrapper = mount(MessageSubscriptionModal, {
      props: {
        sources: [createSource()],
        subscribers: createSubscribers(),
        templates,
      },
    });
    (wrapper.vm as any).openCreate();
    await mocks.modalOptions.onOpenChange(true);
    await mocks.formOptions.handleValuesChange(
      { templateIds: [templates[0]?.id] },
      ['templateIds'],
    );
    const schema = mocks.formApi.setState.mock.lastCall?.[0].schema;
    for (const [fieldName, message, empty] of [
      ['name', '请输入订阅名称', ''],
      ['subscriberKey', '请选择消息订阅者', ''],
      ['templateIds', '请至少选择一个消息模板', []],
      ['channelId', '请选择链路', ''],
    ]) {
      const rule = schema.find(
        (field: any) => field.fieldName === fieldName,
      ).rules;
      for (const value of [undefined, null, empty]) {
        const result = rule.safeParse(value);
        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toBe(message);
      }
    }
  });

  it('explains a missing upstream selection and an unconfigured DDNS binding', async () => {
    const source = createSource();
    source.subscriptionFields.push({
      dependsOn: 'channelId',
      key: 'ddnsRecordId',
      label: 'DDNS 记录',
      optionCollection: 'ddnsRecords',
      required: true,
      type: 'select',
    });
    const wrapper = mount(MessageSubscriptionModal, {
      props: { sources: [source], subscribers: createSubscribers(), templates },
    });
    (wrapper.vm as any).openCreate();
    await mocks.modalOptions.onOpenChange(true);
    await mocks.formOptions.handleValuesChange(
      { templateIds: [templates[0]?.id] },
      ['templateIds'],
    );
    const schema = mocks.formApi.setState.mock.lastCall?.[0].schema;
    const field = schema.find((item: any) => item.fieldName === 'ddnsRecordId');
    expect(field.componentProps()).toMatchObject({
      placeholder: '请选择DDNS 记录',
      notFoundContent: '请先选择上级来源',
    });
    await mocks.formOptions.handleValuesChange({ channelId: 'channel-a' }, [
      'channelId',
    ]);
    expect(field.componentProps()).toMatchObject({
      options: [],
      notFoundContent: '暂无关联 DDNS，请先配置自动 DDNS',
    });
    expect(field.rules.safeParse(undefined).error.issues[0].message).toBe(
      '请选择DDNS 记录',
    );
  });

  it('submits every selected template in order to one subscriber', async () => {
    const wrapper = mount(MessageSubscriptionModal, {
      props: {
        sources: [createSource()],
        subscribers: createSubscribers(),
        templates,
      },
    });
    (wrapper.vm as any).openCreate();
    await mocks.modalOptions.onOpenChange(true);
    await mocks.formOptions.handleValuesChange(
      { templateIds: [templates[0]?.id, templates[1]?.id] },
      ['templateIds'],
    );
    Object.assign(mocks.formValues, {
      channelId: 'channel-a',
      enabled: true,
      name: '网络状态通知',
      remark: ' all templates ',
      subscriberKey: 'bot',
      templateIds: [templates[0]?.id, templates[1]?.id],
    });

    await mocks.modalOptions.onConfirm();
    await flushPromises();

    expect(mocks.api.getSourceOptions).toHaveBeenCalledWith('network.changed');
    expect(mocks.api.create).toHaveBeenCalledWith({
      enabled: true,
      name: '网络状态通知',
      remark: 'all templates',
      sourceConfig: { channelId: 'channel-a' },
      subscriberKey: 'bot',
      templateIds: ['20000000000000001', '20000000000000002'],
    });
    expect(mocks.modalApi.lock).toHaveBeenCalledOnce();
    expect(mocks.modalApi.unlock).toHaveBeenCalledOnce();
  });

  it('refreshes source resources while open and discards late responses after closing', async () => {
    vi.useFakeTimers();
    const wrapper = mount(MessageSubscriptionModal, {
      props: {
        sources: [createSource()],
        subscribers: createSubscribers(),
        templates,
      },
    });
    try {
      (wrapper.vm as any).openCreate();
      await mocks.modalOptions.onOpenChange(true);
      await mocks.formOptions.handleValuesChange(
        { templateIds: [templates[0]?.id] },
        ['templateIds'],
      );
      mocks.api.getSourceOptions.mockResolvedValue({
        channels: [
          {
            disabled: false,
            disabledReasonCode: null,
            label: '新链路',
            value: 'new-channel',
          },
        ],
      });
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mocks.api.getSourceOptions).toHaveBeenCalledTimes(2);
      let schema = mocks.formApi.setState.mock.lastCall?.[0].schema;
      expect(
        schema
          .find((field: any) => field.fieldName === 'channelId')
          .componentProps().options[0].value,
      ).toBe('new-channel');
      let finish: any;
      mocks.api.getSourceOptions.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      await wrapper.find('button').trigger('click');
      await mocks.modalOptions.onOpenChange(false);
      finish({ channels: [{ value: 'stale-channel' }] });
      await flushPromises();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mocks.api.getSourceOptions).toHaveBeenCalledTimes(3);
      schema = mocks.formApi.setState.mock.lastCall?.[0].schema;
      expect(
        schema
          .find((field: any) => field.fieldName === 'channelId')
          .componentProps().options,
      ).toEqual([]);
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
    }
  });

  it('rejects a mixed-source selection and preserves the previous template set', async () => {
    const wrapper = mount(MessageSubscriptionModal, {
      props: {
        sources: [createSource()],
        subscribers: createSubscribers(),
        templates,
      },
    });
    (wrapper.vm as any).openCreate();
    await mocks.modalOptions.onOpenChange(true);
    await mocks.formOptions.handleValuesChange(
      { templateIds: ['20000000000000001', '20000000000000002'] },
      ['templateIds'],
    );
    mocks.formApi.setValues.mockClear();

    await mocks.formOptions.handleValuesChange(
      { templateIds: ['20000000000000001', '20000000000000003'] },
      ['templateIds'],
    );

    expect(mocks.formApi.setValues).toHaveBeenCalledWith({
      templateIds: ['20000000000000001', '20000000000000002'],
    });
    expect(mocks.api.getSourceOptions).toHaveBeenCalledTimes(1);
  });

  it('restores all template bindings and the unique subscriber when editing', async () => {
    const source = createSource();
    source.subscriptionFields.push({
      dependsOn: 'channelId',
      key: 'ddnsRecordId',
      label: 'DDNS 记录',
      optionCollection: 'ddnsRecords',
      required: true,
      type: 'select',
    });
    const wrapper = mount(MessageSubscriptionModal, {
      props: {
        sources: [source],
        subscribers: createSubscribers(),
        templates,
      },
    });
    const row: MessageManagementApi.MessageSubscriptionView = {
      createTime: '2026-08-18 09:00:00',
      enabled: true,
      id: '10000000000000001',
      invalidReasonCode: null,
      name: '网络状态通知',
      remark: null,
      sourceConfig: { channelId: 'channel-a', ddnsRecordId: 'ddns-a' },
      sourceKey: 'network.changed',
      sourceName: '网络状态变化',
      sourceSummary: 'channel-a',
      subscriberKey: 'station-notice',
      subscriberName: '站内信',
      templates: [
        { id: templates[0]?.id || '', name: '简讯', sortOrder: 0 },
        { id: templates[1]?.id || '', name: '详情', sortOrder: 1 },
      ],
      updateTime: '2026-08-18 09:00:00',
      valid: true,
    };

    mocks.formApi.resetForm.mockImplementationOnce(async () => {
      await mocks.formOptions.handleValuesChange(
        { templateIds: [], channelId: undefined, ddnsRecordId: undefined },
        ['templateIds', 'channelId', 'ddnsRecordId'],
      );
    });
    (wrapper.vm as any).openEdit(row);
    await mocks.modalOptions.onOpenChange(true);

    expect(mocks.modalApi.data.values).toMatchObject({
      subscriberKey: 'station-notice',
      templateIds: ['20000000000000001', '20000000000000002'],
    });
    expect(mocks.formApi.setValues).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'channel-a',
        ddnsRecordId: 'ddns-a',
        subscriberKey: 'station-notice',
        templateIds: ['20000000000000001', '20000000000000002'],
      }),
      false,
    );
    await mocks.formOptions.handleValuesChange({ ...mocks.formValues }, [
      'channelId',
      'ddnsRecordId',
    ]);
    expect(mocks.formValues.ddnsRecordId).toBe('ddns-a');
    expect(mocks.api.getSourceOptions).toHaveBeenCalledWith('network.changed');

    await mocks.formOptions.handleValuesChange(
      { ...mocks.formValues, channelId: 'channel-b' },
      ['channelId'],
    );
    expect(mocks.formApi.setFieldValue).toHaveBeenLastCalledWith(
      'ddnsRecordId',
      undefined,
    );
    expect(mocks.formValues.ddnsRecordId).toBeUndefined();

    await mocks.formOptions.handleValuesChange(
      { ...mocks.formValues, channelId: 'channel-b', ddnsRecordId: 'ddns-b' },
      ['ddnsRecordId'],
    );
    mocks.formApi.setFieldValue.mockClear();
    await mocks.formOptions.handleValuesChange(
      { ...mocks.formValues, channelId: undefined, ddnsRecordId: 'ddns-b' },
      ['channelId'],
    );
    expect(mocks.formApi.setFieldValue).toHaveBeenCalledOnce();
    expect(mocks.formApi.setFieldValue).toHaveBeenCalledWith(
      'ddnsRecordId',
      undefined,
    );
    expect(mocks.formValues.ddnsRecordId).toBeUndefined();
  });
});
