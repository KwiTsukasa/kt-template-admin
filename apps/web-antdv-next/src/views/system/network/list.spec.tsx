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

  /** Registers one typed SSE listener for the page test. */
  addEventListener(type: string, listener: FakeEventSourceListener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  /** Closes this fake stream and prevents later dispatches. */
  close() {
    this.closed = true;
  }

  /** Dispatches one JSON SSE payload to currently registered listeners. */
  dispatch(type: string, data: Record<string, unknown>) {
    if (this.closed) return;
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  /** Removes one typed SSE listener from the page test. */
  removeEventListener(type: string, listener: FakeEventSourceListener) {
    this.listeners.get(type)?.delete(listener);
  }
}

const mocks = vi.hoisted(() => ({
  api: {
    deleteMapping: vi.fn(),
    disableKeeper: vi.fn(),
    enableKeeper: vi.fn(),
    getAgentStatus: vi.fn(),
    getList: vi.fn(),
    probe: vi.fn(),
    retry: vi.fn(),
  },
  messageSuccess: vi.fn(),
  modalOpenCreate: vi.fn(),
  modalOpenEdit: vi.fn(),
  tableApi: {
    getRows: vi.fn(() => []),
    reload: vi.fn(),
  },
  tableOptions: undefined as any,
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

/** Creates a complete UDP row fixture with string revisions. */
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
});

describe('network action constraints', () => {
  it('keeps Snowflake IDs and revisions as strings in row fixtures', () => {
    const row = createRow();
    expect(typeof row.id).toBe('string');
    expect(typeof row.desiredRevision).toBe('string');
    expect(getKeeperDisabledReason(row, false)).toBeUndefined();
  });
});
