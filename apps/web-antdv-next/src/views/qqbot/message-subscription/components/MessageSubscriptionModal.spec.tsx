/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import MessageSubscriptionModal from './MessageSubscriptionModal';

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
    setValues: vi.fn(async () => {}),
    validate: vi.fn(async () => ({ valid: true })),
  };
  return {
    create: vi.fn(),
    formApi,
    formOptions: undefined as any,
    modalApi,
    modalOptions: undefined as any,
    update: vi.fn(),
  };
});

/** Creates a fluent no-op validation rule for schema-only unit tests. */
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
      /** Renders a stable form marker without owning form state. */
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
      /** Renders modal content while the mock API controls lifecycle calls. */
      setup(_, { slots }) {
        return () => h('section', slots.default?.());
      },
    });
    return [Modal, mocks.modalApi];
  }),
}));

vi.mock('#/api/qqbot/message-push', () => ({
  createMessageSubscription: mocks.create,
  updateMessageSubscription: mocks.update,
}));

/** Creates the immutable source catalog fixture consumed by the modal. */
function createSources(): QqbotMessagePushApi.SystemMessageSourceDefinition[] {
  return [
    {
      description: 'STUN 端口变化',
      displayName: 'STUN 映射端口变更',
      sourceKey: 'network.stun.mapping-port-changed',
      subscriptionFields: [],
      variables: [],
      version: 1,
    },
  ];
}

/** Creates string-ID STUN choices including disabled API-owned reasons. */
function createStunOptions(): QqbotMessagePushApi.StunMappingPortChangedOptionsResponse {
  return {
    ddnsRecords: [
      {
        disabledReasonCode: null,
        eligible: true,
        fqdn: 'pal.kwitsukasa.top',
        id: '2041700000000000002',
        name: 'Pal DDNS',
        portForwardId: '2041700000000000001',
      },
      {
        disabledReasonCode: 'ddns_disabled',
        eligible: false,
        fqdn: 'disabled.kwitsukasa.top',
        id: '2041700000000000003',
        name: 'Disabled DDNS',
        portForwardId: '2041700000000000001',
      },
      {
        disabledReasonCode: null,
        eligible: true,
        fqdn: 'other.kwitsukasa.top',
        id: '2041700000000000004',
        name: 'Other DDNS',
        portForwardId: '2041700000000000005',
      },
    ],
    portForwards: [
      {
        disabledReasonCode: null,
        eligible: true,
        externalPort: 8213,
        id: '2041700000000000001',
        internalPort: 8213,
        name: 'Pal UDP',
        protocol: 'udp',
      },
      {
        disabledReasonCode: 'keeper_disabled',
        eligible: false,
        externalPort: 8214,
        id: '2041700000000000005',
        internalPort: 8214,
        name: 'Disabled UDP',
        protocol: 'udp',
      },
    ],
  };
}

/** Creates one editable row with only the global subscription contract. */
function createRow(): QqbotMessagePushApi.MessageSubscriptionView {
  return {
    createTime: '2026-07-24 10:00:00',
    enabled: false,
    id: '10000000000000001',
    invalidReasonCode: null,
    name: '旧订阅',
    remark: '旧备注',
    sourceConfig: {
      ddnsRecordId: '2041700000000000002',
      portForwardId: '2041700000000000001',
    },
    sourceKey: 'network.stun.mapping-port-changed',
    sourceName: 'STUN 映射端口变更',
    sourceSummary: 'Pal UDP · pal.kwitsukasa.top',
    updateTime: '2026-07-24 10:00:00',
    valid: true,
  };
}

/** Mounts the modal with page-owned source and STUN metadata. */
function mountModal() {
  return mount(MessageSubscriptionModal, {
    props: {
      sources: createSources(),
      stunOptions: createStunOptions(),
    },
  });
}

