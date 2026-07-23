import type { TableColumnType } from 'antdv-next';

import type { NetworkDdnsTableExposed } from './components/NetworkDdnsTable';
import type { NetworkEndpointHistoryDrawerExposed } from './components/NetworkEndpointHistoryDrawer';
import type { NetworkPortForwardModalExposed } from './components/NetworkPortForwardModal';

import type { SystemNetworkApi } from '#/api/system/network';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import {
  defineComponent,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
} from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Space, Tabs, Tag, Typography } from 'antdv-next';

import {
  deleteNetworkPortForward,
  disableNetworkPortForwardKeeper,
  enableNetworkPortForwardKeeper,
  getNetworkAgentStatus,
  getNetworkPortForwardList,
  probeNetworkPortForward,
  retryNetworkPortForward,
} from '#/api/system/network';
import { KtTable, useKtTable } from '#/components/ktTable';
import { $t } from '#/locales';

import NetworkDdnsTable from './components/NetworkDdnsTable';
import NetworkEndpointHistoryDrawer from './components/NetworkEndpointHistoryDrawer';
import NetworkPortForwardModal from './components/NetworkPortForwardModal';
import { useNetworkManagementStream } from './composables/useNetworkManagementStream';

const AKtTable = KtTable as any;
const ATabs = Tabs as any;
const ATypographyText = Typography.Text as any;
type NetworkTabKey = 'ddns' | 'port-forward';
const protocolOptions = [
  { label: 'TCP', value: 'tcp' },
  { label: 'UDP', value: 'udp' },
];
const syncStatusOptions = [
  { label: $t('system.network.syncPending'), value: 'pending' },
  { label: $t('system.network.syncSyncing'), value: 'syncing' },
  { label: $t('system.network.syncSynced'), value: 'synced' },
  { label: $t('system.network.syncConflict'), value: 'conflict' },
  { label: $t('system.network.syncFailed'), value: 'failed' },
  { label: $t('system.network.syncDeleting'), value: 'deleting' },
];
const syncStatusColors: Record<SystemNetworkApi.SyncStatus, string> = {
  conflict: 'warning',
  deleting: 'default',
  failed: 'error',
  pending: 'processing',
  synced: 'success',
  syncing: 'processing',
};
const keeperStatusColors: Record<SystemNetworkApi.KeeperStatus, string> = {
  active: 'success',
  disabled: 'default',
  failed: 'error',
  stale: 'warning',
  starting: 'processing',
};
const syncStatusLabels: Record<SystemNetworkApi.SyncStatus, string> = {
  conflict: $t('system.network.syncConflict'),
  deleting: $t('system.network.syncDeleting'),
  failed: $t('system.network.syncFailed'),
  pending: $t('system.network.syncPending'),
  synced: $t('system.network.syncSynced'),
  syncing: $t('system.network.syncSyncing'),
};
const keeperStatusLabels: Record<SystemNetworkApi.KeeperStatus, string> = {
  active: $t('system.network.keeperActive'),
  disabled: $t('system.network.keeperDisabled'),
  failed: $t('system.network.keeperFailed'),
  stale: $t('system.network.keeperStale'),
  starting: $t('system.network.keeperStarting'),
};

