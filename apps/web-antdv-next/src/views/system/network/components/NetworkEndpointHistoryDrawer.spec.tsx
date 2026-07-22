/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { SystemNetworkApi } from '#/api/system/network';

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import NetworkEndpointHistoryDrawer from './NetworkEndpointHistoryDrawer';

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

vi.mock('#/components/ktTable', () => ({
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
  getNetworkPortForwardEndpointHistory: mocks.getHistory,
}));

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

/** Creates the minimal row needed to scope a history request. */
function createRow(id: string): SystemNetworkApi.PortForward {
  return {
    desiredPresence: 'present',
    desiredRevision: '1',
    externalPort: 40_000,
    id,
    internalPort: 40_000,
    isDeleted: false,
    keeperDesiredEnabled: true,
    keeperStatus: 'active',
    name: `mapping-${id}`,
    protocol: 'udp',
    syncStatus: 'synced',
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

  it('loads the selected record ID and does not reuse a prior selection', async () => {
    const wrapper = mount(NetworkEndpointHistoryDrawer);
    (wrapper.vm as any).open(createRow('mapping-1'));
    mocks.drawerOptions.onOpened();
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    await mocks.tableOptions.api.list({ pageNo: 2, pageSize: 10 });
    expect(mocks.getHistory).toHaveBeenLastCalledWith('mapping-1', {
      pageNo: 2,
      pageSize: 10,
    });

    (wrapper.vm as any).open(createRow('mapping-2'));
    await mocks.tableOptions.api.list({ pageNo: 1, pageSize: 20 });
    expect(mocks.getHistory).toHaveBeenLastCalledWith('mapping-2', {
      pageNo: 1,
      pageSize: 20,
    });
  });
});
