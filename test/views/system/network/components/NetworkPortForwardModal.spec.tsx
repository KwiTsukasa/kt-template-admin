/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import type { SystemNetworkApi } from '#/api/system/network';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import NetworkPortForwardModal from '@test-source/apps/web-antdv-next/src/views/system/network/components/NetworkPortForwardModal';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  for (const method of [
    'int',
    'max',
    'min',
    'optional',
    'or',
    'refine',
    'trim',
  ]) {
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
    props: { title: String },
    setup(props) {
      return () => h('p', props.title);
    },
  }),
  message: { success: vi.fn(), warning: vi.fn() },
}));

vi.mock('#/api/system/network', () => ({
  createNetworkPortForwardGroup: mocks.create,
  updateNetworkPortForwardGroup: mocks.update,
}));

vi.mock('#/locales', () => ({
  $t: (key: string) =>
    ({
      'system.network.nameRequired': '请输入规则名称',
      'system.network.portRequired': '请输入端口',
      'system.network.protocolModeRequired': '请选择协议模式',
    })[key] || key,
}));

function createGroup(
  overrides: Partial<SystemNetworkApi.PortForwardGroup> = {},
): SystemNetworkApi.PortForwardGroup {
  return {
    appliedProtocolMode: 'udp',
    channels: {
      tcp: null,
      udp: {
        desiredPresence: 'present',
        desiredRevision: '7',
        externalPort: 45_678,
        groupId: '42',
        id: '4202',
        internalPort: 45_678,
        isDeleted: false,
        keeperDesiredEnabled: false,
        keeperStatus: 'disabled',
        name: 'Game UDP',
        natmapDesiredEnabled: false,
        natmapStatus: 'disabled',
        protocol: 'udp',
        syncStatus: 'synced',
        targetIpv4: '192.168.31.224',
      },
    },
    externalPort: 45_678,
    id: '42',
    internalPort: 45_678,
    isDeleted: false,
    name: 'Game UDP',
    protocolMode: 'udp',
    remark: null,
    targetIpv4: '192.168.31.224',
    ...overrides,
  };
}

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
      protocolMode: 'udp',
      remark: ' managed ',
    });
  });

  it('contains one port pair, three protocol modes and a read-only target IPv4', async () => {
    const wrapper = mount(NetworkPortForwardModal);
    await (wrapper.vm as any).openCreate('192.168.31.224');

    expect(
      mocks.formOptions.schema.map((field: any) => field.fieldName),
    ).toEqual([
      'name',
      'protocolMode',
      'externalPort',
      'internalPort',
      'remark',
    ]);
    const protocolField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'protocolMode',
    );
    expect(protocolField.defaultValue).toBe('udp');
    expect(protocolField.componentProps().options).toEqual([
      { label: 'TCP', value: 'tcp' },
      { label: 'UDP', value: 'udp' },
      { label: 'TCP+UDP', value: 'tcp_udp' },
    ]);
    expect(JSON.stringify(mocks.formOptions.schema)).not.toMatch(
      /password|routerUrl|token/i,
    );
    expect(wrapper.text()).toContain('192.168.31.224');
    expect(mocks.formApi.setValues).toHaveBeenCalledWith(
      expect.not.objectContaining({
        keeperDesiredEnabled: expect.anything(),
        natmapDesiredEnabled: expect.anything(),
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
        (wrapper.vm as any).openEdit(createGroup()),
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
    expect(mocks.formApi.resetValidate).toHaveBeenCalledOnce();
  });

  it('uses explicit localized required messages for every required field', () => {
    mount(NetworkPortForwardModal);
    const schema = mocks.formOptions.schema;
    const fieldRule = (fieldName: string) =>
      schema.find((field: any) => field.fieldName === fieldName).rules;

    expect(fieldRule('name').min).toHaveBeenCalledWith(1, '请输入规则名称');
    expect(fieldRule('protocolMode').refine).toHaveBeenCalledWith(
      expect.any(Function),
      '请选择协议模式',
    );
    expect(fieldRule('externalPort').min).toHaveBeenCalledWith(
      1,
      expect.any(String),
    );
    expect(fieldRule('internalPort').min).toHaveBeenCalledWith(
      1,
      expect.any(String),
    );
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
      protocolMode: 'udp',
      remark: 'managed',
    });
    expect(JSON.stringify(mocks.create.mock.calls[0]?.[0])).not.toMatch(
      /password|targetIpv4|keeper|natmapDesired|token/i,
    );
    expect(mocks.modalApi.lock).toHaveBeenCalledOnce();
    expect(mocks.modalApi.unlock).toHaveBeenCalledOnce();
  });

  it('sends an explicit empty remark when an existing value is cleared', async () => {
    mocks.formApi.getValues.mockResolvedValue({
      externalPort: 45_678,
      internalPort: 45_678,
      name: 'Game UDP',
      protocolMode: 'udp',
      remark: '   ',
    });
    const wrapper = mount(NetworkPortForwardModal);
    await (wrapper.vm as any).openEdit(createGroup({ remark: 'old remark' }));
    await mocks.modalOptions.onConfirm();

    expect(mocks.update).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({ remark: '' }),
    );
  });

  it('disables structural fields while either mechanism is active', async () => {
    const wrapper = mount(NetworkPortForwardModal);
    const baseUdpChannel = createGroup().channels.udp;
    if (!baseUdpChannel) throw new Error('UDP fixture is required');
    const row = createGroup({
      appliedProtocolMode: 'tcp_udp',
      channels: {
        tcp: {
          ...baseUdpChannel,
          groupId: '42',
          id: '4201',
          keeperDesiredEnabled: false,
          keeperStatus: 'disabled',
          natmapDesiredEnabled: true,
          natmapStatus: 'active',
          protocol: 'tcp',
        },
        udp: baseUdpChannel,
      },
      protocolMode: 'tcp_udp',
    });

    await (wrapper.vm as any).openEdit(row);
    await flushPromises();

    for (const fieldName of ['protocolMode', 'externalPort', 'internalPort']) {
      const field = mocks.formOptions.schema.find(
        (item: any) => item.fieldName === fieldName,
      );
      expect(field.componentProps().disabled).toBe(true);
    }
    expect(wrapper.text()).toContain(
      'system.network.disableMechanismsBeforeEdit',
    );
  });
});