export default defineComponent({
  name: 'SystemNetworkList',
  /**
   * Builds the generic persisted network-resource table and event-driven refresh stream.
   */
  setup() {
    const { hasAccessByCodes } = useAccess();
    const canViewPortForward = hasAccessByCodes([
      'System:Network:PortForward:List',
    ]);
    const canViewDdns = hasAccessByCodes(['System:Network:Ddns:List']);
    const tabItems = [
      ...(canViewPortForward
        ? [
            {
              key: 'port-forward' as const,
              label: $t('system.network.portForwardTab'),
            },
          ]
        : []),
      ...(canViewDdns
        ? [
            {
              key: 'ddns' as const,
              label: $t('system.network.ddnsTab'),
            },
          ]
        : []),
    ];
    const activeTab = ref<NetworkTabKey>(tabItems[0]?.key || 'port-forward');
    const agentStatus = ref<SystemNetworkApi.AgentStatus>();
    const agentStatusUnknown = ref(true);
    const busyRowIds = ref<Set<string>>(new Set());
    const ddnsTableRef = ref<NetworkDdnsTableExposed>();
    const modalRef = ref<NetworkPortForwardModalExposed>();
    const historyDrawerRef = ref<NetworkEndpointHistoryDrawerExposed>();
    let pageActive = false;
    let refreshInFlight: Promise<void> | undefined;
    const queuedRefreshes = new Set<NetworkTabKey>();
    const managementStream = useNetworkManagementStream({
      onSnapshotRequired: handleSnapshotRequired,
      onStateChanged: handleStateChanged,
    });

    const columns: Array<TableColumnType<SystemNetworkApi.PortForward>> = [
      {
        dataIndex: 'name',
        key: 'name',
        title: $t('system.network.name'),
        width: 150,
      },
      {
        dataIndex: 'protocol',
        key: 'protocol',
        title: $t('system.network.protocol'),
        width: 80,
      },
      {
        dataIndex: 'externalPort',
        key: 'externalPort',
        title: $t('system.network.externalPort'),
        width: 100,
      },
      {
        key: 'internalTarget',
        title: $t('system.network.internalTarget'),
        width: 190,
      },
      {
        dataIndex: 'syncStatus',
        key: 'syncStatus',
        title: $t('system.network.syncStatus'),
        width: 105,
      },
      {
        key: 'keeper',
        title: $t('system.network.keeperState'),
        width: 190,
      },
      {
        key: 'publicEndpoint',
        title: $t('system.network.publicEndpoint'),
        width: 185,
      },
      {
        key: 'lastObserved',
        title: $t('system.network.lastObserved'),
        width: 210,
      },
      {
        key: 'summary',
        title: $t('system.network.summary'),
        width: 240,
      },
      {
        dataIndex: 'updateTime',
        key: 'updateTime',
        title: $t('system.network.updateTime'),
        width: 180,
      },
    ];
    const api: KtTableApi<SystemNetworkApi.PortForward> = {
      /** Loads the latest API fact-source page for KtTable. */
      list: async (params) => await getNetworkPortForwardList(params),
    };
    const buttons: Array<KtTableButton<SystemNetworkApi.PortForward>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: $t('system.network.createAction'),
        onClick: openCreate,
        permissionCodes: ['System:Network:PortForward:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<KtTableRowAction<SystemNetworkApi.PortForward>> = [
      {
        disabled: (row) => isRowBusy(row) || isDeleting(row),
        disabledReason: (row) =>
          isRowBusy(row)
            ? $t('system.network.operationInProgress')
            : getWriteDisabledReason(row),
        key: 'edit',
        label: $t('system.network.editAction'),
        onClick: openEdit,
        permissionCodes: ['System:Network:PortForward:Update'],
      },
      {
        disabled: (row) =>
          isRowBusy(row) ||
          !['conflict', 'deleting', 'failed'].includes(row.syncStatus),
        disabledReason: (row) =>
          isRowBusy(row)
            ? $t('system.network.operationInProgress')
            : $t('system.network.retryNotRequired'),
        key: 'retry',
        label: $t('system.network.retryAction'),
        onClick: async (row) => {
          await runRowMutation(
            row,
            retryNetworkPortForward,
            $t('system.network.retrySubmitted'),
          );
        },
        permissionCodes: ['System:Network:PortForward:Retry'],
      },
      {
        disabled: (row) =>
          isRowBusy(row) || !!getKeeperDisabledReason(row, false),
        disabledReason: (row) =>
          isRowBusy(row)
            ? $t('system.network.operationInProgress')
            : getKeeperDisabledReason(row, false),
        key: 'keeper-enable',
        label: $t('system.network.enableKeeperAction'),
        onClick: async (row) => {
          await runRowMutation(
            row,
            enableNetworkPortForwardKeeper,
            $t('system.network.keeperEnableSubmitted'),
          );
        },
        permissionCodes: ['System:Network:PortForward:Keeper'],
        rowVisible: (row) => !row.keeperDesiredEnabled,
      },
      {
        disabled: (row) => isRowBusy(row) || isDeleting(row),
        disabledReason: (row) =>
          isRowBusy(row)
            ? $t('system.network.operationInProgress')
            : getWriteDisabledReason(row),
        key: 'keeper-disable',
        label: $t('system.network.disableKeeperAction'),
        onClick: async (row) => {
          await runRowMutation(
            row,
            disableNetworkPortForwardKeeper,
            $t('system.network.keeperDisableSubmitted'),
          );
        },
        permissionCodes: ['System:Network:PortForward:Keeper'],
        rowVisible: (row) => row.keeperDesiredEnabled,
      },
      {
        disabled: (row) =>
          isRowBusy(row) || !!getKeeperDisabledReason(row, true),
        disabledReason: (row) =>
          isRowBusy(row)
            ? $t('system.network.operationInProgress')
            : getKeeperDisabledReason(row, true),
        key: 'probe',
        label: $t('system.network.probeAction'),
        onClick: async (row) => {
          await runRowMutation(
            row,
            probeNetworkPortForward,
            $t('system.network.probeSubmitted'),
          );
        },
        permissionCodes: ['System:Network:PortForward:Probe'],
      },
      {
        disabled: (row) => !getCurrentEndpoint(row),
        disabledReason: $t('system.network.noCurrentEndpoint'),
        key: 'copy-endpoint',
        label: $t('system.network.copyEndpointAction'),
        onClick: copyEndpoint,
        permissionCodes: ['System:Network:PortForward:List'],
      },
      {
        key: 'history',
        label: $t('system.network.historyAction'),
        onClick: openHistory,
        permissionCodes: ['System:Network:PortForward:History'],
      },
      {
        confirm: (row) => $t('system.network.deleteConfirm', [row.name]),
        danger: true,
        disabled: (row) => isRowBusy(row) || isDeleting(row),
        disabledReason: (row) =>
          isRowBusy(row)
            ? $t('system.network.operationInProgress')
            : getWriteDisabledReason(row),
        key: 'delete',
        label: $t('system.network.deleteAction'),
        onClick: async (row) => {
          await runRowMutation(
            row,
            deleteNetworkPortForward,
            $t('system.network.deleteSubmitted'),
          );
        },
        permissionCodes: ['System:Network:PortForward:Delete'],
      },
    ];
    const [registerTable, tableApi] = useKtTable<SystemNetworkApi.PortForward>({
      api,
      buttons,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: { allowClear: true },
            fieldName: 'name',
            label: $t('system.network.name'),
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: protocolOptions,
            },
            fieldName: 'protocol',
            label: $t('system.network.protocol'),
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: syncStatusOptions,
            },
            fieldName: 'syncStatus',
            label: $t('system.network.syncStatus'),
          },
        ],
      },
      immediate: false,
      rowActions,
      rowActionVisibleCount: 2,
      rowKey: 'id',
      tableTitle: $t('system.network.portForwardTitle'),
    });

    /** Opens the create modal using the server-reported fixed target address. */
    function openCreate() {
      const rowTarget = tableApi.getRows()[0]?.targetIpv4 || '';
      void modalRef.value?.openCreate(
        agentStatus.value?.targetIpv4 || rowTarget,
      );
    }

    /** Opens one mutable row in the shared CRUD modal. */
    function openEdit(row: SystemNetworkApi.PortForward) {
      if (!isRowBusy(row) && !isDeleting(row)) {
        void modalRef.value?.openEdit(row);
      }
    }

    /** Opens the append-only endpoint history drawer for one row. */
    function openHistory(row: SystemNetworkApi.PortForward) {
      historyDrawerRef.value?.open(row);
    }

    /** Reloads after a modal save while preserving serialized request order. */
    function handleModalSaved() {
      void requestRefresh('port-forward');
    }

    /** Copies an API-approved current endpoint without logging it. */
    async function copyEndpoint(row: SystemNetworkApi.PortForward) {
      const endpoint = getCurrentEndpoint(row);
      if (!endpoint) return;
      await navigator.clipboard.writeText(endpoint);
      message.success($t('system.network.endpointCopied'));
    }

    /**
     * Runs one row mutation with per-row duplicate suppression and fact-source reload.
     * @param row - Selected persisted mapping.
     * @param mutation - API operation accepting the stable record ID.
     * @param successMessage - Accurate asynchronous-success wording.
     */
    async function runRowMutation(
      row: SystemNetworkApi.PortForward,
      mutation: (id: string) => Promise<unknown>,
      successMessage: string,
    ) {
      if (isRowBusy(row)) return;
      setRowBusy(row.id, true);
      try {
        await mutation(row.id);
        message.success(successMessage);
        await requestRefresh();
      } finally {
        setRowBusy(row.id, false);
      }
    }

    /** Updates the reactive per-row in-flight set without mutating it in place. */
    function setRowBusy(id: string, busy: boolean) {
      const next = new Set(busyRowIds.value);
      if (busy) next.add(id);
      else next.delete(id);
      busyRowIds.value = next;
    }

    /** Returns whether one row already owns an in-flight write request. */
    function isRowBusy(row: SystemNetworkApi.PortForward): boolean {
      return busyRowIds.value.has(row.id);
    }

    /** Loads Agent connectivity without translating refresh failure into offline. */
    async function loadAgentStatus() {
      try {
        agentStatus.value = await getNetworkAgentStatus();
        agentStatusUnknown.value = false;
      } catch {
        agentStatusUnknown.value = true;
      }
    }

    /**
     * Serializes table and Agent refreshes so stale responses cannot overtake writes.
     */
    async function requestRefresh(
      resource: NetworkTabKey = activeTab.value,
    ): Promise<void> {
      if (!canViewResource(resource)) return;
      if (refreshInFlight) {
        queuedRefreshes.add(resource);
        await refreshInFlight;
        return;
      }

      refreshInFlight = performResourceRefresh(resource);
      try {
        await refreshInFlight;
      } finally {
        refreshInFlight = undefined;
      }
      const nextResource = queuedRefreshes.values().next().value as
        | NetworkTabKey
        | undefined;
      if (nextResource) {
        queuedRefreshes.delete(nextResource);
        await requestRefresh(nextResource);
      }
    }

    /**
     * Loads exactly one permission-approved resource without cross-tab requests.
     * @param resource - Active or locally-mutated network resource.
     */
    async function performResourceRefresh(resource: NetworkTabKey) {
      if (resource === 'ddns') {
        await ddnsTableRef.value?.reload();
        return;
      }
      await Promise.allSettled([tableApi.reload(), loadAgentStatus()]);
    }

    /**
     * Checks list permission before any resource request.
     * @param resource - Candidate tab resource.
     * @returns True when its List permission is present.
     */
    function canViewResource(resource: NetworkTabKey): boolean {
      return resource === 'ddns' ? canViewDdns : canViewPortForward;
    }

    /**
     * Refreshes only the active resource addressed by one semantic SSE event.
     * @param event - Committed API event classified by network resource source.
     */
    function handleStateChanged(event: SystemNetworkApi.StateChangeEvent) {
      const resource = event.source === 'ddns' ? 'ddns' : 'port-forward';
      if (pageActive && activeTab.value === resource) {
        void requestRefresh(resource);
      }
    }

    /** Refreshes the active resource when the API cannot replay a missed event. */
    function handleSnapshotRequired() {
      if (pageActive) void requestRefresh(activeTab.value);
    }

    /**
     * Selects one allowed tab and immediately requests its first fact snapshot.
     * @param key - Tab key emitted by Ant Design Tabs.
     */
    function handleActiveTabChange(key: NetworkTabKey) {
      if (!canViewResource(key) || activeTab.value === key) return;
      activeTab.value = key;
      if (pageActive) void requestRefresh(key);
    }

    /** Opens the stream before the one initial page snapshot to avoid a subscription gap. */
    function activatePage() {
      if (pageActive || tabItems.length === 0) return;
      pageActive = true;
      managementStream.start();
      void requestRefresh(activeTab.value);
    }

    /** Closes the route-owned stream while preserving its replay cursor. */
    function deactivatePage() {
      pageActive = false;
      managementStream.close();
    }

    /** Renders independent Agent connectivity and revision convergence controls. */
    function renderAgentControls() {
      const status = agentStatus.value;
      return (
        <Space wrap>
          <Tag color={getAgentStatusColor(status, agentStatusUnknown.value)}>
            {$t('system.network.agentLabel')}:{' '}
            {getAgentStatusLabel(status, agentStatusUnknown.value)}
          </Tag>
          <ATypographyText type="secondary">
            {$t('system.network.revisionLabel')}{' '}
            {String(status?.appliedRevision ?? '-')}/
            {String(status?.desiredRevision ?? '-')}
          </ATypographyText>
          <ATypographyText type="secondary">
            {$t('system.network.targetLabel')} {status?.targetIpv4 || '-'}
          </ATypographyText>
        </Space>
      );
    }

    /** Renders cells without collapsing independent synchronization dimensions. */
    function renderBodyCell({ column, record }: any) {
      const row = record as SystemNetworkApi.PortForward;
      if (column.key === 'protocol') {
        return (
          <Tag color={row.protocol === 'udp' ? 'blue' : 'purple'}>
            {row.protocol.toUpperCase()}
          </Tag>
        );
      }
      if (column.key === 'internalTarget') {
        return `${row.targetIpv4}:${row.internalPort}`;
      }
      if (column.key === 'syncStatus') {
        return (
          <Tag color={syncStatusColors[row.syncStatus]}>
            {syncStatusLabels[row.syncStatus]}
          </Tag>
        );
      }
      if (column.key === 'keeper') {
        return (
          <Space size={4}>
            <Tag color={row.keeperDesiredEnabled ? 'blue' : 'default'}>
              {row.keeperDesiredEnabled
                ? $t('system.network.desiredOn')
                : $t('system.network.desiredOff')}
            </Tag>
            <Tag color={keeperStatusColors[row.keeperStatus]}>
              {keeperStatusLabels[row.keeperStatus]}
            </Tag>
          </Space>
        );
      }
      if (column.key === 'publicEndpoint') {
        return getCurrentEndpoint(row) || '-';
      }
      if (column.key === 'lastObserved') {
        const lastEndpoint =
          row.lastObservedIpv4 && row.lastObservedPort
            ? `${row.lastObservedIpv4}:${row.lastObservedPort}`
            : '-';
        return `${lastEndpoint} · ${row.lastObservedAt || '-'}`;
      }
      if (column.key === 'summary') {
        return getWaitingOrErrorSummary(row, agentStatus.value);
      }
      return undefined;
    }

    onMounted(activatePage);
    onActivated(activatePage);
    onDeactivated(deactivatePage);
    onBeforeUnmount(deactivatePage);

    return () => (
      <Page autoContentHeight>
        <div
          class="flex h-full min-h-0 flex-col"
          data-testid="network-content-shell"
        >
          {tabItems.length > 0 ? (
            <ATabs
              activeKey={activeTab.value}
              items={tabItems}
              onUpdate:activeKey={handleActiveTabChange}
            />
          ) : null}
          {canViewPortForward ? (
            <div
              class={[
                'min-h-0 flex-1',
                activeTab.value === 'port-forward' ? '' : 'hidden',
              ]}
              data-testid="port-forward-panel"
            >
              <AKtTable
                onRegister={registerTable}
                v-slots={{
                  bodyCell: renderBodyCell,
                  headerControls: renderAgentControls,
                }}
              />
            </div>
          ) : null}
          {canViewDdns ? (
            <div
              class={[
                'min-h-0 flex-1',
                activeTab.value === 'ddns' ? '' : 'hidden',
              ]}
              data-testid="ddns-panel"
            >
              <NetworkDdnsTable ref={ddnsTableRef} />
            </div>
          ) : null}
        </div>
        {canViewPortForward ? (
          <>
            <NetworkPortForwardModal
              onSaved={handleModalSaved}
              ref={modalRef}
            />
            <NetworkEndpointHistoryDrawer ref={historyDrawerRef} />
          </>
        ) : null}
      </Page>
    );
  },
});

