/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { SystemNetworkApi } from '#/api/system/network';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import routes from '#/router/routes/modules/system';

import NetworkList, {
  getCurrentEndpoint,
  getKeeperDisabledReason,
  isDeleting,
} from './list';

type FakeEventSourceListener = (event: Event) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  closed = false;
  readonly listeners = new Map<string, Set<FakeEventSourceListener>>();

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit,
  ) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: FakeEventSourceListener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close() {
    this.closed = true;
  }

  dispatch(type: string, data: Record<string, unknown>) {
    if (this.closed) return;
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  removeEventListener(type: string, listener: FakeEventSourceListener) {
    this.listeners.get(type)?.delete(listener);
  }
}

const mocks = vi.hoisted(() => ({
  accessCodes: new Set<string>([
    'System:Network:Ddns:List',
    'System:Network:PortForward:List',
  ]),
  api: {
    deleteMapping: vi.fn(),
    disableKeeper: vi.fn(),
    enableKeeper: vi.fn(),
    getAgentStatus: vi.fn(),
    getList: vi.fn(),
    probe: vi.fn(),
    retry: vi.fn(),
  },
  ddnsReload: vi.fn(),
  messageSuccess: vi.fn(),
  modalOpenCreate: vi.fn(),
  modalOpenEdit: vi.fn(),
  tableApi: {
    getRows: vi.fn(() => []),
    reload: vi.fn(),
  },
  tableOptions: undefined as any,
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => mocks.accessCodes.has(code)),
  }),
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    name: 'MockPage',
    setup(_, { slots }) {
      return () => h('main', { 'data-testid': 'page-root' }, slots.default?.());
    },
  }),
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
  Tabs: defineComponent({
    name: 'MockTabs',
    props: {
      activeKey: { default: '', type: String },
      items: { default: () => [], type: Array },
    },
    emits: ['update:activeKey'],
    setup(props, { emit }) {
      return () =>
        h(
          'nav',
          { 'data-testid': 'network-tabs' },
          (props.items as Array<{ key: string; label: string }>).map((item) =>
            h(
              'button',
              {
                'data-tab': item.key,
                onClick: () => emit('update:activeKey', item.key),
              },
              item.label,
            ),
          ),
        );
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
        h('section', { 'data-testid': 'network-table' }, [
          slots.headerControls?.(),
          slots.bodyCell?.({
            column: { key: 'syncStatus' },
            record: { syncStatus: 'pending' },
          }),
          slots.bodyCell?.({
            column: { key: 'keeper' },
            record: {
              keeperDesiredEnabled: true,
              keeperStatus: 'active',
            },
          }),
        ]);
    },
  }),
  useKtTable: vi.fn((options) => {
    mocks.tableOptions = options;
    return [vi.fn(), mocks.tableApi];
  }),
}));

vi.mock('./components/NetworkPortForwardModal', () => ({
  default: defineComponent({
    name: 'MockNetworkPortForwardModal',
    setup(_, { expose }) {
      expose({
        openCreate: mocks.modalOpenCreate,
        openEdit: mocks.modalOpenEdit,
      });
      return () => h('div');
    },
  }),
}));

vi.mock('./components/NetworkDdnsTable', () => ({
  default: defineComponent({
    name: 'MockNetworkDdnsTable',
    setup(_, { expose }) {
      expose({ reload: mocks.ddnsReload });
      return () => h('section', { 'data-testid': 'ddns-table' });
    },
  }),
}));

vi.mock('./components/NetworkEndpointHistoryDrawer', () => ({
  default: defineComponent({
    name: 'MockNetworkEndpointHistoryDrawer',
    setup(_, { expose }) {
      expose({ open: vi.fn() });
      return () => h('div');
    },
  }),
}));

vi.mock('#/api/system/network', () => ({
  deleteNetworkPortForward: mocks.api.deleteMapping,
  disableNetworkPortForwardKeeper: mocks.api.disableKeeper,
  enableNetworkPortForwardKeeper: mocks.api.enableKeeper,
  getNetworkAgentStatus: mocks.api.getAgentStatus,
  getNetworkManagementEventsUrl: vi.fn(
    () => '/api/system/network/events/stream',
  ),
  getNetworkPortForwardList: mocks.api.getList,
  probeNetworkPortForward: mocks.api.probe,
  retryNetworkPortForward: mocks.api.retry,
}));

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