describe('message subscription modal', () => {
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
    mocks.formApi.getValues.mockResolvedValue({
      ddnsRecordId: '2041700000000000002',
      enabled: true,
      name: ' 帕鲁端口变更 ',
      portForwardId: '2041700000000000001',
      remark: ' managed ',
      sourceKey: 'network.stun.mapping-port-changed',
    });
  });

  it('contains the exact source-only fields in their locked order', () => {
    mountModal();

    const fields = mocks.formOptions.schema.map(
      (field: any) => field.fieldName,
    );
    expect(fields).toEqual([
      'name',
      'sourceKey',
      'portForwardId',
      'ddnsRecordId',
      'enabled',
      'remark',
    ]);
    expect(JSON.stringify(mocks.formOptions.schema)).not.toMatch(
      /account|selfId|template|target|group|private|publish|delivery|event|worker|queue/i,
    );
  });

  it('opens before reset/set/reset-validate and clears edit state for create', async () => {
    const wrapper = mountModal();
    mocks.formApi.resetForm.mockImplementation(async () => {
      expect(mocks.modalApi.open).toHaveBeenCalled();
    });

    (wrapper.vm as any).openEdit(createRow());
    await flushPromises();
    (wrapper.vm as any).openCreate();
    await flushPromises();

    expect(mocks.formApi.resetForm).toHaveBeenCalledTimes(2);
    expect(mocks.formApi.setValues).toHaveBeenLastCalledWith({
      ddnsRecordId: undefined,
      enabled: true,
      name: '',
      portForwardId: undefined,
      remark: '',
      sourceKey: 'network.stun.mapping-port-changed',
    });
    expect(mocks.formApi.resetValidate).toHaveBeenCalledTimes(2);
    const resetOrder =
      mocks.formApi.resetForm.mock.invocationCallOrder.at(-1) || 0;
    const setOrder =
      mocks.formApi.setValues.mock.invocationCallOrder.at(-1) || 0;
    const validateOrder =
      mocks.formApi.resetValidate.mock.invocationCallOrder.at(-1) || 0;
    expect(resetOrder).toBeLessThan(setOrder);
    expect(setOrder).toBeLessThan(validateOrder);
  });

  it('preserves string IDs and exposes disabled reasons on matching options', async () => {
    const wrapper = mountModal();
    (wrapper.vm as any).openEdit(createRow());
    await flushPromises();
    const portField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'portForwardId',
    );
    const ddnsField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'ddnsRecordId',
    );
    const portOptions = portField.componentProps().options;
    const ddnsOptions = ddnsField.componentProps().options;

    expect(portOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          disabled: true,
          value: '2041700000000000005',
        }),
      ]),
    );
    expect(portOptions[1].label).toContain('keeper_disabled');
    expect(ddnsOptions).toHaveLength(2);
    expect(ddnsOptions[1]).toMatchObject({
      disabled: true,
      value: '2041700000000000003',
    });
    expect(ddnsOptions[1].label).toContain('ddns_disabled');
    expect(typeof portOptions[0].value).toBe('string');
    expect(typeof ddnsOptions[0].value).toBe('string');
  });

  it('clears only an incompatible DDNS when the selected port changes', async () => {
    mountModal();

    await mocks.formOptions.handleValuesChange(
      {
        ddnsRecordId: '2041700000000000002',
        portForwardId: '2041700000000000001',
      },
      ['portForwardId'],
    );
    expect(mocks.formApi.setValues).not.toHaveBeenCalledWith({
      ddnsRecordId: undefined,
    });

    await mocks.formOptions.handleValuesChange(
      {
        ddnsRecordId: '2041700000000000002',
        portForwardId: '2041700000000000005',
      },
      ['portForwardId'],
    );
    expect(mocks.formApi.setValues).toHaveBeenLastCalledWith({
      ddnsRecordId: undefined,
    });
    const ddnsField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'ddnsRecordId',
    );
    expect(ddnsField.componentProps().options).toEqual([
      expect.objectContaining({ value: '2041700000000000004' }),
    ]);
  });

  it('submits the exact trimmed source-only create payload', async () => {
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();

    await mocks.modalOptions.onConfirm();

    expect(mocks.create).toHaveBeenCalledWith({
      enabled: true,
      name: '帕鲁端口变更',
      remark: 'managed',
      sourceConfig: {
        ddnsRecordId: '2041700000000000002',
        portForwardId: '2041700000000000001',
      },
      sourceKey: 'network.stun.mapping-port-changed',
    });
    expect(JSON.stringify(mocks.create.mock.calls[0]?.[0])).not.toMatch(
      /account|selfId|template|target|group|private|publish|delivery|event|worker|queue/i,
    );
  });

  it('updates with the original unsafe-integer string ID unchanged', async () => {
    const wrapper = mountModal();
    (wrapper.vm as any).openEdit(createRow());
    await flushPromises();

    await mocks.modalOptions.onConfirm();

    expect(mocks.update).toHaveBeenCalledWith(
      '10000000000000001',
      expect.any(Object),
    );
  });

  it('locks, closes, emits once, and unlocks only after successful persistence', async () => {
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();

    await mocks.modalOptions.onConfirm();

    expect(mocks.modalApi.lock).toHaveBeenCalledOnce();
    expect(mocks.modalApi.close).toHaveBeenCalledOnce();
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(mocks.modalApi.unlock).toHaveBeenCalledOnce();
    expect(mocks.modalApi.lock.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.create.mock.invocationCallOrder[0],
    );
  });

  it('keeps the modal usable and emits nothing after a rejected mutation', async () => {
    mocks.create.mockRejectedValue(new Error('save failed'));
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();

    await expect(mocks.modalOptions.onConfirm()).rejects.toThrow('save failed');

    expect(mocks.modalApi.lock).toHaveBeenCalledOnce();
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(wrapper.emitted('saved')).toBeUndefined();
    expect(mocks.modalApi.unlock).toHaveBeenCalledOnce();

    mocks.create.mockResolvedValue({});
    await mocks.modalOptions.onConfirm();

    expect(mocks.modalApi.close).toHaveBeenCalledOnce();
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(mocks.modalApi.unlock).toHaveBeenCalledTimes(2);
  });
});
