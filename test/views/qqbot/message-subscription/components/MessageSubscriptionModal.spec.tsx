/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MessageSubscriptionModal from '@test-source/apps/web-antdv-next/src/views/qqbot/message-subscription/components/MessageSubscriptionModal';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STUN_SOURCE_KEY = 'network.stun.mapping-port-changed';
const GENERIC_SOURCE_KEY = 'system.health.changed';

const mocks = vi.hoisted(() => {
  const state: any = {
    create: vi.fn(),
    formApi: {
      getValues: vi.fn(async () => state.values),
      resetForm: vi.fn(async () => {}),
      resetValidate: vi.fn(async () => {}),
      setState: vi.fn((patch) => {
        if (patch.schema) state.formOptions.schema = patch.schema;
      }),
      setValues: vi.fn(async (patch) => {
        Object.assign(state.values, patch);
      }),
      validate: vi.fn(async () => ({ valid: true })),
    },
    formOptions: undefined,
    getOptions: vi.fn(),
    modalApi: {
      close: vi.fn(async () => {}),
      getData: vi.fn(),
      lock: vi.fn(),
      open: vi.fn(),
      setData: vi.fn(),
      unlock: vi.fn(),
    },
    modalOptions: undefined,
    update: vi.fn(),
    values: {},
  };
  return state;
});

/** 创建可链式调用的表单校验规则替身。 */
function createRule(): any {
  const rule: any = {};
  for (const method of ['max', 'min', 'optional', 'or', 'trim']) {
    rule[method] = vi.fn(() => rule);
  }
  return rule;
}

vi.mock('#/adapter/form', () => ({
  useVbenForm: vi.fn((options) => {
    mocks.formOptions = options;
    const Form = defineComponent({
      name: 'MockForm',
      setup() {
        return () => h('form', { 'data-testid': 'subscription-form' });
      },
    });
    return [Form, mocks.formApi];
  }),
  z: {
    literal: vi.fn(createRule),
    string: vi.fn(createRule),
  },
}));

vi.mock('@vben/common-ui', () => ({
  useVbenModal: vi.fn((options) => {
    mocks.modalOptions = options;
    const Modal = defineComponent({
      name: 'MockModal',
      setup(_, { slots }) {
        return () => h('section', slots.default?.());
      },
    });
    return [Modal, mocks.modalApi];
  }),
}));

vi.mock('#/api/qqbot/message-push', () => ({
  createMessageSubscription: mocks.create,
  getMessagePushSourceOptions: mocks.getOptions,
  updateMessageSubscription: mocks.update,
}));

/** 创建覆盖依赖字段与任意消息源字段的目录元数据。 */
function createSources(): QqbotMessagePushApi.SystemMessageSourceDefinition[] {
  return [
    {
      description: 'STUN 端口变化',
      displayName: 'STUN 映射端口变更',
      sourceKey: STUN_SOURCE_KEY,
      subscriptionFields: [
        {
          key: 'portForwardId',
          label: 'STUN 端口转发',
          optionCollection: 'portForwards',
          required: true,
          type: 'select',
        },
        {
          dependsOn: 'portForwardId',
          key: 'ddnsRecordId',
          label: 'IPv4 DDNS 记录',
          optionCollection: 'ddnsRecords',
          required: true,
          type: 'select',
        },
      ],
      variables: [],
      version: 1,
    },
    {
      description: '系统健康状态变化',
      displayName: '系统健康状态变化',
      sourceKey: GENERIC_SOURCE_KEY,
      subscriptionFields: [
        {
          key: 'serviceId',
          label: '服务',
          optionCollection: 'services',
          required: true,
          type: 'select',
        },
        {
          dependsOn: 'serviceId',
          key: 'channelId',
          label: '通道',
          optionCollection: 'channels',
          required: false,
          type: 'select',
        },
      ],
      variables: [],
      version: 1,
    },
  ];
}

