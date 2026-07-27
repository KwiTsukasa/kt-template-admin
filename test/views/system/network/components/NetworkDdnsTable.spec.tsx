/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { SystemNetworkApi } from '#/api/system/network';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import NetworkDdnsTable, {
  getDdnsRetryDisabledReason,
} from '@test-source/apps/web-antdv-next/src/views/system/network/components/NetworkDdnsTable';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  api: {
    deleteRecord: vi.fn(),
    getList: vi.fn(),
    getProviderStatus: vi.fn(),
    retryRecord: vi.fn(),
  },
  messageSuccess: vi.fn(),
  modalOpenCreate: vi.fn(),
  modalOpenEdit: vi.fn(),
  tableApi: {
    reload: vi.fn(),
  },
  tableOptions: undefined as any,
}));

vi.mock('antdv-next', () => ({
  message: { success: mocks.messageSuccess },
  Space: defineComponent({
    name: 'MockSpace',
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
  Tag: defineComponent({
    name: 'MockTag',
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
  Typography: {
    Text: defineComponent({
      name: 'MockText',
      setup(_, { slots }) {
        return () => h('span', slots.default?.());
      },
    }),
  },
}));

vi.mock('#/components/ktTable', () => ({
  KtTable: defineComponent({
    name: 'MockKtTable',
    setup(_, { slots }) {
      return () =>
        h('section', { 'data-testid': 'ddns-table' }, [
          slots.headerControls?.(),
          slots.bodyCell?.({
            column: { key: 'identity' },
            record: createDdnsRow(),
          }),
          slots.bodyCell?.({
            column: { key: 'syncStatus' },
            record: createDdnsRow(),
          }),
          slots.bodyCell?.({
            column: { key: 'source' },
            record: createDdnsRow(),
          }),
          slots.bodyCell?.({
            column: { key: 'source' },
            record: createDdnsRow({
              accessEndpoint: 'web.kwitsukasa.top:45101',
              source: {
                currentAddress: '8.8.8.8',
                currentPort: 45_101,
                eligible: true,
                externalPort: 443,
                groupId: 'group-tcp',
                id: 'channel-tcp',
                mechanism: 'tcp_natmap',
                name: '公网服务 / TCP NATMap',
                protocol: 'tcp',
                sourceType: 'port_forward_ipv4',
              },
            }),
          }),
          slots.bodyCell?.({
            column: { key: 'sourceAddress' },
            record: createDdnsRow(),
          }),
          slots.bodyCell?.({
            column: { key: 'appliedAddress' },
            record: createDdnsRow(),
          }),
          slots.bodyCell?.({
            column: { key: 'accessEndpoint' },
            record: createDdnsRow(),
          }),
        ]);
    },
  }),
  useKtTable: vi.fn((options) => {
    mocks.tableOptions = options;
    return [vi.fn(), mocks.tableApi];
  }),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/system/network/components/NetworkDdnsRecordModal',
  () => ({
    default: defineComponent({
      name: 'MockNetworkDdnsRecordModal',
      setup(_, { expose }) {
        expose({
          openCreate: mocks.modalOpenCreate,
          openEdit: mocks.modalOpenEdit,
        });
        return () => h('div');
      },
    }),
  }),
);

vi.mock('#/api/system/network', () => ({
  deleteNetworkDdnsRecord: mocks.api.deleteRecord,
  getNetworkDdnsList: mocks.api.getList,
  getNetworkDdnsProviderStatus: mocks.api.getProviderStatus,
  retryNetworkDdnsRecord: mocks.api.retryRecord,
}));

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

function createDdnsRow(
  overrides: Partial<SystemNetworkApi.DdnsRecord> = {},
): SystemNetworkApi.DdnsRecord {
  return {
    accessEndpoint: 'nas.kwitsukasa.top:45678',
    appliedAddress: '123.45.67.89',
    domain: 'kwitsukasa.top',
    enabled: true,
    fqdn: 'nas.kwitsukasa.top',
    id: '90071992547409930',
    lastSyncedAt: '2026-07-23T08:00:00.000Z',
    name: 'NAS IPv4',
    portForwardId: '90071992547409931',
    recordType: 'A',
    retryCount: 0,
    source: {
      currentAddress: '123.45.67.89',
      currentPort: 45_678,
      eligible: true,
      externalPort: 45_678,
      groupId: 'group-1',
      id: '90071992547409931',
      mechanism: 'udp_stun',
      name: 'NAS / UDP Keeper',
      protocol: 'udp',
      sourceType: 'port_forward_ipv4',
    },
    sourceAddress: '123.45.67.89',
    sourceType: 'port_forward_ipv4',
    subDomain: 'nas',
    syncStatus: 'synced',
    updateTime: '2026-07-23T08:00:00.000Z',
    ...overrides,
  };
}

describe('network DDNS table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.getProviderStatus.mockResolvedValue({
      configured: true,
      enabled: true,
      provider: 'dnspod',
    });
    mocks.api.deleteRecord.mockResolvedValue({});
    mocks.api.retryRecord.mockResolvedValue({});
    mocks.tableApi.reload.mockResolvedValue(undefined);
  });

  it('uses an independent KtTable with dual-stack address columns', () => {
    const wrapper = mount(NetworkDdnsTable);

    expect(wrapper.find('[data-testid="ddns-table"]').exists()).toBe(true);
    expect(mocks.tableOptions.immediate).toBe(false);
    expect(mocks.tableOptions.columns.map((item: any) => item.key)).toEqual([
      'identity',
      'source',
      'sourceAddress',
      'appliedAddress',
      'accessEndpoint',
      'syncStatus',
      'lastSync',
      'updateTime',
    ]);
    expect(mocks.tableOptions.tableTitle).toBe('system.network.ddnsTitle');
    expect(mocks.tableOptions.rowActionVisibleCount).toBe(2);
  });

  it('shows the source label, raw endpoint, DNS value and derived access endpoint', () => {
    const wrapper = mount(NetworkDdnsTable);

    expect(wrapper.text()).toContain('NAS / UDP Keeper');
    expect(wrapper.text()).toContain('公网服务 / TCP NATMap');
    expect(wrapper.text()).toContain('123.45.67.89:45678');
    expect(wrapper.text()).toContain('nas.kwitsukasa.top');
    expect(wrapper.text()).toContain('nas.kwitsukasa.top:45678');
    expect(wrapper.text()).toContain('123.45.67.89');
  });

  it('keeps retry visible but disables it for every unsafe state with an exact reason', () => {
    mount(NetworkDdnsTable);
    const retry = mocks.tableOptions.rowActions.find(
      (item: any) => item.key === 'retry',
    );

    expect(retry.rowVisible).toBeUndefined();
    expect(retry.disabled(createDdnsRow({ enabled: false }))).toBe(true);
    expect(getDdnsRetryDisabledReason(createDdnsRow({ enabled: false }))).toBe(
      'system.network.ddnsRetryDisabled',
    );
    expect(
      getDdnsRetryDisabledReason(createDdnsRow({ syncStatus: 'syncing' })),
    ).toBe('system.network.ddnsSyncInProgress');
    expect(
      getDdnsRetryDisabledReason(
        createDdnsRow({
          source: {
            ...createDdnsRow().source,
            disabledReasonCode: 'KEEPER_DISABLED',
            eligible: false,
          },
        }),
      ),
    ).toContain('KEEPER_DISABLED');
    expect(
      getDdnsRetryDisabledReason(
        createDdnsRow({
          source: { ...createDdnsRow().source, currentAddress: null },
          sourceAddress: null,
        }),
      ),
    ).toBe('system.network.ddnsSourceAddressMissing');
  });

  it('uses scoped permissions and explains that delete preserves DNSPod records', () => {
    mount(NetworkDdnsTable);

    expect(mocks.tableOptions.buttons[0].permissionCodes).toEqual([
      'System:Network:Ddns:Create',
    ]);
    expect(
      mocks.tableOptions.rowActions.map((item: any) => [
        item.key,
        item.permissionCodes,
      ]),
    ).toEqual([
      ['edit', ['System:Network:Ddns:Update']],
      ['retry', ['System:Network:Ddns:Retry']],
      ['delete', ['System:Network:Ddns:Delete']],
    ]);
    const deleteAction = mocks.tableOptions.rowActions.find(
      (item: any) => item.key === 'delete',
    );
    expect(deleteAction.confirm(createDdnsRow())).toBe(
      'system.network.ddnsDeleteConfirm',
    );
  });

  it('opens create/edit modals and refreshes both list and provider status on demand', async () => {
    const wrapper = mount(NetworkDdnsTable);
    const row = createDdnsRow();

    await mocks.tableOptions.buttons[0].onClick({});
    await mocks.tableOptions.rowActions
      .find((item: any) => item.key === 'edit')
      .onClick(row, {});
    await (wrapper.vm as any).reload();
    await flushPromises();

    expect(mocks.modalOpenCreate).toHaveBeenCalledOnce();
    expect(mocks.modalOpenEdit).toHaveBeenCalledWith(row);
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.api.getProviderStatus).toHaveBeenCalledOnce();
  });

  it('supports IPv6 source and applied addresses without IPv4-specific labels', () => {
    mount(NetworkDdnsTable);
    const row = createDdnsRow({
      appliedAddress: '2409:8a31::1',
      fqdn: 'nas6.kwitsukasa.top',
      portForwardId: null,
      recordType: 'AAAA',
      source: {
        currentAddress: '2409:8a31::1',
        eligible: true,
        id: 'agent-ipv6',
        name: 'Agent IPv6',
        sourceType: 'agent_ipv6',
      },
      sourceAddress: '2409:8a31::1',
      sourceType: 'agent_ipv6',
      subDomain: 'nas6',
      accessEndpoint: undefined,
    });
    const renderBodyCell = (mocks.tableOptions as any).renderBodyCell;

    expect(row.source.currentAddress).toBe('2409:8a31::1');
    expect(JSON.stringify(mocks.tableOptions.columns)).not.toMatch(
      /sourceIpv4|appliedIpv4/i,
    );
    expect(renderBodyCell).toBeUndefined();
  });
});
