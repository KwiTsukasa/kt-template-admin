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
  deleteNetworkPortForwardGroup,
  disableNetworkTcpNatmap,
  disableNetworkUdpKeeper,
  enableNetworkTcpNatmap,
  enableNetworkUdpKeeper,
  getNetworkAgentStatus,
  getNetworkPortForwardGroupList,
  probeNetworkUdpKeeper,
  retryNetworkPortForwardChannel,
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
const protocolModeOptions = [
  { label: 'TCP', value: 'tcp' },
  { label: 'UDP', value: 'udp' },
  { label: 'TCP+UDP', value: 'tcp_udp' },
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
const natmapStatusColors: Record<SystemNetworkApi.NatmapStatus, string> = {
  active: 'success',
  disabled: 'default',
  failed: 'error',
  stale: 'warning',
  starting: 'processing',
  stopping: 'warning',
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
const natmapStatusLabels: Record<SystemNetworkApi.NatmapStatus, string> = {
  active: $t('system.network.natmapActive'),
  disabled: $t('system.network.natmapDisabled'),
  failed: $t('system.network.natmapFailed'),
  stale: $t('system.network.natmapStale'),
  starting: $t('system.network.natmapStarting'),
  stopping: $t('system.network.natmapStopping'),
};

export default defineComponent({
  name: 'SystemNetworkList',
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
    const busyGroupIds = ref<Set<string>>(new Set());
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

    const columns: Array<TableColumnType<SystemNetworkApi.PortForwardGroup>> = [
      {
        dataIndex: 'name',
        key: 'name',
        title: $t('system.network.name'),
        width: 150,
      },
      {
        dataIndex: 'protocolMode',
        key: 'protocolMode',
        title: $t('system.network.protocolMode'),
        width: 110,
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
        key: 'tcpStatic',
        title: $t('system.network.tcpStaticState'),
        width: 110,
      },
      {
        key: 'tcpNatmap',
        title: $t('system.network.natmapState'),
        width: 190,
      },
      {
        key: 'tcpEndpoint',
        title: $t('system.network.tcpPublicEndpoint'),
        width: 185,
      },
      {
        key: 'udpStatic',
        title: $t('system.network.udpStaticState'),
        width: 110,
      },
      {
        key: 'udpKeeper',
        title: $t('system.network.keeperState'),
        width: 190,
      },
      {
        key: 'udpEndpoint',
        title: $t('system.network.udpPublicEndpoint'),
        width: 185,
      },
      {
        key: 'summary',
        title: $t('system.network.summary'),
        width: 260,
      },
      {
        dataIndex: 'updateTime',
        key: 'updateTime',
        title: $t('system.network.updateTime'),
        width: 180,
      },
    ];
    const api: KtTableApi<SystemNetworkApi.PortForwardGroup> = {
      list: async (params) => await getNetworkPortForwardGroupList(params),
    };
    const buttons: Array<KtTableButton<SystemNetworkApi.PortForwardGroup>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: $t('system.network.createAction'),
        onClick: openCreate,
        permissionCodes: ['System:Network:PortForward:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<
      KtTableRowAction<SystemNetworkApi.PortForwardGroup>
    > = [
      {
        key: 'edit',
        label: $t('system.network.editAction'),
        onClick: openEdit,
        permissionCodes: ['System:Network:PortForward:Update'],
        rowVisible: (row) => !isGroupBusy(row) && !isGroupDeleting(row),
      },
      createRetryAction('tcp'),
      createTcpNatmapAction(false),
      createTcpNatmapAction(true),
      createCopyAction('tcp'),
      createHistoryAction('tcp'),
      createRetryAction('udp'),
      createUdpKeeperAction(false),
      createUdpKeeperAction(true),
      {
        key: 'udp-probe',
        label: $t('system.network.probeAction'),
        onClick: async (row) => {
          await runGroupMutation(
            row,
            probeNetworkUdpKeeper,
            $t('system.network.probeSubmitted'),
          );
        },
        permissionCodes: ['System:Network:PortForward:Probe'],
        rowVisible: (row) =>
          !!row.channels.udp &&
          !isGroupBusy(row) &&
          !getUdpProbeDisabledReason(row),
      },
      createCopyAction('udp'),
      createHistoryAction('udp'),
      {
        confirm: (row) => $t('system.network.deleteConfirm', [row.name]),
        danger: true,
        key: 'delete',
        label: $t('system.network.deleteAction'),
        onClick: async (row) => {
          await runGroupMutation(
            row,
            deleteNetworkPortForwardGroup,
            $t('system.network.deleteSubmitted'),
          );
        },
        permissionCodes: ['System:Network:PortForward:Delete'],
        rowVisible: (row) => !isGroupBusy(row) && !isGroupDeleting(row),
      },
    ];
    const [registerTable, tableApi] =
      useKtTable<SystemNetworkApi.PortForwardGroup>({
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
                options: protocolModeOptions,
              },
              fieldName: 'protocolMode',
              label: $t('system.network.protocolMode'),
            },
          ],
        },
        immediate: false,
        rowActions,
        rowActionVisibleCount: 2,
        rowKey: 'id',
        tableTitle: $t('system.network.portForwardTitle'),
      });

    function createRetryAction(
      protocol: SystemNetworkApi.Protocol,
    ): KtTableRowAction<SystemNetworkApi.PortForwardGroup> {
      return {
        key: `${protocol}-retry`,
        label:
          protocol === 'tcp'
            ? $t('system.network.retryTcpAction')
            : $t('system.network.retryUdpAction'),
        onClick: async (row) => {
          await runGroupMutation(
            row,
            (id) => retryNetworkPortForwardChannel(id, protocol),
            $t('system.network.retrySubmitted'),
          );
        },
        permissionCodes: ['System:Network:PortForward:Retry'],
        rowVisible: (row) =>
          !!row.channels[protocol] &&
          !isGroupBusy(row) &&
          isChannelRetryAvailable(row, protocol),
      };
    }

    function createTcpNatmapAction(
      disable: boolean,
    ): KtTableRowAction<SystemNetworkApi.PortForwardGroup> {
      return {
        key: disable ? 'tcp-natmap-disable' : 'tcp-natmap-enable',
        label: disable
          ? $t('system.network.disableNatmapAction')
          : $t('system.network.enableNatmapAction'),
        onClick: async (row) => {
          await runGroupMutation(
            row,
            disable ? disableNetworkTcpNatmap : enableNetworkTcpNatmap,
            disable
              ? $t('system.network.natmapDisableSubmitted')
              : $t('system.network.natmapEnableSubmitted'),
          );
        },
        permissionCodes: ['System:Network:PortForward:Natmap'],
        rowVisible: (row) => {
          const channel = row.channels.tcp;
          return (
            !!channel &&
            channel.natmapDesiredEnabled === disable &&
            !isGroupBusy(row) &&
            !getMechanismTransitionDisabledReason(row)
          );
        },
      };
    }

    function createUdpKeeperAction(
      disable: boolean,
    ): KtTableRowAction<SystemNetworkApi.PortForwardGroup> {
      return {
        key: disable ? 'udp-keeper-disable' : 'udp-keeper-enable',
        label: disable
          ? $t('system.network.disableKeeperAction')
          : $t('system.network.enableKeeperAction'),
        onClick: async (row) => {
          await runGroupMutation(
            row,
            disable ? disableNetworkUdpKeeper : enableNetworkUdpKeeper,
            disable
              ? $t('system.network.keeperDisableSubmitted')
              : $t('system.network.keeperEnableSubmitted'),
          );
        },
        permissionCodes: ['System:Network:PortForward:Keeper'],
        rowVisible: (row) => {
          const channel = row.channels.udp;
          return (
            !!channel &&
            channel.keeperDesiredEnabled === disable &&
            !isGroupBusy(row) &&
            !getUdpKeeperTransitionDisabledReason(row)
          );
        },
      };
    }

    function createCopyAction(
      protocol: SystemNetworkApi.Protocol,
    ): KtTableRowAction<SystemNetworkApi.PortForwardGroup> {
      return {
        key: `${protocol}-copy-endpoint`,
        label:
          protocol === 'tcp'
            ? $t('system.network.copyTcpEndpointAction')
            : $t('system.network.copyUdpEndpointAction'),
        onClick: async (row) => {
          await copyChannelEndpoint(row, protocol);
        },
        permissionCodes: ['System:Network:PortForward:List'],
        rowVisible: (row) =>
          !!row.channels[protocol] &&
          Boolean(getChannelEndpoint(row.channels[protocol])),
      };
    }

    function createHistoryAction(
      protocol: SystemNetworkApi.Protocol,
    ): KtTableRowAction<SystemNetworkApi.PortForwardGroup> {
      return {
        key: `${protocol}-history`,
        label:
          protocol === 'tcp'
            ? $t('system.network.tcpHistoryAction')
            : $t('system.network.udpHistoryAction'),
        onClick: (row) => openHistory(row, protocol),
        permissionCodes: ['System:Network:PortForward:History'],
        rowVisible: (row) => !!row.channels[protocol],
      };
    }

    function openCreate() {
      const rowTarget = tableApi.getRows()[0]?.targetIpv4 || '';
      modalRef.value?.openCreate(agentStatus.value?.targetIpv4 || rowTarget);
    }

    function openEdit(row: SystemNetworkApi.PortForwardGroup) {
      if (!isGroupBusy(row) && !isGroupDeleting(row)) {
        modalRef.value?.openEdit(row);
      }
    }

    function openHistory(
      row: SystemNetworkApi.PortForwardGroup,
      protocol: SystemNetworkApi.Protocol,
    ) {
      historyDrawerRef.value?.open(row, protocol);
    }

    function handleModalSaved() {
      void requestRefresh('port-forward');
    }

    async function copyChannelEndpoint(
      row: SystemNetworkApi.PortForwardGroup,
      protocol: SystemNetworkApi.Protocol,
    ) {
      const endpoint = getChannelEndpoint(row.channels[protocol]);
      if (!endpoint) return;
      await navigator.clipboard.writeText(endpoint);
      message.success($t('system.network.endpointCopied'));
    }

    async function runGroupMutation(
      row: SystemNetworkApi.PortForwardGroup,
      mutation: (id: string) => Promise<unknown>,
      successMessage: string,
    ) {
      if (isGroupBusy(row)) return;
      setGroupBusy(row.id, true);
      try {
        await mutation(row.id);
        message.success(successMessage);
        await requestRefresh('port-forward');
      } finally {
        setGroupBusy(row.id, false);
      }
    }

    function setGroupBusy(id: string, busy: boolean) {
      const next = new Set(busyGroupIds.value);
      if (busy) next.add(id);
      else next.delete(id);
      busyGroupIds.value = next;
    }

    function isGroupBusy(row: SystemNetworkApi.PortForwardGroup): boolean {
      return busyGroupIds.value.has(row.id);
    }

    async function loadAgentStatus() {
      try {
        agentStatus.value = await getNetworkAgentStatus();
        agentStatusUnknown.value = false;
      } catch {
        agentStatusUnknown.value = true;
      }
    }

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

    async function performResourceRefresh(resource: NetworkTabKey) {
      if (resource === 'ddns') {
        await ddnsTableRef.value?.reload();
        return;
      }
      await Promise.allSettled([tableApi.reload(), loadAgentStatus()]);
    }

    function canViewResource(resource: NetworkTabKey): boolean {
      return resource === 'ddns' ? canViewDdns : canViewPortForward;
    }

    function handleStateChanged(event: SystemNetworkApi.StateChangeEvent) {
      const resource = event.source === 'ddns' ? 'ddns' : 'port-forward';
      if (pageActive && activeTab.value === resource) {
        void requestRefresh(resource);
      }
    }

    function handleSnapshotRequired() {
      if (pageActive) void requestRefresh(activeTab.value);
    }

    function handleActiveTabChange(key: NetworkTabKey) {
      if (!canViewResource(key) || activeTab.value === key) return;
      activeTab.value = key;
      if (pageActive) void requestRefresh(key);
    }

    function activatePage() {
      if (pageActive || tabItems.length === 0) return;
      pageActive = true;
      managementStream.start();
      void requestRefresh(activeTab.value);
    }

    function deactivatePage() {
      pageActive = false;
      managementStream.close();
    }

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
            {String(status?.appliedRevision ?? '—')}/
            {String(status?.desiredRevision ?? '—')}
          </ATypographyText>
          <ATypographyText type="secondary">
            {$t('system.network.targetLabel')} {status?.targetIpv4 || '—'}
          </ATypographyText>
        </Space>
      );
    }

    function renderBodyCell({ column, record }: any) {
      const row = record as SystemNetworkApi.PortForwardGroup;
      if (column.key === 'protocolMode') {
        return (
          <Space size={4}>
            <Tag color="blue">{formatProtocolMode(row.protocolMode)}</Tag>
            <ATypographyText type="secondary">
              {$t('system.network.appliedProtocolMode')}:{' '}
              {row.appliedProtocolMode
                ? formatProtocolMode(row.appliedProtocolMode)
                : '—'}
            </ATypographyText>
          </Space>
        );
      }
      if (column.key === 'internalTarget') {
        return `${row.targetIpv4}:${row.internalPort}`;
      }
      if (column.key === 'tcpStatic') {
        return renderStaticState(row.channels.tcp);
      }
      if (column.key === 'tcpNatmap') {
        return renderMechanismState(row.channels.tcp, 'tcp');
      }
      if (column.key === 'tcpEndpoint') {
        return getChannelEndpoint(row.channels.tcp) || '—';
      }
      if (column.key === 'udpStatic') {
        return renderStaticState(row.channels.udp);
      }
      if (column.key === 'udpKeeper') {
        return renderMechanismState(row.channels.udp, 'udp');
      }
      if (column.key === 'udpEndpoint') {
        return getChannelEndpoint(row.channels.udp) || '—';
      }
      if (column.key === 'summary') {
        return getGroupWaitingOrErrorSummary(row, agentStatus.value);
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

export function isGroupDeleting(
  row: SystemNetworkApi.PortForwardGroup,
): boolean {
  return (
    row.isDeleted ||
    [row.channels.tcp, row.channels.udp].some(
      (channel) =>
        !!channel &&
        (channel.isDeleted ||
          channel.desiredPresence === 'absent' ||
          channel.syncStatus === 'deleting'),
    )
  );
}

export function getChannelMutationDisabledReason(
  row: SystemNetworkApi.PortForwardGroup,
  protocol: SystemNetworkApi.Protocol,
): string | undefined {
  if (isGroupDeleting(row)) return $t('system.network.deletingImmutable');
  const channel = row.channels[protocol];
  if (!channel) {
    return protocol === 'tcp'
      ? $t('system.network.tcpChannelUnavailable')
      : $t('system.network.udpChannelUnavailable');
  }
  if (channel.syncStatus === 'pending' || channel.syncStatus === 'syncing') {
    return $t('system.network.waitingForSync');
  }
  return undefined;
}

export function getChannelEndpoint(
  channel?: null | SystemNetworkApi.PortForwardChannel,
): string | undefined {
  if (!channel) return undefined;
  if (channel.currentPublicEndpoint) return channel.currentPublicEndpoint;
  return channel.currentPublicIpv4 && channel.currentPublicPort
    ? `${channel.currentPublicIpv4}:${channel.currentPublicPort}`
    : undefined;
}

function isChannelRetryAvailable(
  row: SystemNetworkApi.PortForwardGroup,
  protocol: SystemNetworkApi.Protocol,
): boolean {
  const channel = row.channels[protocol];
  return (
    !!channel &&
    channel.desiredPresence === 'present' &&
    (['conflict', 'failed'].includes(channel.syncStatus) ||
      (protocol === 'tcp' &&
        ['failed', 'stale'].includes(channel.natmapStatus)) ||
      (protocol === 'udp' &&
        ['failed', 'stale'].includes(channel.keeperStatus)))
  );
}

function getMechanismTransitionDisabledReason(
  row: SystemNetworkApi.PortForwardGroup,
): string | undefined {
  const basic = getChannelMutationDisabledReason(row, 'tcp');
  if (basic) return basic;
  const channels = [row.channels.tcp, row.channels.udp].filter(
    (channel): channel is SystemNetworkApi.PortForwardChannel => !!channel,
  );
  if (channels.some((channel) => channel.syncStatus !== 'synced')) {
    return $t('system.network.waitingForSync');
  }
  return undefined;
}

function getUdpKeeperTransitionDisabledReason(
  row: SystemNetworkApi.PortForwardGroup,
): string | undefined {
  const basic = getChannelMutationDisabledReason(row, 'udp');
  if (basic) return basic;
  if (row.externalPort !== row.internalPort) {
    return $t('system.network.udpSamePortRequired');
  }
  const channels = [row.channels.tcp, row.channels.udp].filter(
    (channel): channel is SystemNetworkApi.PortForwardChannel => !!channel,
  );
  if (channels.some((channel) => channel.syncStatus !== 'synced')) {
    return $t('system.network.waitingForSync');
  }
  return undefined;
}

function getUdpProbeDisabledReason(
  row: SystemNetworkApi.PortForwardGroup,
): string | undefined {
  const transitionReason = getUdpKeeperTransitionDisabledReason(row);
  if (transitionReason) return transitionReason;
  if (!row.channels.udp?.keeperDesiredEnabled) {
    return $t('system.network.enableKeeperFirst');
  }
  return undefined;
}

function getGroupWaitingOrErrorSummary(
  row: SystemNetworkApi.PortForwardGroup,
  status?: SystemNetworkApi.AgentStatus,
): string {
  const channels = [row.channels.tcp, row.channels.udp].filter(
    (channel): channel is SystemNetworkApi.PortForwardChannel => !!channel,
  );
  const error = channels
    .flatMap((channel) => [
      channel.lastErrorMessage,
      channel.natmapLastErrorMessage,
      channel.keeperLastErrorMessage,
    ])
    .find(Boolean);
  if (error) return error;
  if (
    status &&
    !status.online &&
    channels.some((channel) => channel.syncStatus !== 'synced')
  ) {
    return $t('system.network.waitingForAgent');
  }
  if (
    channels.some(
      (channel) =>
        channel.syncStatus === 'pending' || channel.syncStatus === 'syncing',
    )
  ) {
    return $t('system.network.waitingForSync');
  }
  return '—';
}

function renderStaticState(
  channel: null | SystemNetworkApi.PortForwardChannel,
) {
  if (!channel) return '—';
  return (
    <Tag color={syncStatusColors[channel.syncStatus]}>
      {syncStatusLabels[channel.syncStatus]}
    </Tag>
  );
}

function renderMechanismState(
  channel: null | SystemNetworkApi.PortForwardChannel,
  protocol: SystemNetworkApi.Protocol,
) {
  if (!channel) return '—';
  if (protocol === 'tcp') {
    return (
      <Space size={4}>
        <Tag color={channel.natmapDesiredEnabled ? 'blue' : 'default'}>
          {channel.natmapDesiredEnabled
            ? $t('system.network.desiredOn')
            : $t('system.network.desiredOff')}
        </Tag>
        <Tag color={natmapStatusColors[channel.natmapStatus]}>
          {natmapStatusLabels[channel.natmapStatus]}
        </Tag>
      </Space>
    );
  }
  return (
    <Space size={4}>
      <Tag color={channel.keeperDesiredEnabled ? 'blue' : 'default'}>
        {channel.keeperDesiredEnabled
          ? $t('system.network.desiredOn')
          : $t('system.network.desiredOff')}
      </Tag>
      <Tag color={keeperStatusColors[channel.keeperStatus]}>
        {keeperStatusLabels[channel.keeperStatus]}
      </Tag>
    </Space>
  );
}

function formatProtocolMode(mode: SystemNetworkApi.ProtocolMode): string {
  if (mode === 'tcp_udp') return 'TCP+UDP';
  return mode.toUpperCase();
}

function getAgentStatusColor(
  status: SystemNetworkApi.AgentStatus | undefined,
  unknown: boolean,
): string {
  if (unknown) return 'default';
  return status?.online ? 'success' : 'warning';
}

function getAgentStatusLabel(
  status: SystemNetworkApi.AgentStatus | undefined,
  unknown: boolean,
): string {
  if (unknown) return $t('system.network.agentUnknown');
  return status?.online
    ? $t('system.network.agentOnline')
    : $t('system.network.agentOffline');
}