/**
 * Returns whether a mapping is immutable pending confirmed asynchronous deletion.
 * @param row - Persisted port-forward row.
 * @returns True for absent tombstones, deleting state, or confirmed deletion.
 */
export function isDeleting(row: SystemNetworkApi.PortForward): boolean {
  return (
    row.isDeleted ||
    row.desiredPresence === 'absent' ||
    row.syncStatus === 'deleting'
  );
}

/**
 * Resolves the Keeper or probe disabled reason without consulting Agent online state.
 * @param row - Persisted port-forward row.
 * @param requireEnabled - Whether immediate probe additionally requires desired Keeper.
 * @returns Readable reason, or undefined when the action is valid.
 */
export function getKeeperDisabledReason(
  row: SystemNetworkApi.PortForward,
  requireEnabled: boolean,
): string | undefined {
  if (isDeleting(row)) return $t('system.network.deletingImmutable');
  if (row.protocol === 'tcp') {
    return $t('system.network.tcpKeeperUnsupported');
  }
  if (row.externalPort !== row.internalPort) {
    return $t('system.network.udpSamePortRequired');
  }
  if (requireEnabled && !row.keeperDesiredEnabled) {
    return $t('system.network.enableKeeperFirst');
  }
  return undefined;
}

/**
 * Formats the current endpoint already lease-filtered by the API.
 * @param row - Persisted port-forward row.
 * @returns Exact public IPv4 and port, or undefined when the API withdrew it.
 */
