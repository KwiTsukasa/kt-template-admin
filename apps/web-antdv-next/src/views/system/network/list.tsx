import type { TableColumnType } from 'antdv-next';

import type { NetworkDdnsTableExposed } from './components/NetworkDdnsTable';
import type { NetworkEndpointHistoryDrawerExposed } from './components/NetworkEndpointHistoryDrawer';
import type { NetworkPortForwardModalExposed } from './components/NetworkPortForwardModal';

import type { SystemNetworkApi } from '#/api/system/network';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/kt-table';

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
import { KtTable, useKtTable } from '#/components/kt-table';
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
      ...(() => {
        if (canViewPortForward) {
          return [
            {
              key: 'port-forward' as const,
              label: $t('system.network.portForwardTab'),
            },
          ];
        }
        return [];
      })(),
      ...(() => {
        if (canViewDdns) {
          return [
            {
              key: 'ddns' as const,
              label: $t('system.network.ddnsTab'),
            },
          ];
        }
        return [];
      })(),
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
        rowVisible: (row) => !isGroupBusy(row) && isGroupRemovable(row),
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

    /**
     * 生成指定协议通道的重试行操作，仅在通道存在、空闲且允许重试时显示。
     *
     * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
     * @returns 包含权限、可见条件与点击处理器的协议重试行操作。
     */
    function createRetryAction(
      protocol: SystemNetworkApi.Protocol,
    ): KtTableRowAction<SystemNetworkApi.PortForwardGroup> {
      return {
        key: `${protocol}-retry`,
        label: (() => {
          if (protocol === 'tcp') {
            return $t('system.network.retryTcpAction');
          }
          return $t('system.network.retryUdpAction');
        })(),
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

    /**
     * 生成 TCP NATMap 启停行操作，并按期望状态与组占用情况控制可见性。
     *
     * @param disable - 是否禁用当前规则或功能分支。
     * @returns 包含权限、可见条件与点击处理器的 TCP NATMap 启停行操作。
     */
    function createTcpNatmapAction(
      disable: boolean,
    ): KtTableRowAction<SystemNetworkApi.PortForwardGroup> {
      return {
        key: (() => {
          if (disable) {
            return 'tcp-natmap-disable';
          }
          return 'tcp-natmap-enable';
        })(),
        label: (() => {
          if (disable) {
            return $t('system.network.disableNatmapAction');
          }
          return $t('system.network.enableNatmapAction');
        })(),
        onClick: async (row) => {
          await runGroupMutation(
            row,
            (() => {
              if (disable) {
                return disableNetworkTcpNatmap;
              }
              return enableNetworkTcpNatmap;
            })(),
            (() => {
              if (disable) {
                return $t('system.network.natmapDisableSubmitted');
              }
              return $t('system.network.natmapEnableSubmitted');
            })(),
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

    /**
     * 生成 UDP 保活器启停行操作，并按期望状态与组占用情况控制可见性。
     *
     * @param disable - 是否禁用当前规则或功能分支。
     * @returns 包含权限、可见条件与点击处理器的 UDP 保活器启停行操作。
     */
    function createUdpKeeperAction(
      disable: boolean,
    ): KtTableRowAction<SystemNetworkApi.PortForwardGroup> {
      return {
        key: (() => {
          if (disable) {
            return 'udp-keeper-disable';
          }
          return 'udp-keeper-enable';
        })(),
        label: (() => {
          if (disable) {
            return $t('system.network.disableKeeperAction');
          }
          return $t('system.network.enableKeeperAction');
        })(),
        onClick: async (row) => {
          await runGroupMutation(
            row,
            (() => {
              if (disable) {
                return disableNetworkUdpKeeper;
              }
              return enableNetworkUdpKeeper;
            })(),
            (() => {
              if (disable) {
                return $t('system.network.keeperDisableSubmitted');
              }
              return $t('system.network.keeperEnableSubmitted');
            })(),
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

    /**
     * 生成指定协议端点复制行操作，仅在通道存在且具有可复制端点时显示。
     *
     * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
     * @returns 包含权限、可见条件与点击处理器的端点复制行操作。
     */
    function createCopyAction(
      protocol: SystemNetworkApi.Protocol,
    ): KtTableRowAction<SystemNetworkApi.PortForwardGroup> {
      return {
        key: `${protocol}-copy-endpoint`,
        label: (() => {
          if (protocol === 'tcp') {
            return $t('system.network.copyTcpEndpointAction');
          }
          return $t('system.network.copyUdpEndpointAction');
        })(),
        onClick: async (row) => {
          await copyChannelEndpoint(row, protocol);
        },
        permissionCodes: ['System:Network:PortForward:List'],
        rowVisible: (row) =>
          !!row.channels[protocol] &&
          Boolean(getChannelEndpoint(row.channels[protocol])),
      };
    }

    /**
     * 生成指定协议通道的历史记录行操作，仅在对应通道存在时显示。
     *
     * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
     * @returns 包含权限、可见条件与点击处理器的通道历史行操作。
     */
    function createHistoryAction(
      protocol: SystemNetworkApi.Protocol,
    ): KtTableRowAction<SystemNetworkApi.PortForwardGroup> {
      return {
        key: `${protocol}-history`,
        label: (() => {
          if (protocol === 'tcp') {
            return $t('system.network.tcpHistoryAction');
          }
          return $t('system.network.udpHistoryAction');
        })(),
        onClick: (row) => openHistory(row, protocol),
        permissionCodes: ['System:Network:PortForward:History'],
        rowVisible: (row) => !!row.channels[protocol],
      };
    }

    /**
     * 从 Agent 状态或首行记录选择目标 IPv4，并打开端口转发新建弹窗。
     */
    function openCreate() {
      const rowTarget = tableApi.getRows()[0]?.targetIpv4 || '';
      modalRef.value?.openCreate(agentStatus.value?.targetIpv4 || rowTarget);
    }

    /**
     * 仅在端口转发分组未变更且未删除时，把该分组交给弹窗编辑。
     *
     * @param row - 要加载到编辑弹窗的端口转发组。
     */
    function openEdit(row: SystemNetworkApi.PortForwardGroup) {
      if (!isGroupBusy(row) && !isGroupDeleting(row)) {
        modalRef.value?.openEdit(row);
      }
    }

    /**
     * 通过历史抽屉组件打开指定端口转发组与协议的端点记录。
     *
     * @param row - 需要查询 TCP 或 UDP 端点变更历史的端口转发组。
     * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
     */
    function openHistory(
      row: SystemNetworkApi.PortForwardGroup,
      protocol: SystemNetworkApi.Protocol,
    ) {
      historyDrawerRef.value?.open(row, protocol);
    }

    /**
     * 端口转发配置保存后登记一次合并刷新请求。
     */
    function handleModalSaved() {
      void requestRefresh('port-forward');
    }

    /**
     * 把端口转发通道端点写入系统剪贴板，并向用户反馈复制结果。
     *
     * @param row - 包含待复制 TCP 或 UDP 通道端点的端口转发分组。
     * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
     */
    async function copyChannelEndpoint(
      row: SystemNetworkApi.PortForwardGroup,
      protocol: SystemNetworkApi.Protocol,
    ) {
      const endpoint = getChannelEndpoint(row.channels[protocol]);
      if (!endpoint) return;
      await navigator.clipboard.writeText(endpoint);
      message.success($t('system.network.endpointCopied'));
    }

    /**
     * 串行执行端口转发组变更；占用组直接忽略，成功后提示并登记合并刷新。
     *
     * @param row - 要执行更新、重试或删除操作的端口转发分组。
     * @param mutation - 接收分组标识并执行后端变更的异步函数。
     * @param successMessage - 操作成功后显示给用户的提示文本。
     */
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

    /**
     * 以不可变 Set 更新端口转发组占用标识，避免并发操作复用旧集合引用。
     *
     * @param id - 需要加入或移出忙碌集合的端口转发组标识。
     * @param busy - 当前记录是否正在执行异步操作。
     */
    function setGroupBusy(id: string, busy: boolean) {
      const next = new Set(busyGroupIds.value);
      if (busy) next.add(id);
      else next.delete(id);
      busyGroupIds.value = next;
    }

    /**
     * 检查端口转发组是否正在执行变更，阻止同组并发操作。
     *
     * @param row - 需要按标识检查是否已有变更进行中的端口转发组。
     * @returns 端口转发分组存在进行中的变更时返回 true，否则返回 false。
     */
    function isGroupBusy(row: SystemNetworkApi.PortForwardGroup): boolean {
      return busyGroupIds.value.has(row.id);
    }

    /**
     * 探测 Network Agent 状态；请求失败时标记状态未知而不清空旧值。
     */
    async function loadAgentStatus() {
      try {
        agentStatus.value = await getNetworkAgentStatus();
        agentStatusUnknown.value = false;
      } catch {
        agentStatusUnknown.value = true;
      }
    }

    /**
     * 为指定网络资源登记刷新请求；已有刷新进行时合并为下一轮执行。
     *
     * @param resource - 需要刷新或执行权限判断的网络管理资源类型；未传入时使用 `activeTab.value`。
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
     * 串行执行资源刷新并合并并发请求，确保同一时刻只有一次真实加载。
     *
     * @param resource - 要重新加载的 DDNS 或端口转发资源类型。
     */
    async function performResourceRefresh(resource: NetworkTabKey) {
      if (resource === 'ddns') {
        await ddnsTableRef.value?.reload();
        return;
      }
      await Promise.allSettled([tableApi.reload(), loadAgentStatus()]);
    }

    /**
     * 根据当前访问码判断用户能否查看指定网络管理资源。
     *
     * @param resource - 要检查当前账号查看权限的网络管理资源类型。
     * @returns 当前访问码允许查看指定网络资源时返回 true，否则返回 false。
     */
    function canViewResource(resource: NetworkTabKey): boolean {
      if (resource === 'ddns') {
        return canViewDdns;
      }
      return canViewPortForward;
    }

    /**
     * 仅当页面激活且事件来源对应当前页签时，刷新 DDNS 或端口转发数据。
     *
     * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
     */
    function handleStateChanged(event: SystemNetworkApi.StateChangeEvent) {
      const resource = (() => {
        if (event.source === 'ddns') {
          return 'ddns';
        }
        return 'port-forward';
      })();
      if (pageActive && activeTab.value === resource) {
        void requestRefresh(resource);
      }
    }

    /**
     * 页面激活时响应快照补偿信号，刷新当前网络管理页签。
     */
    function handleSnapshotRequired() {
      if (pageActive) void requestRefresh(activeTab.value);
    }

    /**
     * 仅允许切换到有权限的网络管理页签，并在页面激活时请求对应资源刷新。
     *
     * @param key - 用户切换后的 network、ddns 等页签键；函数会规范化为字符串。
     */
    function handleActiveTabChange(key: NetworkTabKey) {
      if (!canViewResource(key) || activeTab.value === key) return;
      activeTab.value = key;
      if (pageActive) void requestRefresh(key);
    }

    /**
     * 恢复当前标签页的 keep-alive 激活状态，并执行注册的页面激活回调。
     */
    function activatePage() {
      if (pageActive || tabItems.length === 0) return;
      pageActive = true;
      managementStream.start();
      void requestRefresh(activeTab.value);
    }

    /**
     * 标记当前标签页进入 keep-alive 非激活状态，并执行注册的停用回调。
     */
    function deactivatePage() {
      pageActive = false;
      managementStream.close();
    }

    /**
     * 把 Agent 状态、配置修订号与目标 IPv4 渲染为网络页顶部状态区。
     *
     * @returns 包含 Agent 状态、修订号与目标 IPv4 的状态区节点。
     */
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

    /**
     * 根据列键渲染端口转发协议、目标、通道状态、端点或异常摘要；其他列返回 undefined。
     *
     * @returns 端口转发协议、目标、通道、端点或异常摘要节点；其他列返回 undefined。
     */
    function renderBodyCell({ column, record }: any) {
      const row = record as SystemNetworkApi.PortForwardGroup;
      if (column.key === 'protocolMode') {
        return (
          <Space size={4}>
            <Tag color="blue">{formatProtocolMode(row.protocolMode)}</Tag>
            <ATypographyText type="secondary">
              {$t('system.network.appliedProtocolMode')}:{' '}
              {(() => {
                if (row.appliedProtocolMode) {
                  return formatProtocolMode(row.appliedProtocolMode);
                }
                return '—';
              })()}
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
          {(() => {
            if (tabItems.length > 0) {
              return (
                <ATabs
                  activeKey={activeTab.value}
                  items={tabItems}
                  onUpdate:activeKey={handleActiveTabChange}
                />
              );
            }
            return null;
          })()}
          {(() => {
            if (canViewPortForward) {
              return (
                <div
                  class={[
                    'min-h-0 flex-1',
                    (() => {
                      if (activeTab.value === 'port-forward') {
                        return '';
                      }
                      return 'hidden';
                    })(),
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
              );
            }
            return null;
          })()}
          {(() => {
            if (canViewDdns) {
              return (
                <div
                  class={[
                    'min-h-0 flex-1',
                    (() => {
                      if (activeTab.value === 'ddns') {
                        return '';
                      }
                      return 'hidden';
                    })(),
                  ]}
                  data-testid="ddns-panel"
                >
                  <NetworkDdnsTable ref={ddnsTableRef} />
                </div>
              );
            }
            return null;
          })()}
        </div>
        {(() => {
          if (canViewPortForward) {
            return (
              <>
                <NetworkPortForwardModal
                  onSaved={handleModalSaved}
                  ref={modalRef}
                />
                <NetworkEndpointHistoryDrawer ref={historyDrawerRef} />
              </>
            );
          }
          return null;
        })()}
      </Page>
    );
  },
});

/**
 * 检查端口转发组是否已进入删除请求，供按钮展示独立加载态。
 *
 * @param row - 需要检查是否已经发起删除请求的端口转发分组。
 * @returns 端口转发分组已进入删除请求时返回 true，否则返回 false。
 */
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

/**
 * 仅允许删除全部通道已同步、机制已停用且公网端点已撤回的逻辑组，避免操作栏误删活动入口。
 *
 * @param row - 需要核对 TCP NATMap、UDP Keeper、revision 与公网端点状态的端口转发组。
 * @returns 所有现存通道均达到彻底停用终态时返回 true，否则返回 false。
 */
export function isGroupRemovable(
  row: SystemNetworkApi.PortForwardGroup,
): boolean {
  if (isGroupDeleting(row)) return false;
  const channels = [row.channels.tcp, row.channels.udp].filter(
    (channel): channel is SystemNetworkApi.PortForwardChannel => !!channel,
  );
  if (channels.length === 0) return false;
  return channels.every((channel) => {
    if (
      channel.desiredPresence !== 'present' ||
      channel.syncStatus !== 'synced' ||
      channel.desiredRevision !== channel.reportedRevision ||
      channel.currentPublicEndpoint ||
      channel.currentPublicIpv4 ||
      channel.currentPublicPort
    ) {
      return false;
    }
    if (channel.protocol === 'tcp') {
      return (
        !channel.natmapDesiredEnabled && channel.natmapStatus === 'disabled'
      );
    }
    return !channel.keeperDesiredEnabled && channel.keeperStatus === 'disabled';
  });
}

/**
 * 当分组正在删除、目标通道缺失或同步中时返回通道操作禁用原因。
 *
 * @param row - 提供删除与同步状态、用于判断通道能否变更的端口转发组。
 * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
 * @returns 分组删除中、通道缺失或同步中时对应的原因；可操作时返回 undefined。
 */
export function getChannelMutationDisabledReason(
  row: SystemNetworkApi.PortForwardGroup,
  protocol: SystemNetworkApi.Protocol,
): string | undefined {
  if (isGroupDeleting(row)) return $t('system.network.deletingImmutable');
  const channel = row.channels[protocol];
  if (!channel) {
    if (protocol === 'tcp') {
      return $t('system.network.tcpChannelUnavailable');
    }
    return $t('system.network.udpChannelUnavailable');
  }
  if (channel.syncStatus === 'pending' || channel.syncStatus === 'syncing') {
    return $t('system.network.waitingForSync');
  }
  return undefined;
}

/**
 * 按 TCP 或 UDP 通道读取当前公网端点，通道无有效地址时返回空值。
 *
 * @param channel - 当前操作针对的 TCP 或 UDP 转发通道。
 * @returns 通道当前公网端点；通道没有有效地址时返回 undefined。
 */
export function getChannelEndpoint(
  channel?: null | SystemNetworkApi.PortForwardChannel,
): string | undefined {
  if (!channel) return undefined;
  if (channel.currentPublicEndpoint) return channel.currentPublicEndpoint;
  if (channel.currentPublicIpv4 && channel.currentPublicPort) {
    return `${channel.currentPublicIpv4}:${channel.currentPublicPort}`;
  }
  return undefined;
}

/**
 * 仅当端口转发通道存在且未处于等待或运行态时允许重试。
 *
 * @param row - 需要判断目标通道是否存在且不在等待或运行态的端口转发组。
 * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
 * @returns 通道存在且未处于等待或运行状态时返回 true，否则返回 false。
 */
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

/**
 * 仅在 TCP 通道可变更且全部通道已同步时允许切换 NATMap。
 *
 * @param row - 提供 TCP NATMap 与各通道同步状态的端口转发组。
 * @returns 阻止 TCP NATMap 切换的通道状态说明；满足条件时返回 undefined。
 */
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

/**
 * 仅在 UDP 通道可变更、内外端口相同且全部通道已同步时允许切换保活器。
 *
 * @param row - 提供 UDP 保活、端口和各通道同步状态的端口转发组。
 * @returns 阻止 UDP 保活切换的端口或通道状态说明；满足条件时返回 undefined。
 */
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

/**
 * 仅在 UDP 保活器已启用且其切换条件满足时允许主动探测。
 *
 * @param row - 需要核对 UDP 保活启用与通道可变更条件的端口转发组。
 * @returns 阻止 UDP 主动探测的保活状态说明；满足条件时返回 undefined。
 */
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

/**
 * 汇总端口转发组中等待、失败或错误通道的状态说明，无异常时返回空字符串。
 *
 * @param row - 需要汇总通道等待态或错误信息的端口转发分组。
 * @param status - 端口转发通道的同步、NATMap 或保活状态，用于补充等待或错误摘要。
 * @returns 端口转发组的等待或错误说明；组内无异常时为空字符串。
 */
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

/**
 * 根据通道同步状态渲染静态转发标签；通道缺失时显示占位符。
 *
 * @param channel - 当前操作针对的 TCP 或 UDP 转发通道。
 * @returns 通道同步状态标签；通道缺失时返回占位文本。
 */
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

/**
 * 根据协议渲染 NATMap 或 UDP 保活器的期望开关与运行状态；通道缺失时显示占位符。
 *
 * @param channel - 当前操作针对的 TCP 或 UDP 转发通道。
 * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
 * @returns NATMap 或 UDP 保活器的期望状态与运行状态标签；通道缺失时返回占位文本。
 */
function renderMechanismState(
  channel: null | SystemNetworkApi.PortForwardChannel,
  protocol: SystemNetworkApi.Protocol,
) {
  if (!channel) return '—';
  if (protocol === 'tcp') {
    return (
      <Space size={4}>
        <Tag
          color={(() => {
            if (channel.natmapDesiredEnabled) {
              return 'blue';
            }
            return 'default';
          })()}
        >
          {(() => {
            if (channel.natmapDesiredEnabled) {
              return $t('system.network.desiredOn');
            }
            return $t('system.network.desiredOff');
          })()}
        </Tag>
        <Tag color={natmapStatusColors[channel.natmapStatus]}>
          {natmapStatusLabels[channel.natmapStatus]}
        </Tag>
      </Space>
    );
  }
  return (
    <Space size={4}>
      <Tag
        color={(() => {
          if (channel.keeperDesiredEnabled) {
            return 'blue';
          }
          return 'default';
        })()}
      >
        {(() => {
          if (channel.keeperDesiredEnabled) {
            return $t('system.network.desiredOn');
          }
          return $t('system.network.desiredOff');
        })()}
      </Tag>
      <Tag color={keeperStatusColors[channel.keeperStatus]}>
        {keeperStatusLabels[channel.keeperStatus]}
      </Tag>
    </Space>
  );
}

/**
 * 把联合协议显示为 `TCP+UDP`，单一协议统一转换为大写。
 *
 * @param mode - 用于选择把联合协议显示为 `TCP+UDP`，单一协议统一转换为大写业务分支的模式。
 * @returns 协议模式对应的本地化文本；未识别模式回退为原始值。
 */
function formatProtocolMode(mode: SystemNetworkApi.ProtocolMode): string {
  if (mode === 'tcp_udp') return 'TCP+UDP';
  return mode.toUpperCase();
}

/**
 * 把 Network Agent 状态映射为 Ant Design 标签颜色，未知状态使用默认色。
 *
 * @param status - Network Agent 的在线、同步、待应用、离线或异常状态。
 * @param unknown - 指示状态探测是否失败、需要显示未知态的标志。
 * @returns 适用于当前状态的把 Network Agent 状态映射为 Ant Design 标签颜色，未知状态使用默认色。
 */
function getAgentStatusColor(
  status: SystemNetworkApi.AgentStatus | undefined,
  unknown: boolean,
): string {
  if (unknown) return 'default';
  if (status?.online) {
    return 'success';
  }
  return 'warning';
}

/**
 * 把 Network Agent 状态映射为中文标签，未知状态直接显示原状态。
 *
 * @param status - Network Agent 的在线、同步、待应用、离线或异常状态。
 * @param unknown - 指示状态探测是否失败、需要显示未知态的标志。
 * @returns Network Agent 状态对应的中文标签；未知状态保留原文。
 */
function getAgentStatusLabel(
  status: SystemNetworkApi.AgentStatus | undefined,
  unknown: boolean,
): string {
  if (unknown) return $t('system.network.agentUnknown');
  if (status?.online) {
    return $t('system.network.agentOnline');
  }
  return $t('system.network.agentOffline');
}
