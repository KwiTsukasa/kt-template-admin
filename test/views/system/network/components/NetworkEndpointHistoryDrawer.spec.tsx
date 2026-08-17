/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { SystemNetworkApi } from '#/api/system/network';

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import NetworkEndpointHistoryDrawer from '@test-source/apps/web-antdv-next/src/views/system/network/components/NetworkEndpointHistoryDrawer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  drawerApi: { open: vi.fn() },
  drawerOptions: undefined as any,
  getHistory: vi.fn(),
  tableApi: { reload: vi.fn() },
  tableOptions: undefined as any,
}));

vi.mock('@vben/common-ui', () => ({
  useVbenDrawer: vi.fn((options) => {
    mocks.drawerOptions = options;
    const Drawer = defineComponent({
      name: 'MockDrawer',
      setup(_, { slots }) {
        return () => h('aside', slots.default?.());
      },
    });
    return [Drawer, mocks.drawerApi];
  }),
}));

vi.mock('antdv-next', () => ({
  Tag: defineComponent({
    name: 'MockTag',
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    name: 'MockKtTable',
    setup() {
      return () => h('section');
    },
  }),
  useKtTable: vi.fn((options) => {
    mocks.tableOptions = options;
    return [vi.fn(), mocks.tableApi];
  }),
}));

vi.mock('#/api/system/network', () => ({
  getNetworkPortForwardChannelEndpointHistory: mocks.getHistory,
}));

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

function createGroup(id: string): SystemNetworkApi.PortForwardGroup {
  return {
    appliedProtocolMode: 'tcp_udp',
    channels: {
      tcp: null,
      udp: null,
    },
    externalPort: 40_000,
    id,
    internalPort: 40_000,
    isDeleted: false,
    name: `group-${id}`,
    protocolMode: 'tcp_udp',
    remark: null,
    targetIpv4: '192.168.31.224',
  };
}

describe('network endpoint history drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHistory.mockResolvedValue({ items: [], total: 0 });
  });

  it('stays lazy until opened and uses a disposable Vben drawer', () => {
    mount(NetworkEndpointHistoryDrawer);
    expect(mocks.tableOptions.immediate).toBe(false);
    expect(mocks.drawerOptions.destroyOnClose).toBe(true);
    expect(mocks.getHistory).not.toHaveBeenCalled();
  });

  it('loads the selected group and protocol without reusing a prior scope', async () => {
    const wrapper = mount(NetworkEndpointHistoryDrawer);
    (wrapper.vm as any).open(createGroup('group-1'), 'tcp');
    mocks.drawerOptions.onOpened();
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    await mocks.tableOptions.api.list({ pageNo: 2, pageSize: 10 });
    expect(mocks.getHistory).toHaveBeenLastCalledWith('group-1', 'tcp', {
      pageNo: 2,
      pageSize: 10,
    });

    (wrapper.vm as any).open(createGroup('group-2'), 'udp');
    await mocks.tableOptions.api.list({ pageNo: 1, pageSize: 20 });
    expect(mocks.getHistory).toHaveBeenLastCalledWith('group-2', 'udp', {
      pageNo: 1,
      pageSize: 20,
    });
  });

  it('shows the protocol mechanism returned by the API', () => {
    mount(NetworkEndpointHistoryDrawer);

    expect(mocks.tableOptions.columns.map((column: any) => column.key)).toEqual(
      expect.arrayContaining(['eventType', 'mechanism', 'publicEndpoint']),
    );
  });
});