export function getCurrentEndpoint(
  row: SystemNetworkApi.PortForward,
): string | undefined {
  return row.currentPublicIpv4 && row.currentPublicPort
    ? `${row.currentPublicIpv4}:${row.currentPublicPort}`
    : undefined;
}

/**
 * Produces the row summary without treating status-refresh failure as Agent offline.
 * @param row - Persisted mapping with redacted stable error fields.
 * @param status - Last successfully loaded Agent status, when available.
 * @returns Error, offline wait, pending wait, or an empty marker.
 */
export function getWaitingOrErrorSummary(
  row: SystemNetworkApi.PortForward,
  status?: SystemNetworkApi.AgentStatus,
): string {
  if (row.lastErrorMessage) return row.lastErrorMessage;
  if (status && !status.online && row.syncStatus !== 'synced') {
    return $t('system.network.waitingForAgent');
  }
  if (row.syncStatus === 'pending' || row.syncStatus === 'syncing') {
    return $t('system.network.waitingForSync');
  }
  return '-';
}

/**
 * Resolves the independent Agent status color without treating refresh failure as offline.
 * @param status - Last successfully loaded Agent status.
 * @param unknown - Whether the latest status request failed.
 * @returns Ant Design semantic color.
 */
function getAgentStatusColor(
  status: SystemNetworkApi.AgentStatus | undefined,
  unknown: boolean,
): string {
  if (unknown) return 'default';
  return status?.online ? 'success' : 'warning';
}

/**
 * Resolves the independent Agent status label shown in the table header.
 * @param status - Last successfully loaded Agent status.
 * @param unknown - Whether the latest status request failed.
 * @returns Localized unknown, online, or offline label.
 */
function getAgentStatusLabel(
  status: SystemNetworkApi.AgentStatus | undefined,
  unknown: boolean,
): string {
  if (unknown) return $t('system.network.agentUnknown');
  return status?.online
    ? $t('system.network.agentOnline')
    : $t('system.network.agentOffline');
}

/** Returns the immutable-row explanation used by CRUD write actions. */
function getWriteDisabledReason(
  row: SystemNetworkApi.PortForward,
): string | undefined {
  return isDeleting(row) ? $t('system.network.deletingImmutable') : undefined;
}