/** 创建 STUN 消息源的标准候选项响应。 */
function createStunOptions(): QqbotMessagePushApi.SystemMessageSourceOptionsResponse {
  return {
    ddnsRecords: [
      {
        dependsOnValue: '2041700000000000001',
        disabled: false,
        disabledReasonCode: null,
        label: 'Pal DDNS · pal.kwitsukasa.top',
        value: '2041700000000000002',
      },
      {
        dependsOnValue: '2041700000000000001',
        disabled: true,
        disabledReasonCode: 'ddns_disabled',
        label: 'Disabled DDNS · ddns_disabled',
        value: '2041700000000000003',
      },
      {
        dependsOnValue: '2041700000000000005',
        disabled: false,
        disabledReasonCode: null,
        label: 'Other DDNS',
        value: '2041700000000000004',
      },
    ],
    portForwards: [
      {
        disabled: false,
        disabledReasonCode: null,
        label: 'Pal UDP · UDP:8213',
        value: '2041700000000000001',
      },
      {
        disabled: true,
        disabledReasonCode: 'keeper_disabled',
        label: 'Disabled UDP · keeper_disabled',
        value: '2041700000000000005',
      },
    ],
  };
}

/** 创建非 STUN 消息源的标准候选项响应。 */
function createGenericOptions(): QqbotMessagePushApi.SystemMessageSourceOptionsResponse {
  return {
    channels: [
      {
        dependsOnValue: 'service-1',
        disabled: false,
        disabledReasonCode: null,
        label: '告警通道',
        value: 'channel-1',
      },
    ],
    services: [
      {
        disabled: false,
        disabledReasonCode: null,
        label: 'API 服务',
        value: 'service-1',
      },
    ],
  };
}

/** 创建现有通用订阅视图。 */
function createRow(
  sourceKey = GENERIC_SOURCE_KEY,
): QqbotMessagePushApi.MessageSubscriptionView {
  return {
    createTime: '2026-07-24 10:00:00',
    enabled: false,
    id: '10000000000000001',
    invalidReasonCode: null,
    name: '旧订阅',
    remark: '旧备注',
    sourceConfig:
      sourceKey === STUN_SOURCE_KEY
        ? {
            ddnsRecordId: '2041700000000000002',
            portForwardId: '2041700000000000001',
          }
        : { channelId: 'channel-1', serviceId: 'service-1' },
    sourceKey,
    sourceName: '系统消息源',
    sourceSummary: '现有来源摘要',
    updateTime: '2026-07-24 10:00:00',
    valid: true,
  };
}

/** 创建手动控制完成时机的 Promise。 */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** 挂载消息订阅弹窗。 */
function mountModal(
  sources: QqbotMessagePushApi.SystemMessageSourceDefinition[] = createSources(),
) {
  return mount(MessageSubscriptionModal, {
    props: { sources },
  });
}

/** 返回当前表单字段顺序。 */
function currentFields(): string[] {
  return mocks.formOptions.schema.map((field: any) => field.fieldName);
}

