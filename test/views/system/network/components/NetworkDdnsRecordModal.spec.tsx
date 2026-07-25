/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import type { SystemNetworkApi } from '#/api/system/network';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import NetworkDdnsRecordModal, {
  isValidDdnsDomain,
  isValidDdnsSubDomain,
} from '@test-source/apps/web-antdv-next/src/views/system/network/components/NetworkDdnsRecordModal';
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
    getSourceOptions: vi.fn(),
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
  createNetworkDdnsRecord: mocks.create,
  getNetworkDdnsSourceOptions: mocks.getSourceOptions,
  updateNetworkDdnsRecord: mocks.update,
}));

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

function createDdnsRow(
  overrides: Partial<SystemNetworkApi.DdnsRecord> = {},
): SystemNetworkApi.DdnsRecord {
  return {
    appliedAddress: '123.45.67.89',
    domain: 'kwitsukasa.top',
    enabled: true,
    fqdn: 'nas.kwitsukasa.top',
    id: '90071992547409930',
    name: 'NAS IPv4',
    portForwardId: '90071992547409931',
    recordType: 'A',
    retryCount: 0,
    source: {
      currentAddress: '123.45.67.89',
      eligible: true,
      externalPort: 45_678,
      id: '90071992547409931',
      name: 'NAS UDP',
      protocol: 'udp',
      sourceType: 'port_forward_ipv4',
    },
    sourceAddress: '123.45.67.89',
    sourceType: 'port_forward_ipv4',
    subDomain: 'nas',
    syncStatus: 'synced',
    ...overrides,
  };
}