function createRow(
  overrides: Partial<SystemNetworkApi.PortForward> = {},
): SystemNetworkApi.PortForward {
  return {
    currentObservedAt: null,
    currentPublicIpv4: null,
    currentPublicPort: null,
    currentValidUntil: null,
    desiredPresence: 'present',
    desiredRevision: '42',
    externalPort: 45_678,
    id: '90071992547409930',
    internalPort: 45_678,
    isDeleted: false,
    keeperDesiredEnabled: false,
    keeperStatus: 'disabled',
    lastObservedAt: null,
    lastObservedIpv4: null,
    lastObservedPort: null,
    name: 'Game UDP',
    protocol: 'udp',
    reportedRevision: '41',
    syncStatus: 'synced',
    targetIpv4: '192.168.31.224',
    updateTime: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('system network persisted list', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    mocks.tableOptions = undefined;
    mocks.accessCodes = new Set([
      'System:Network:Ddns:List',
      'System:Network:PortForward:List',
    ]);
    mocks.ddnsReload.mockResolvedValue(undefined);
    mocks.tableApi.getRows.mockReturnValue([]);
    mocks.tableApi.reload.mockResolvedValue(undefined);
    mocks.api.getAgentStatus.mockResolvedValue({
      agentId: 'nas-main',
      appliedRevision: '41',
      desiredRevision: '42',
      online: false,
      publishedRevision: '42',
      targetIpv4: '192.168.31.224',
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders one Page root and the standard system list route', async () => {
    const wrapper = mount(NetworkList);
    await flushPromises();
    const system = routes.find((route) => route.name === 'System');
    const network = system?.children?.find(
      (route) => route.name === 'SystemNetwork',
    );

    expect(wrapper.findAll('[data-testid="page-root"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="network-table"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ddns-table"]').exists()).toBe(true);
    expect(
      wrapper
        .findAll('[data-testid="network-tabs"] button')
        .map((item) => item.text()),
    ).toEqual(['system.network.portForwardTab', 'system.network.ddnsTab']);
    expect(network).toMatchObject({ path: '/system/network' });
    expect(String(network?.component)).toContain('network/list');
    expect(mocks.tableOptions.columns.map((item: any) => item.key)).toEqual([
      'name',
      'protocol',
      'externalPort',
      'internalTarget',
      'syncStatus',
      'keeper',
      'publicEndpoint',
      'lastObserved',
      'summary',
      'updateTime',
    ]);
  });

  it('keeps the active tab panel in the full-height flex layout', async () => {
    const wrapper = mount(NetworkList);
    await flushPromises();

    const shell = wrapper.get('[data-testid="network-content-shell"]');
    const portForwardPanel = wrapper.get('[data-testid="port-forward-panel"]');
    const ddnsPanel = wrapper.get('[data-testid="ddns-panel"]');

    expect(shell.classes()).toEqual(
      expect.arrayContaining(['flex', 'h-full', 'min-h-0', 'flex-col']),
    );
    expect(portForwardPanel.classes()).toEqual(
      expect.arrayContaining(['min-h-0', 'flex-1']),
    );
    expect(portForwardPanel.classes()).not.toContain('hidden');
    expect(ddnsPanel.classes()).toContain('hidden');

    await wrapper
      .get('[data-testid="network-tabs"] [data-tab="ddns"]')
      .trigger('click');
    await flushPromises();

    expect(portForwardPanel.classes()).toContain('hidden');
    expect(ddnsPanel.classes()).toEqual(
      expect.arrayContaining(['min-h-0', 'flex-1']),
    );
    expect(ddnsPanel.classes()).not.toContain('hidden');
    expect(mocks.ddnsReload).toHaveBeenCalledOnce();
  });

  it('filters tabs by List permission and never requests a forbidden list', async () => {
    mocks.accessCodes = new Set(['System:Network:Ddns:List']);
    const wrapper = mount(NetworkList);
    await flushPromises();

    expect(
      wrapper
        .findAll('[data-testid="network-tabs"] button')
        .map((item) => item.text()),
    ).toEqual(['system.network.ddnsTab']);
    expect(mocks.tableApi.reload).not.toHaveBeenCalled();
    expect(mocks.api.getAgentStatus).not.toHaveBeenCalled();
    expect(mocks.ddnsReload).toHaveBeenCalledOnce();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('routes list labels and status values through the network locale namespace', () => {
    const wrapper = mount(NetworkList);

    expect(mocks.tableOptions.tableTitle).toBe(
      'system.network.portForwardTitle',
    );
    expect(mocks.tableOptions.buttons[0].label).toBe(
      'system.network.createAction',
    );
    expect(
      mocks.tableOptions.columns.map((column: any) => column.title),
    ).toEqual([
      'system.network.name',
      'system.network.protocol',
      'system.network.externalPort',
      'system.network.internalTarget',
      'system.network.syncStatus',
      'system.network.keeperState',
      'system.network.publicEndpoint',
      'system.network.lastObserved',
      'system.network.summary',
      'system.network.updateTime',
    ]);
    expect(
      mocks.tableOptions.rowActions.map((action: any) => action.label),
    ).toEqual([
      'system.network.editAction',
      'system.network.retryAction',
      'system.network.enableKeeperAction',
      'system.network.disableKeeperAction',
      'system.network.probeAction',
      'system.network.copyEndpointAction',
      'system.network.historyAction',
      'system.network.deleteAction',
    ]);
    expect(wrapper.text()).toContain('system.network.syncPending');
    expect(wrapper.text()).toContain('system.network.desiredOn');
    expect(wrapper.text()).toContain('system.network.keeperActive');
  });

  it('keeps unsupported Keeper actions visible-disabled with exact reasons', () => {
    mount(NetworkList);
    const actions = mocks.tableOptions.rowActions;
    const enable = actions.find((item: any) => item.key === 'keeper-enable');
    const probe = actions.find((item: any) => item.key === 'probe');
    const tcp = createRow({ protocol: 'tcp' });
    const splitPort = createRow({ internalPort: 32_000 });
    const disabledKeeper = createRow({ keeperDesiredEnabled: false });

    expect(enable.rowVisible(tcp)).toBe(true);
    expect(enable.disabled(tcp)).toBe(true);
    expect(enable.disabledReason(tcp)).toBe(
      'system.network.tcpKeeperUnsupported',
    );
    expect(probe.disabledReason(splitPort)).toBe(
      'system.network.udpSamePortRequired',
    );
    expect(probe.disabledReason(disabledKeeper)).toBe(
      'system.network.enableKeeperFirst',
    );
  });

  it('does not use Agent offline state to disable valid desired mutations', () => {
    mount(NetworkList);
    const actions = mocks.tableOptions.rowActions;
    const row = createRow({ keeperDesiredEnabled: false });
    const edit = actions.find((item: any) => item.key === 'edit');
    const enable = actions.find((item: any) => item.key === 'keeper-enable');

    expect(edit.disabled(row)).toBe(false);
    expect(enable.disabled(row)).toBe(false);
  });

  it('opens the shared modal from both create and edit table actions', async () => {
    mount(NetworkList);
    await flushPromises();
    const row = createRow();

    await mocks.tableOptions.buttons[0].onClick({});
    await mocks.tableOptions.rowActions
      .find((item: any) => item.key === 'edit')
      .onClick(row, {});

    expect(mocks.modalOpenCreate).toHaveBeenCalledWith('192.168.31.224');
    expect(mocks.modalOpenEdit).toHaveBeenCalledWith(row);
  });

  it('makes deleting rows immutable while preserving retry', () => {
    mount(NetworkList);
    const actions = mocks.tableOptions.rowActions;
    const row = createRow({
      desiredPresence: 'absent',
      syncStatus: 'deleting',
    });

    expect(isDeleting(row)).toBe(true);
    expect(actions.find((item: any) => item.key === 'edit').disabled(row)).toBe(
      true,
    );
    expect(
      actions.find((item: any) => item.key === 'delete').disabled(row),
    ).toBe(true);
    expect(
      actions.find((item: any) => item.key === 'retry').disabled(row),
    ).toBe(false);
  });

  it('copies only the exact API-approved current endpoint', async () => {
    mount(NetworkList);
    const action = mocks.tableOptions.rowActions.find(
      (item: any) => item.key === 'copy-endpoint',
    );
    const row = createRow({
      currentPublicIpv4: '123.45.67.89',
      currentPublicPort: 45_678,
    });

    expect(getCurrentEndpoint(row)).toBe('123.45.67.89:45678');
    expect(action.disabled(row)).toBe(false);
    await action.onClick(row);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      '123.45.67.89:45678',
    );
  });

  it('refreshes only for subscribed topic events and closes the stream on unmount', async () => {
    let finishReload: (() => void) | undefined;
    mocks.tableApi.reload.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishReload = resolve;
        }),
    );
    const wrapper = mount(NetworkList);
    await flushPromises();
    expect(mocks.tableApi.reload).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.tableApi.reload).toHaveBeenCalledTimes(1);
    finishReload?.();
    await flushPromises();
    expect(vi.getTimerCount()).toBe(0);

    FakeEventSource.instances[0]?.dispatch('heartbeat', {
      observedAt: '2026-07-23T00:00:00.000Z',
    });
    await flushPromises();
    expect(mocks.tableApi.reload).toHaveBeenCalledTimes(1);

    FakeEventSource.instances[0]?.dispatch('network-state-changed', {
      eventId: 'network-ddns-event-while-port-forward-active',
      observedAt: '2026-07-23T00:00:00.500Z',
      source: 'ddns',
    });
    await flushPromises();
    expect(mocks.tableApi.reload).toHaveBeenCalledTimes(1);
    expect(mocks.ddnsReload).not.toHaveBeenCalled();

    FakeEventSource.instances[0]?.dispatch('network-state-changed', {
      eventId: 'network-event-1',
      observedAt: '2026-07-23T00:00:01.000Z',
      source: 'reported',
    });
    await flushPromises();
    expect(mocks.tableApi.reload).toHaveBeenCalledTimes(2);

    finishReload?.();
    await flushPromises();
    wrapper.unmount();
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
    FakeEventSource.instances[0]?.dispatch('network-state-changed', {
      eventId: 'network-event-2',
      observedAt: '2026-07-23T00:00:02.000Z',
      source: 'status',
    });
    await flushPromises();
    expect(mocks.tableApi.reload).toHaveBeenCalledTimes(2);
  });

  it('routes DDNS and replay-gap events to one active table without polling', async () => {
    const wrapper = mount(NetworkList);
    await flushPromises();
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.ddnsReload).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);

    await wrapper
      .find('[data-testid="network-tabs"] [data-tab="ddns"]')
      .trigger('click');
    await flushPromises();
    expect(mocks.ddnsReload).toHaveBeenCalledOnce();

    FakeEventSource.instances[0]?.dispatch('network-state-changed', {
      eventId: 'network-reported-event-while-ddns-active',
      observedAt: '2026-07-23T00:00:00.500Z',
      source: 'reported',
    });
    await flushPromises();
    expect(mocks.ddnsReload).toHaveBeenCalledOnce();
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();

    FakeEventSource.instances[0]?.dispatch('network-state-changed', {
      eventId: 'network-ddns-event-1',
      observedAt: '2026-07-23T00:00:01.000Z',
      source: 'ddns',
    });
    await flushPromises();
    expect(mocks.ddnsReload).toHaveBeenCalledTimes(2);
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();

    FakeEventSource.instances[0]?.dispatch('network-state-changed', {
      eventId: 'network-ddns-event-1',
      observedAt: '2026-07-23T00:00:01.000Z',
      source: 'ddns',
    });
    FakeEventSource.instances[0]?.dispatch('heartbeat', {
      observedAt: '2026-07-23T00:00:02.000Z',
    });
    await flushPromises();
    expect(mocks.ddnsReload).toHaveBeenCalledTimes(2);

    FakeEventSource.instances[0]?.dispatch('snapshot-required', {
      observedAt: '2026-07-23T00:00:03.000Z',
    });
    await flushPromises();
    expect(mocks.ddnsReload).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.ddnsReload).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('network action constraints', () => {
  it('keeps Snowflake IDs and revisions as strings in row fixtures', () => {
    const row = createRow();
    expect(typeof row.id).toBe('string');
    expect(typeof row.desiredRevision).toBe('string');
    expect(getKeeperDisabledReason(row, false)).toBeUndefined();
  });
});