describe('message subscription modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.values = {};
    mocks.modalApi.getData.mockImplementation(
      () => mocks.modalApi.setData.mock.calls.at(-1)?.[0] || {},
    );
    mocks.modalApi.setData.mockImplementation(() => mocks.modalApi);
    mocks.modalApi.open.mockImplementation(() => {
      void mocks.modalOptions.onOpenChange?.(true);
      return mocks.modalApi;
    });
    mocks.formApi.getValues.mockImplementation(async () => mocks.values);
    mocks.formApi.setValues.mockImplementation(
      async (patch: Record<string, unknown>) => {
        Object.assign(mocks.values, patch);
      },
    );
    mocks.formApi.validate.mockResolvedValue({ valid: true });
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.getOptions.mockImplementation(async (sourceKey: string) =>
      sourceKey === STUN_SOURCE_KEY
        ? createStunOptions()
        : createGenericOptions(),
    );
  });

  it('新建订阅不默认选择消息源且不预取任何来源候选项', async () => {
    const wrapper = mountModal();

    (wrapper.vm as any).openCreate();
    await flushPromises();

    expect(currentFields()).toEqual(['name', 'sourceKey', 'enabled', 'remark']);
    expect(mocks.formApi.setValues).toHaveBeenLastCalledWith(
      {
        enabled: true,
        name: '',
        remark: '',
        sourceKey: '',
      },
      false,
    );
    expect(mocks.getOptions).not.toHaveBeenCalled();
  });

  it('订阅固定字段和消息源动态必填字段均使用中文校验文案', async () => {
    mountModal();
    const fieldRule = (fieldName: string) =>
      mocks.formOptions.schema.find(
        (field: any) => field.fieldName === fieldName,
      ).rules;

    expect(fieldRule('name').min).toHaveBeenCalledWith(1, '请输入订阅名称');
    expect(fieldRule('name').max).toHaveBeenCalledWith(
      100,
      '订阅名称不能超过 100 个字符',
    );
    expect(fieldRule('sourceKey').min).toHaveBeenCalledWith(1, '请选择消息源');
    expect(fieldRule('remark').max).toHaveBeenCalledWith(
      500,
      '备注不能超过 500 个字符',
    );

    await mocks.formOptions.handleValuesChange({ sourceKey: STUN_SOURCE_KEY }, [
      'sourceKey',
    ]);

    expect(fieldRule('portForwardId').min).toHaveBeenCalledWith(
      1,
      '请选择STUN 端口转发',
    );
    expect(fieldRule('ddnsRecordId').min).toHaveBeenCalledWith(
      1,
      '请选择IPv4 DDNS 记录',
    );
  });

  it('选择消息源后按元数据生成字段并过滤依赖候选项', async () => {
    mountModal();

    await mocks.formOptions.handleValuesChange({ sourceKey: STUN_SOURCE_KEY }, [
      'sourceKey',
    ]);

    expect(mocks.getOptions).toHaveBeenCalledWith(STUN_SOURCE_KEY);
    expect(currentFields()).toEqual([
      'name',
      'sourceKey',
      'portForwardId',
      'ddnsRecordId',
      'enabled',
      'remark',
    ]);
    const portField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'portForwardId',
    );
    expect(portField.componentProps().options[1]).toMatchObject({
      disabled: true,
      disabledReasonCode: 'keeper_disabled',
      value: '2041700000000000005',
    });

    await mocks.formOptions.handleValuesChange(
      {
        ddnsRecordId: '2041700000000000002',
        portForwardId: '2041700000000000001',
        sourceKey: STUN_SOURCE_KEY,
      },
      ['portForwardId'],
    );
    const ddnsField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'ddnsRecordId',
    );
    expect(ddnsField.componentProps().options).toEqual([
      expect.objectContaining({ value: '2041700000000000002' }),
      expect.objectContaining({
        disabled: true,
        value: '2041700000000000003',
      }),
    ]);
  });

  it('切换消息源时清理旧字段并只显示新来源声明字段', async () => {
    mountModal();
    await mocks.formOptions.handleValuesChange({ sourceKey: STUN_SOURCE_KEY }, [
      'sourceKey',
    ]);
    await mocks.formOptions.handleValuesChange(
      {
        ddnsRecordId: '2041700000000000002',
        portForwardId: '2041700000000000001',
      },
      ['portForwardId'],
    );

    await mocks.formOptions.handleValuesChange(
      { sourceKey: GENERIC_SOURCE_KEY },
      ['sourceKey'],
    );

    expect(mocks.formApi.setValues).toHaveBeenCalledWith(
      {
        ddnsRecordId: undefined,
        portForwardId: undefined,
      },
      false,
    );
    expect(currentFields()).toEqual([
      'name',
      'sourceKey',
      'serviceId',
      'channelId',
      'enabled',
      'remark',
    ]);
    expect(mocks.getOptions).toHaveBeenLastCalledWith(GENERIC_SOURCE_KEY);
  });

  it('快速切换消息源时忽略旧来源的迟到响应', async () => {
    const stunRequest =
      createDeferred<QqbotMessagePushApi.SystemMessageSourceOptionsResponse>();
    const genericRequest =
      createDeferred<QqbotMessagePushApi.SystemMessageSourceOptionsResponse>();
    mocks.getOptions.mockImplementation((sourceKey: string) =>
      sourceKey === STUN_SOURCE_KEY
        ? stunRequest.promise
        : genericRequest.promise,
    );
    mountModal();

    const staleSelection = mocks.formOptions.handleValuesChange(
      { sourceKey: STUN_SOURCE_KEY },
      ['sourceKey'],
    );
    await flushPromises();
    const latestSelection = mocks.formOptions.handleValuesChange(
      { sourceKey: GENERIC_SOURCE_KEY },
      ['sourceKey'],
    );
    genericRequest.resolve(createGenericOptions());
    await latestSelection;
    stunRequest.resolve(createStunOptions());
    await staleSelection;

    expect(currentFields()).toContain('serviceId');
    expect(currentFields()).not.toContain('portForwardId');
    const serviceField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'serviceId',
    );
    expect(serviceField.componentProps().options).toEqual([
      expect.objectContaining({ value: 'service-1' }),
    ]);
  });

  it('编辑时恢复任意消息源配置并按当前 sourceKey 加载候选项', async () => {
    const wrapper = mountModal();
    const row = createRow();

    (wrapper.vm as any).openEdit(row);
    await flushPromises();

    expect(mocks.formApi.setValues).toHaveBeenCalledWith(
      {
        channelId: 'channel-1',
        enabled: false,
        name: '旧订阅',
        remark: '旧备注',
        serviceId: 'service-1',
        sourceKey: GENERIC_SOURCE_KEY,
      },
      false,
    );
    expect(mocks.getOptions).toHaveBeenCalledWith(GENERIC_SOURCE_KEY);
    expect(currentFields()).toContain('serviceId');
    expect(currentFields()).toContain('channelId');
  });

  it('弹窗先打开且消息源目录后返回时补建动态字段', async () => {
    const wrapper = mountModal([]);

    (wrapper.vm as any).openEdit(createRow(STUN_SOURCE_KEY));
    await flushPromises();
    expect(currentFields()).not.toContain('portForwardId');

    await wrapper.setProps({ sources: createSources() });
    await flushPromises();

    expect(currentFields()).toContain('portForwardId');
    expect(currentFields()).toContain('ddnsRecordId');
  });

  it('提交时只投影所选消息源声明的配置字段', async () => {
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await mocks.formOptions.handleValuesChange(
      { sourceKey: GENERIC_SOURCE_KEY },
      ['sourceKey'],
    );
    mocks.values = {
      channelId: 'channel-1',
      enabled: true,
      name: ' 通用订阅 ',
      portForwardId: 'stale-port',
      remark: ' managed ',
      serviceId: 'service-1',
      sourceKey: GENERIC_SOURCE_KEY,
    };

    await mocks.modalOptions.onConfirm();

    expect(mocks.create).toHaveBeenCalledWith({
      enabled: true,
      name: '通用订阅',
      remark: 'managed',
      sourceConfig: {
        channelId: 'channel-1',
        serviceId: 'service-1',
      },
      sourceKey: GENERIC_SOURCE_KEY,
    });
    expect(mocks.modalApi.close).toHaveBeenCalledOnce();
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it('普通表单校验失败时不持久化也不锁定弹窗', async () => {
    mocks.formApi.validate.mockResolvedValueOnce({ valid: false });
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();

    await mocks.modalOptions.onConfirm();

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.modalApi.lock).not.toHaveBeenCalled();
  });

  it('持久化失败后保持弹窗可重试并成对解锁', async () => {
    mocks.create.mockRejectedValueOnce(new Error('save failed'));
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    await mocks.formOptions.handleValuesChange(
      { sourceKey: GENERIC_SOURCE_KEY },
      ['sourceKey'],
    );
    mocks.values = {
      enabled: true,
      name: '通用订阅',
      remark: '',
      serviceId: 'service-1',
      sourceKey: GENERIC_SOURCE_KEY,
    };

    await expect(mocks.modalOptions.onConfirm()).resolves.toBeUndefined();
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(mocks.modalApi.unlock).toHaveBeenCalledOnce();

    mocks.create.mockResolvedValue({});
    await mocks.modalOptions.onConfirm();

    expect(mocks.modalApi.close).toHaveBeenCalledOnce();
    expect(mocks.modalApi.unlock).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });
});