describe('network DDNS record modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.getSourceOptions.mockImplementation(async (recordType: string) => ({
      items:
        recordType === 'AAAA'
          ? [
              {
                currentAddress: '2409:8a31::1',
                eligible: true,
                id: 'agent-ipv6',
                name: 'Agent IPv6',
                sourceType: 'agent_ipv6',
              },
            ]
          : [
              {
                currentAddress: '123.45.67.89',
                disabledReasonCode: null,
                eligible: true,
                externalPort: 45_678,
                id: '90071992547409931',
                name: 'NAS UDP',
                protocol: 'udp',
                sourceType: 'port_forward_ipv4',
              },
              {
                currentAddress: null,
                disabledReasonCode: 'KEEPER_DISABLED',
                eligible: false,
                externalPort: 8213,
                id: '90071992547409932',
                name: 'Disabled UDP',
                protocol: 'udp',
                sourceType: 'port_forward_ipv4',
              },
            ],
    }));
    mocks.formApi.getValues.mockResolvedValue({
      domain: ' kwitsukasa.top ',
      enabled: true,
      name: ' NAS IPv4 ',
      portForwardId: '90071992547409931',
      recordType: 'A',
      remark: ' managed ',
      subDomain: ' nas ',
    });
  });

  it('contains only approved dual-stack fields and no provider credential fields', () => {
    mount(NetworkDdnsRecordModal);

    expect(
      mocks.formOptions.schema.map((field: any) => field.fieldName),
    ).toEqual([
      'name',
      'recordType',
      'domain',
      'subDomain',
      'portForwardId',
      'enabled',
      'remark',
    ]);
    expect(
      mocks.formOptions.schema.map((field: any) => field.fieldName).join(' '),
    ).not.toMatch(
      /secret|credential|password|token|ttl|recordLine|recordValue/i,
    );
  });

  it.each([
    [
      'create',
      (wrapper: ReturnType<typeof mount>) => (wrapper.vm as any).openCreate(),
    ],
    [
      'edit',
      (wrapper: ReturnType<typeof mount>) =>
        (wrapper.vm as any).openEdit(createDdnsRow()),
    ],
  ])(
    'opens before restoring the %s form and loading sources',
    async (_, open) => {
      mocks.formApi.resetForm.mockImplementation(async () => {
        expect(mocks.modalApi.open).toHaveBeenCalledOnce();
      });
      const wrapper = mount(NetworkDdnsRecordModal);

      await open(wrapper);
      await flushPromises();

      expect(mocks.modalApi.open).toHaveBeenCalledOnce();
      expect(mocks.formApi.resetForm).toHaveBeenCalledOnce();
      expect(mocks.getSourceOptions).toHaveBeenCalledWith('A');
    },
  );

  it('keeps source IDs as strings and disables ineligible IPv4 choices with a reason', async () => {
    const wrapper = mount(NetworkDdnsRecordModal);
    await (wrapper.vm as any).openCreate();
    await flushPromises();
    const sourceField = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'portForwardId',
    );
    const options = sourceField.componentProps().options;

    expect(options[0]).toMatchObject({
      disabled: false,
      value: '90071992547409931',
    });
    expect(options[1]).toMatchObject({
      disabled: true,
      value: '90071992547409932',
    });
    expect(options[1].label).toContain('KEEPER_DISABLED');
    expect(typeof options[0].value).toBe('string');
  });

  it('switches AAAA to the server-controlled Agent IPv6 source and omits a mapping ID', async () => {
    const wrapper = mount(NetworkDdnsRecordModal);
    await (wrapper.vm as any).openCreate();
    await mocks.formOptions.handleValuesChange({ recordType: 'AAAA' }, [
      'recordType',
    ]);
    await flushPromises();
    mocks.formApi.getValues.mockResolvedValue({
      domain: 'kwitsukasa.top',
      enabled: true,
      name: 'NAS IPv6',
      portForwardId: 'must-not-leak',
      recordType: 'AAAA',
      remark: '',
      subDomain: 'nas6',
    });

    await mocks.modalOptions.onConfirm();

    expect(mocks.getSourceOptions).toHaveBeenLastCalledWith('AAAA');
    expect(mocks.create).toHaveBeenCalledWith({
      domain: 'kwitsukasa.top',
      enabled: true,
      name: 'NAS IPv6',
      portForwardId: undefined,
      recordType: 'AAAA',
      remark: '',
      sourceType: 'agent_ipv6',
      subDomain: 'nas6',
    });
    expect(wrapper.text()).toContain('2409:8a31::1');
  });

  it('updates with the exact string ID and trims only editable values', async () => {
    const row = createDdnsRow();
    const wrapper = mount(NetworkDdnsRecordModal);
    await (wrapper.vm as any).openEdit(row);
    await mocks.modalOptions.onConfirm();

    expect(mocks.update).toHaveBeenCalledWith('90071992547409930', {
      domain: 'kwitsukasa.top',
      enabled: true,
      name: 'NAS IPv4',
      portForwardId: '90071992547409931',
      recordType: 'A',
      remark: 'managed',
      sourceType: 'port_forward_ipv4',
      subDomain: 'nas',
    });
  });

  it('keeps the modal open and always unlocks after an API error', async () => {
    mocks.create.mockRejectedValue(new Error('provider unavailable'));
    const wrapper = mount(NetworkDdnsRecordModal);
    await (wrapper.vm as any).openCreate();

    await expect(mocks.modalOptions.onConfirm()).rejects.toThrow(
      'provider unavailable',
    );

    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(mocks.modalApi.unlock).toHaveBeenCalledOnce();
  });
});

describe('ddns domain validation', () => {
  it.each([
    'https://kwitsukasa.top',
    'kwitsukasa.top/path',
    'kwitsukasa.top?x=1',
    'kwitsukasa.top:53',
    'kwi tsukasa.top',
    '-bad.kwitsukasa.top',
    'bad-.kwitsukasa.top',
    'bad..kwitsukasa.top',
  ])('rejects malformed zone %s', (value) => {
    expect(isValidDdnsDomain(value)).toBe(false);
  });

  it.each([
    'https://nas',
    'nas/path',
    'nas?x=1',
    'nas:8213',
    'nas home',
    '-nas',
    'nas-',
    'nas..home',
  ])('rejects malformed host record %s', (value) => {
    expect(isValidDdnsSubDomain(value)).toBe(false);
  });

  it('accepts normal dual-stack host records and the root marker', () => {
    expect(isValidDdnsDomain('kwitsukasa.top')).toBe(true);
    expect(isValidDdnsSubDomain('nas6')).toBe(true);
    expect(isValidDdnsSubDomain('home.nas')).toBe(true);
    expect(isValidDdnsSubDomain('@')).toBe(true);
  });
});
