/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { MessageManagementApi } from '#/api/message-management';
import type { QqbotMessageSubscriberApi } from '#/api/message-management/subscribers/qqbot';

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import AccountMessagePushModal from '@test-source/apps/web-antdv-next/src/views/qqbot/account/components/AccountMessagePushModal';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const formValues: Record<string, unknown> = {};
  const formApi = {
    getValues: vi.fn(async () => ({ ...formValues })),
    resetForm: vi.fn(async () => {}),
    resetValidate: vi.fn(async () => {}),
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
 * 创建支持当前表单规则方法的链式校验替身。
 *
 * @returns 可供 zod 表单声明链式调用的规则对象。
 */
function createRule(): any {
  const rule: any = {};
  for (const method of ['max', 'min', 'optional', 'regex']) {
    rule[method] = vi.fn(() => rule);
  }
  return rule;
}

vi.mock('#/adapter/form', () => ({
  useVbenForm: vi.fn((options) => {
    mocks.formOptions = options;
    const Form = defineComponent({ render: () => h('form') });
    return [Form, mocks.formApi];
  }),
  z: {
    array: vi.fn(createRule),
    enum: vi.fn(createRule),
    object: vi.fn(createRule),
    string: vi.fn(createRule),
  },
}));

vi.mock('@vben/common-ui', () => ({
  useVbenModal: vi.fn((options) => {
    mocks.modalOptions = options;
    const Modal = defineComponent({
      setup(_, { slots }) {
        return () => h('section', slots.default?.());
      },
    });
    return [Modal, mocks.modalApi];
  }),
}));

vi.mock('#/api/message-management/subscribers/qqbot', () => ({
  createQqbotMessageBinding: mocks.api.create,
  updateQqbotMessageBinding: mocks.api.update,
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/qqbot/account/components/MessagePushTargetPicker',
  () => ({
    default: defineComponent({ render: () => h('div') }),
    isValidMessagePushTargetId: (value: string) =>
      /^[1-9]\d{4,19}$/.test(value),
  }),
);

/**
 * 构造指定订阅者及两个模板的统一消息订阅。
 *
 * @param subscriberKey - 订阅唯一绑定的协议订阅者键。
 * @returns 可供 QQBot 私有配置选择的消息订阅视图。
 */
function createSubscription(
  subscriberKey = 'qqbot',
): MessageManagementApi.MessageSubscriptionView {
  return {
    createTime: '2026-08-18 09:00:00',
    enabled: true,
    id: '10000000000000001',
    invalidReasonCode: null,
    name: '网络状态通知',
    remark: null,
    sourceConfig: {},
    sourceKey: 'network.changed',
    sourceName: '网络状态变化',
    sourceSummary: '-',
    subscriberKey,
    subscriberName: subscriberKey,
    templates: [
      { id: '20000000000000001', name: '简讯', sortOrder: 0 },
      { id: '20000000000000002', name: '详情', sortOrder: 1 },
    ],
    updateTime: '2026-08-18 09:00:00',
    valid: true,
  };
}

/**
 * 构造包含一个 QQ 目标的账号私有投递配置。
 *
 * @returns 不带独立模板标识的 QQBot 配置视图。
 */
function createBinding(): QqbotMessageSubscriberApi.PublishBindingView {
  return {
    available: true,
    createTime: '2026-08-18 09:00:00',
    enabled: true,
    id: '30000000000000001',
    invalidReasonCode: null,
    sourceKey: 'network.changed',
    sourceName: '网络状态变化',
    subscriptionId: '10000000000000001',
    subscriptionName: '网络状态通知',
    targets: [
      {
        enabled: true,
        id: '40000000000000001',
        targetId: '123456789',
        targetName: '测试群',
        targetType: 'group',
      },
    ],
    templates: createSubscription().templates,
    updateTime: '2026-08-18 09:00:00',
  };
}

describe('qqbot message subscriber modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mocks.formValues)) {
      Reflect.deleteProperty(mocks.formValues, key);
    }
    mocks.modalApi.data = undefined;
    mocks.api.create.mockResolvedValue(createBinding());
    mocks.api.update.mockResolvedValue(createBinding());
  });

  it('offers only QQBot subscriptions and contains no private template field', () => {
    mount(AccountMessagePushModal, {
      props: {
        selfId: '10001',
        subscriptions: [
          createSubscription(),
          createSubscription('station-notice'),
        ],
      },
    });
    const fieldNames = mocks.formOptions.schema.map(
      (field: any) => field.fieldName,
    );
    const subscriptionField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'subscriptionId',
    );

    expect(fieldNames).toEqual(['subscriptionId', 'targets', 'enabled']);
    expect(subscriptionField.componentProps().options).toHaveLength(1);
    expect(subscriptionField.componentProps().options[0].label).toContain(
      '2 个模板',
    );
  });

  it('submits only the unified subscription and QQ delivery targets', async () => {
    const wrapper = mount(AccountMessagePushModal, {
      props: {
        selfId: '10001',
        subscriptions: [createSubscription()],
      },
    });
    (wrapper.vm as any).openCreate();
    await mocks.modalOptions.onOpenChange(true);
    Object.assign(mocks.formValues, {
      enabled: true,
      subscriptionId: '10000000000000001',
      targets: [
        {
          targetId: '123456789',
          targetName: ' 测试群 ',
          targetType: 'group',
        },
      ],
    });

    await mocks.modalOptions.onConfirm();

    expect(mocks.api.create).toHaveBeenCalledWith('10001', {
      enabled: true,
      subscriptionId: '10000000000000001',
      targets: [
        {
          targetId: '123456789',
          targetName: '测试群',
          targetType: 'group',
        },
      ],
    });
    expect(mocks.api.create.mock.calls[0]?.[1]).not.toHaveProperty(
      'templateId',
    );
  });

  it('restores an existing binding without adding a template choice', async () => {
    const wrapper = mount(AccountMessagePushModal, {
      props: {
        selfId: '10001',
        subscriptions: [createSubscription()],
      },
    });
    (wrapper.vm as any).openEdit(createBinding());
    await mocks.modalOptions.onOpenChange(true);

    expect(mocks.formApi.setValues).toHaveBeenCalledWith({
      enabled: true,
      subscriptionId: '10000000000000001',
      targets: [
        {
          targetId: '123456789',
          targetName: '测试群',
          targetType: 'group',
        },
      ],
    });
    expect(mocks.formValues).not.toHaveProperty('templateId');
  });
});
