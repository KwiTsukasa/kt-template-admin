/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { SystemNetworkApi } from '#/api/system/network';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import NetworkList, {
  getChannelEndpoint,
  getChannelMutationDisabledReason,
  isGroupDeleting,
  isGroupRemovable,
} from '@test-source/apps/web-antdv-next/src/views/system/network/list';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import routes from '#/router/routes/modules/system';

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
    deleteGroup: vi.fn(),
    disableKeeper: vi.fn(),
    disableNatmap: vi.fn(),
    disableUdpNatmap: vi.fn(),
    enableKeeper: vi.fn(),
    enableNatmap: vi.fn(),
    enableUdpNatmap: vi.fn(),
    getAgentStatus: vi.fn(),
    getGroupList: vi.fn(),
    probeKeeper: vi.fn(),
    retryChannel: vi.fn(),
  },
  bodyCell: undefined as any,
  ddnsReload: vi.fn(),
  historyOpen: vi.fn(),
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

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    name: 'MockKtTable',
    setup(_, { slots }) {
      mocks.bodyCell = slots.bodyCell;
      return () =>
        h('section', { 'data-testid': 'network-table' }, [
          slots.headerControls?.(),
          slots.bodyCell?.({
            column: { key: 'tcpStatic' },
            record: createGroup({
              channels: { tcp: null, udp: createChannel('udp') },
            }),
          }),
          slots.bodyCell?.({
            column: { key: 'udpKeeper' },
            record: createGroup(),
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
  '@test-source/apps/web-antdv-next/src/views/system/network/components/NetworkPortForwardModal',
  () => ({
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
  }),
);

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/system/network/components/NetworkDdnsTable',
  () => ({
    default: defineComponent({
      name: 'MockNetworkDdnsTable',
      setup(_, { expose }) {
        expose({ reload: mocks.ddnsReload });
        return () => h('section', { 'data-testid': 'ddns-table' });
      },
    }),
  }),
);

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/system/network/components/NetworkEndpointHistoryDrawer',
  () => ({
    default: defineComponent({
      name: 'MockNetworkEndpointHistoryDrawer',
      setup(_, { expose }) {
        expose({ open: mocks.historyOpen });
        return () => h('div');
      },
    }),
  }),
);

vi.mock('#/api/system/network', () => ({
  deleteNetworkPortForwardGroup: mocks.api.deleteGroup,
  disableNetworkTcpNatmap: mocks.api.disableNatmap,
  disableNetworkUdpKeeper: mocks.api.disableKeeper,
  disableNetworkUdpNatmap: mocks.api.disableUdpNatmap,
  enableNetworkTcpNatmap: mocks.api.enableNatmap,
  enableNetworkUdpKeeper: mocks.api.enableKeeper,
  enableNetworkUdpNatmap: mocks.api.enableUdpNatmap,
  getNetworkAgentStatus: mocks.api.getAgentStatus,
  getNetworkManagementEventsUrl: vi.fn(
    () => '/api/system/network/events/stream',
  ),
  getNetworkPortForwardGroupList: mocks.api.getGroupList,
  probeNetworkUdpKeeper: mocks.api.probeKeeper,
  retryNetworkPortForwardChannel: mocks.api.retryChannel,
}));

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

function createChannel(
  protocol: SystemNetworkApi.Protocol,
  overrides: Partial<SystemNetworkApi.PortForwardChannel> = {},
): SystemNetworkApi.PortForwardChannel {
  return {
    currentObservedAt: null,
    currentPublicEndpoint: null,
    currentPublicIpv4: null,
    currentPublicPort: null,
    currentValidUntil: null,
    desiredPresence: 'present',
    desiredRevision: '42',
    externalPort: 45_678,
    groupId: 'group-1',
    id: protocol === 'tcp' ? 'channel-tcp' : 'channel-udp',
    internalPort: 45_678,
    isDeleted: false,
    keeperDesiredEnabled: false,
    keeperStatus: 'disabled',
    lastObservedAt: null,
    lastObservedIpv4: null,
    lastObservedPort: null,
    name: 'Game',
    natmapDesiredEnabled: false,
    natmapStatus: 'disabled',
    protocol,
    reportedRevision: '42',
    syncStatus: 'synced',
    targetIpv4: '192.168.31.224',
    ...overrides,
  };
}

function createGroup(
  overrides: Partial<SystemNetworkApi.PortForwardGroup> = {},
): SystemNetworkApi.PortForwardGroup {
  return {
    appliedProtocolMode: 'tcp_udp',
    channels: {
      tcp: createChannel('tcp'),
      udp: createChannel('udp', {
        currentPublicEndpoint: '123.45.67.89:45678',
        currentPublicIpv4: '123.45.67.89',
        currentPublicPort: 45_678,
        keeperDesiredEnabled: true,
        keeperStatus: 'active',
      }),
    },
    externalPort: 45_678,
    id: 'group-1',
    internalPort: 45_678,
    isDeleted: false,
    name: 'Game',
    protocolMode: 'tcp_udp',
    remark: null,
    targetIpv4: '192.168.31.224',
    updateTime: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

function getRenderedCellText(value: unknown): string {
  const nodes = Array.isArray(value) ? value : [value];
  return nodes
    .map((node) => {
      if (typeof node === 'string') return node;
      if (node && typeof node === 'object' && 'children' in node) {
        return String((node as { children?: unknown }).children ?? '');
      }
      return String(node ?? '');
    })
    .join('');
}

describe('system network group list', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    mocks.bodyCell = undefined;
    mocks.tableOptions = undefined;
    mocks.accessCodes = new Set([
      'System:Network:Ddns:List',
      'System:Network:PortForward:List',
    ]);
    mocks.ddnsReload.mockResolvedValue(undefined);
    mocks.tableApi.getRows.mockReturnValue([]);
    mocks.tableApi.reload.mockResolvedValue(undefined);
    for (const mutation of [
      mocks.api.deleteGroup,
      mocks.api.disableKeeper,
      mocks.api.disableNatmap,
      mocks.api.enableKeeper,
      mocks.api.enableNatmap,
      mocks.api.probeKeeper,
      mocks.api.retryChannel,
    ]) {
      mutation.mockResolvedValue({});
    }
    mocks.api.getAgentStatus.mockResolvedValue({
      agentId: 'nas-main',
      appliedRevision: '41',
      desiredRevision: '42',
      online: true,
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

  it('renders one group row contract with separate TCP and UDP columns', async () => {
    const wrapper = mount(NetworkList);
    await flushPromises();
    const system = routes.find((route) => route.name === 'System');
    const network = system?.children?.find(
      (route) => route.name === 'SystemNetwork',
    );

    expect(wrapper.findAll('[data-testid="page-root"]')).toHaveLength(1);
    expect(network).toMatchObject({ path: '/system/network' });
    expect(mocks.tableOptions.api.list).toBeTypeOf('function');
    await mocks.tableOptions.api.list({ pageNo: 1, pageSize: 20 });
    expect(mocks.api.getGroupList).toHaveBeenCalledWith({
      pageNo: 1,
      pageSize: 20,
    });
    expect(mocks.tableOptions.columns.map((item: any) => item.key)).toEqual([
      'name',
      'protocolMode',
      'externalPort',
      'internalTarget',
      'tcpStatic',
      'tcpNatmap',
      'tcpEndpoint',
      'udpStatic',
      'udpKeeper',
      'udpEndpoint',
      'summary',
      'updateTime',
    ]);
  });

  it('renders a missing protocol channel as an em dash instead of fake disabled state', () => {
    mount(NetworkList);
    const udpOnly = createGroup({
      appliedProtocolMode: 'udp',
      channels: { tcp: null, udp: createChannel('udp') },
      protocolMode: 'udp',
    });

    expect(
      getRenderedCellText(
        mocks.bodyCell({ column: { key: 'tcpStatic' }, record: udpOnly }),
      ),
    ).toBe('—');
    expect(
      getRenderedCellText(
        mocks.bodyCell({ column: { key: 'tcpNatmap' }, record: udpOnly }),
      ),
    ).toBe('—');
    expect(
      getRenderedCellText(
        mocks.bodyCell({ column: { key: 'tcpEndpoint' }, record: udpOnly }),
      ),
    ).toBe('—');
  });

  it('uses the global two-visible-action folding rule and channel-scoped actions', () => {
    mount(NetworkList);
    const actions = mocks.tableOptions.rowActions;
    const tcpOnly = createGroup({
      appliedProtocolMode: 'tcp',
      channels: { tcp: createChannel('tcp'), udp: null },
      protocolMode: 'tcp',
    });
    const udpOnly = createGroup({
      appliedProtocolMode: 'udp',
      channels: { tcp: null, udp: createChannel('udp') },
      protocolMode: 'udp',
    });

    expect(mocks.tableOptions.rowActionVisibleCount).toBe(2);
    expect(actions.map((action: any) => action.key)).toEqual([
      'edit',
      'delete',
      'tcp-retry',
      'tcp-natmap-enable',
      'tcp-natmap-disable',
      'tcp-copy-endpoint',
      'tcp-history',
      'udp-retry',
      'udp-natmap-enable',
      'udp-natmap-disable',
      'udp-keeper-enable',
      'udp-keeper-disable',
      'udp-probe',
      'udp-copy-endpoint',
      'udp-history',
    ]);
    expect(
      actions
        .find((action: any) => action.key === 'tcp-retry')
        .rowVisible(tcpOnly),
    ).toBe(false);
    expect(
      actions
        .find((action: any) => action.key === 'udp-retry')
        .rowVisible(tcpOnly),
    ).toBe(false);
    expect(
      actions
        .find((action: any) => action.key === 'tcp-natmap-enable')
        .rowVisible(udpOnly),
    ).toBe(false);
    expect(
      actions
        .find((action: any) => action.key === 'udp-keeper-enable')
        .rowVisible(udpOnly),
    ).toBe(true);
    const tcpMechanismFailed = createGroup({
      channels: {
        tcp: createChannel('tcp', { natmapStatus: 'failed' }),
        udp: null,
      },
      protocolMode: 'tcp',
    });
    expect(
      actions
        .find((action: any) => action.key === 'tcp-retry')
        .rowVisible(tcpMechanismFailed),
    ).toBe(true);
    expect(
      actions.every(
        (action: any) =>
          action.rowVisible !== undefined && action.disabled === undefined,
      ),
    ).toBe(true);
  });

  it('shows delete as a direct action only for fully stopped synced groups', async () => {
    mount(NetworkList);
    await flushPromises();
    mocks.tableApi.reload.mockClear();
    const deleteAction = mocks.tableOptions.rowActions.find(
      (action: any) => action.key === 'delete',
    );
    const removable = createGroup({
      channels: {
        tcp: createChannel('tcp'),
        udp: createChannel('udp'),
      },
    });
    const active = createGroup();
    const unsynced = createGroup({
      channels: {
        tcp: createChannel('tcp', {
          desiredRevision: '43',
          reportedRevision: '42',
        }),
        udp: null,
      },
      protocolMode: 'tcp',
    });

    expect(mocks.tableOptions.rowActions[1].key).toBe('delete');
    expect(isGroupRemovable(removable)).toBe(true);
    expect(deleteAction.rowVisible(removable)).toBe(true);
    expect(isGroupRemovable(active)).toBe(false);
    expect(deleteAction.rowVisible(active)).toBe(false);
    expect(isGroupRemovable(unsynced)).toBe(false);
    expect(deleteAction.rowVisible(unsynced)).toBe(false);

    await deleteAction.onClick(removable);

    expect(mocks.api.deleteGroup).toHaveBeenCalledWith('group-1');
    expect(mocks.messageSuccess).toHaveBeenCalledWith(
      'system.network.deleteSubmitted',
    );
    expect(mocks.tableApi.reload).toHaveBeenCalled();
  });

  it('routes TCP NATMap and UDP Keeper mutations independently by group ID', async () => {
    mount(NetworkList);
    const actions = mocks.tableOptions.rowActions;
    const row = createGroup({
      channels: {
        tcp: createChannel('tcp', { natmapDesiredEnabled: false }),
        udp: createChannel('udp', { keeperDesiredEnabled: false }),
      },
    });

    await actions
      .find((action: any) => action.key === 'tcp-natmap-enable')
      .onClick(row);
    await actions
      .find((action: any) => action.key === 'udp-keeper-enable')
      .onClick(row);
    await actions
      .find((action: any) => action.key === 'tcp-retry')
      .onClick(row);
    await actions
      .find((action: any) => action.key === 'udp-retry')
      .onClick(row);

    expect(mocks.api.enableNatmap).toHaveBeenCalledWith('group-1');
    expect(mocks.api.enableKeeper).toHaveBeenCalledWith('group-1');
    expect(mocks.api.retryChannel).toHaveBeenNthCalledWith(1, 'group-1', 'tcp');
    expect(mocks.api.retryChannel).toHaveBeenNthCalledWith(2, 'group-1', 'udp');
  });

  it('shows and routes UDP NATMap only for the fixed WireGuard port pair', async () => {
    mount(NetworkList);
    const actions = mocks.tableOptions.rowActions;
    const row = createGroup({
      externalPort: 51_825,
      internalPort: 51_820,
      targetIpv4: '192.168.31.81',
      channels: {
        tcp: null,
        udp: createChannel('udp', {
          externalPort: 51_825,
          internalPort: 51_820,
          natmapDesiredEnabled: false,
          targetIpv4: '192.168.31.81',
        }),
      },
      protocolMode: 'udp',
    });
    const enable = actions.find(
      (action: any) => action.key === 'udp-natmap-enable',
    );
    expect(enable.rowVisible(row)).toBe(true);
    expect(
      actions
        .find((action: any) => action.key === 'udp-keeper-enable')
        .rowVisible(row),
    ).toBe(false);
    await enable.onClick(row);
    expect(mocks.api.enableUdpNatmap).toHaveBeenCalledWith('group-1');
  });

  it('opens protocol-scoped history and copies only the selected channel endpoint', async () => {
    mount(NetworkList);
    const actions = mocks.tableOptions.rowActions;
    const row = createGroup({
      channels: {
        tcp: createChannel('tcp', {
          currentPublicEndpoint: '8.8.8.8:45101',
          currentPublicIpv4: '8.8.8.8',
          currentPublicPort: 45_101,
          natmapDesiredEnabled: true,
          natmapStatus: 'active',
        }),
        udp: createChannel('udp'),
      },
    });

    await actions
      .find((action: any) => action.key === 'tcp-history')
      .onClick(row);
    await actions
      .find((action: any) => action.key === 'udp-history')
      .onClick(row);
    await actions
      .find((action: any) => action.key === 'tcp-copy-endpoint')
      .onClick(row);

    expect(mocks.historyOpen).toHaveBeenNthCalledWith(1, row, 'tcp');
    expect(mocks.historyOpen).toHaveBeenNthCalledWith(2, row, 'udp');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('8.8.8.8:45101');
    expect(getChannelEndpoint(row.channels.tcp)).toBe('8.8.8.8:45101');
  });

  it('hides all row mutations while one group operation is in flight', async () => {
    let resolveMutation: (() => void) | undefined;
    mocks.api.enableNatmap.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveMutation = resolve;
        }),
    );
    mount(NetworkList);
    const actions = mocks.tableOptions.rowActions;
    const row = createGroup({
      channels: {
        tcp: createChannel('tcp'),
        udp: createChannel('udp'),
      },
    });
    const natmapEnable = actions.find(
      (action: any) => action.key === 'tcp-natmap-enable',
    );
    const keeperEnable = actions.find(
      (action: any) => action.key === 'udp-keeper-enable',
    );

    const pending = natmapEnable.onClick(row);
    await flushPromises();
    expect(natmapEnable.rowVisible(row)).toBe(false);
    expect(keeperEnable.rowVisible(row)).toBe(false);
    resolveMutation?.();
    await pending;
  });

  it('keeps deleting groups immutable and reports protocol-specific reasons', () => {
    mount(NetworkList);
    const row = createGroup({
      channels: {
        tcp: createChannel('tcp', {
          desiredPresence: 'absent',
          syncStatus: 'deleting',
        }),
        udp: createChannel('udp'),
      },
    });

    expect(isGroupDeleting(row)).toBe(true);
    expect(getChannelMutationDisabledReason(row, 'tcp')).toBe(
      'system.network.deletingImmutable',
    );
    expect(getChannelMutationDisabledReason(row, 'udp')).toBe(
      'system.network.deletingImmutable',
    );
  });

  it('opens the shared modal with a read-only target from Agent or existing groups', async () => {
    mount(NetworkList);
    await flushPromises();
    const row = createGroup();

    await mocks.tableOptions.buttons[0].onClick({});
    await mocks.tableOptions.rowActions
      .find((item: any) => item.key === 'edit')
      .onClick(row, {});

    expect(mocks.modalOpenCreate).toHaveBeenCalledWith('192.168.31.224');
    expect(mocks.modalOpenEdit).toHaveBeenCalledWith(row);
  });

  it('filters tabs by list permission and never requests a forbidden group list', async () => {
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

  it('uses one SSE, refreshes only the semantically related active tab and never polls', async () => {
    const wrapper = mount(NetworkList);
    await flushPromises();

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.tableApi.reload).toHaveBeenCalledOnce();
    expect(mocks.ddnsReload).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    FakeEventSource.instances[0]?.dispatch('network-state-changed', {
      eventId: 'lease-semantic-change',
      observedAt: '2026-07-27T00:00:00.000Z',
      source: 'reported',
    });
    await flushPromises();
    expect(mocks.tableApi.reload).toHaveBeenCalledTimes(2);

    FakeEventSource.instances[0]?.dispatch('network-state-changed', {
      eventId: 'ddns-hidden',
      observedAt: '2026-07-27T00:00:01.000Z',
      source: 'ddns',
    });
    await flushPromises();
    expect(mocks.ddnsReload).not.toHaveBeenCalled();

    await wrapper
      .get('[data-testid="network-tabs"] [data-tab="ddns"]')
      .trigger('click');
    await flushPromises();
    expect(mocks.ddnsReload).toHaveBeenCalledOnce();

    FakeEventSource.instances[0]?.dispatch('network-state-changed', {
      eventId: 'port-forward-hidden',
      observedAt: '2026-07-27T00:00:02.000Z',
      source: 'events',
    });
    FakeEventSource.instances[0]?.dispatch('network-state-changed', {
      eventId: 'ddns-visible',
      observedAt: '2026-07-27T00:00:03.000Z',
      source: 'ddns',
    });
    await flushPromises();
    expect(mocks.tableApi.reload).toHaveBeenCalledTimes(2);
    expect(mocks.ddnsReload).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });
});
