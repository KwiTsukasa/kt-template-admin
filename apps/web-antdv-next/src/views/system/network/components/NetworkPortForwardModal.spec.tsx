/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import NetworkPortForwardModal from './NetworkPortForwardModal';

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

function createRule(): any {
  const rule: any = {};
  for (const method of ['int', 'max', 'min', 'optional', 'or', 'trim']) {
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
        return () => h('form');
      },
    });
    return [Form, mocks.formApi];
  }),
  z: {
    enum: vi.fn(createRule),
    literal: vi.fn(createRule),
    number: vi.fn(createRule),
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

vi.mock('antdv-next', () => ({
  Alert: defineComponent({
    name: 'MockAlert',
    props: { message: String },
    setup(props) {
      return () => h('p', props.message);
    },
  }),
  message: { success: vi.fn(), warning: vi.fn() },
}));

vi.mock('#/api/system/network', () => ({
  createNetworkPortForward: mocks.create,
  updateNetworkPortForward: mocks.update,
}));

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

describe('network port-forward modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.formApi.resetForm.mockResolvedValue(undefined);
    mocks.modalApi.getData.mockImplementation(
      () => mocks.modalApi.setData.mock.calls.at(-1)?.[0] || {},
    );
    mocks.modalApi.setData.mockImplementation(() => mocks.modalApi);
    mocks.modalApi.open.mockImplementation(() => {
      mocks.modalOptions.onOpenChange?.(true);
      return mocks.modalApi;
    });
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.formApi.getValues.mockResolvedValue({
      externalPort: 45_678,
      internalPort: 45_678,
      name: ' Game UDP ',
      protocol: 'udp',
      remark: ' managed ',
    });
  });

  it('contains only approved editable fields and shows target IPv4 read-only', async () => {
    const wrapper = mount(NetworkPortForwardModal);
    await (wrapper.vm as any).openCreate('192.168.31.224');

    expect(
      mocks.formOptions.schema.map((field: any) => field.fieldName),
    ).toEqual(['name', 'protocol', 'externalPort', 'internalPort', 'remark']);
    expect(JSON.stringify(mocks.formOptions.schema)).not.toMatch(
      /password|routerUrl|token/i,
    );
    expect(wrapper.text()).toContain('192.168.31.224');
    expect(mocks.formApi.setValues).toHaveBeenCalledWith(
      expect.not.objectContaining({
        keeperDesiredEnabled: expect.anything(),
        targetIpv4: expect.anything(),
      }),
    );
  });

  it.each([
    [
      'create',
      (wrapper: ReturnType<typeof mount>) =>
        (wrapper.vm as any).openCreate('192.168.31.224'),
    ],
    [
      'edit',
      (wrapper: ReturnType<typeof mount>) =>
        (wrapper.vm as any).openEdit({
          desiredPresence: 'present',
          desiredRevision: '7',
          externalPort: 45_678,
          id: '42',
          internalPort: 45_678,
          isDeleted: false,
          keeperDesiredEnabled: false,
          keeperStatus: 'disabled',
          name: 'Game UDP',
          protocol: 'udp',
          syncStatus: 'synced',
          targetIpv4: '192.168.31.224',
        }),
    ],
  ])('opens the modal before restoring the %s form', async (_, openModal) => {
    mocks.formApi.resetForm.mockImplementation(async () => {
      expect(mocks.modalApi.open).toHaveBeenCalledOnce();
    });
    const wrapper = mount(NetworkPortForwardModal);

    await openModal(wrapper);
    await flushPromises();

    expect(mocks.modalApi.open).toHaveBeenCalledOnce();
    expect(mocks.formApi.resetForm).toHaveBeenCalledOnce();
  });

  it('matches the API name and remark length contract', () => {
    mount(NetworkPortForwardModal);
    const schema = mocks.formOptions.schema as Array<{
      componentProps?: { maxlength?: number };
      fieldName: string;
    }>;

    expect(
      schema.find((field) => field.fieldName === 'name')?.componentProps
        ?.maxlength,
    ).toBe(100);
    expect(
      schema.find((field) => field.fieldName === 'remark')?.componentProps
        ?.maxlength,
    ).toBe(500);
  });

  it('creates a trimmed desired payload without runtime or secret fields', async () => {
    const wrapper = mount(NetworkPortForwardModal);
    await (wrapper.vm as any).openCreate('192.168.31.224');
    await mocks.modalOptions.onConfirm();

    expect(mocks.create).toHaveBeenCalledWith({
      externalPort: 45_678,
      internalPort: 45_678,
      name: 'Game UDP',
      protocol: 'udp',
      remark: 'managed',
    });
    expect(JSON.stringify(mocks.create.mock.calls[0]?.[0])).not.toMatch(
      /password|targetIpv4|keeper|token/i,
    );
    expect(mocks.modalApi.lock).toHaveBeenCalledOnce();
    expect(mocks.modalApi.unlock).toHaveBeenCalledOnce();
  });

  it('sends an explicit empty remark when an existing value is cleared', async () => {
    mocks.formApi.getValues.mockResolvedValue({
      externalPort: 45_678,
      internalPort: 45_678,
      name: 'Game UDP',
      protocol: 'udp',
      remark: '   ',
    });
    const wrapper = mount(NetworkPortForwardModal);
    await (wrapper.vm as any).openEdit({
      desiredPresence: 'present',
      desiredRevision: '7',
      externalPort: 45_678,
      id: '42',
      internalPort: 45_678,
      isDeleted: false,
      keeperDesiredEnabled: false,
      keeperStatus: 'disabled',
      name: 'Game UDP',
      protocol: 'udp',
      remark: 'old remark',
      syncStatus: 'synced',
      targetIpv4: '192.168.31.224',
    });
    await mocks.modalOptions.onConfirm();

    expect(mocks.update).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({ remark: '' }),
    );
  });
});
