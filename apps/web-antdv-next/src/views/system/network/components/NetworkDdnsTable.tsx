import type { TableColumnType } from 'antdv-next';

import type { NetworkDdnsRecordModalExposed } from './NetworkDdnsRecordModal';

import type { SystemNetworkApi } from '#/api/system/network';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/kt-table';

import { defineComponent, ref } from 'vue';

import { Plus } from '@vben/icons';

import { message, Space, Tag, Typography } from 'antdv-next';

import {
  deleteNetworkDdnsRecord,
  getNetworkDdnsList,
  getNetworkDdnsProviderStatus,
  retryNetworkDdnsRecord,
} from '#/api/system/network';
import { KtTable, useKtTable } from '#/components/kt-table';
import { $t } from '#/locales';

import NetworkDdnsRecordModal from './NetworkDdnsRecordModal';

const AKtTable = KtTable as any;
const ATypographyText = Typography.Text as any;
const recordTypeOptions = [
  { label: 'A (IPv4)', value: 'A' },
  { label: 'AAAA (IPv6)', value: 'AAAA' },
];
const syncStatusOptions = [
  { label: $t('system.network.ddnsStatusPending'), value: 'pending' },
  { label: $t('system.network.ddnsStatusSyncing'), value: 'syncing' },
  { label: $t('system.network.ddnsStatusSynced'), value: 'synced' },
  {
    label: $t('system.network.ddnsStatusWaitingSource'),
    value: 'waiting_source',
  },
  { label: $t('system.network.ddnsStatusFailed'), value: 'failed' },
  { label: $t('system.network.ddnsStatusDisabled'), value: 'disabled' },
];
const syncStatusColors: Record<SystemNetworkApi.DdnsSyncStatus, string> = {
  disabled: 'default',
  failed: 'error',
  pending: 'processing',
  synced: 'success',
  syncing: 'processing',
  waiting_source: 'warning',
};
const syncStatusLabels: Record<SystemNetworkApi.DdnsSyncStatus, string> = {
  disabled: $t('system.network.ddnsStatusDisabled'),
  failed: $t('system.network.ddnsStatusFailed'),
  pending: $t('system.network.ddnsStatusPending'),
  synced: $t('system.network.ddnsStatusSynced'),
  syncing: $t('system.network.ddnsStatusSyncing'),
  waiting_source: $t('system.network.ddnsStatusWaitingSource'),
};

export interface NetworkDdnsTableExposed {
  reload: () => Promise<void>;
}

export default defineComponent({
  name: 'NetworkDdnsTable',
  setup(_, { expose }) {
    const busyRowIds = ref<Set<string>>(new Set());
    const modalRef = ref<NetworkDdnsRecordModalExposed>();
    const providerStatus = ref<SystemNetworkApi.DdnsProviderStatus>();
    const providerStatusUnknown = ref(true);
    const columns: Array<TableColumnType<SystemNetworkApi.DdnsRecord>> = [
      {
        key: 'identity',
        title: $t('system.network.ddnsRecord'),
        width: 230,
      },
      {
        key: 'source',
        title: $t('system.network.ddnsSource'),
        width: 210,
      },
      {
        dataIndex: 'sourceAddress',
        key: 'sourceAddress',
        title: $t('system.network.rawEndpoint'),
        width: 210,
      },
      {
        dataIndex: 'appliedAddress',
        key: 'appliedAddress',
        title: $t('system.network.dnsAddress'),
        width: 210,
      },
      {
        dataIndex: 'accessEndpoint',
        key: 'accessEndpoint',
        title: $t('system.network.accessEndpoint'),
        width: 230,
      },
      {
        dataIndex: 'syncStatus',
        key: 'syncStatus',
        title: $t('system.network.ddnsSyncStatus'),
        width: 120,
      },
      {
        key: 'lastSync',
        title: $t('system.network.ddnsLastSync'),
        width: 260,
      },
      {
        dataIndex: 'updateTime',
        key: 'updateTime',
        title: $t('system.network.updateTime'),
        width: 180,
      },
    ];
    const api: KtTableApi<SystemNetworkApi.DdnsRecord> = {
      list: async (params) => await getNetworkDdnsList(params),
    };
    const buttons: Array<KtTableButton<SystemNetworkApi.DdnsRecord>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: $t('system.network.ddnsCreateAction'),
        onClick: openCreate,
        permissionCodes: ['System:Network:Ddns:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<KtTableRowAction<SystemNetworkApi.DdnsRecord>> = [
      {
        disabled: (row) => isRowBusy(row),
        disabledReason: (row) => {
          if (isRowBusy(row)) {
            return $t('system.network.operationInProgress');
          }
          return undefined;
        },
        key: 'edit',
        label: $t('system.network.editAction'),
        onClick: openEdit,
        permissionCodes: ['System:Network:Ddns:Update'],
      },
      {
        disabled: (row) => isRowBusy(row) || !!getDdnsRetryDisabledReason(row),
        disabledReason: (row) => {
          if (isRowBusy(row)) {
            return $t('system.network.operationInProgress');
          }
          return getDdnsRetryDisabledReason(row);
        },
        key: 'retry',
        label: $t('system.network.ddnsRetryAction'),
        onClick: async (row) => {
          await runRowMutation(
            row,
            retryNetworkDdnsRecord,
            $t('system.network.ddnsRetrySubmitted'),
          );
        },
        permissionCodes: ['System:Network:Ddns:Retry'],
      },
      {
        confirm: () => $t('system.network.ddnsDeleteConfirm'),
        danger: true,
        disabled: (row) => isRowBusy(row),
        disabledReason: (row) => {
          if (isRowBusy(row)) {
            return $t('system.network.operationInProgress');
          }
          return undefined;
        },
        key: 'delete',
        label: $t('system.network.deleteAction'),
        onClick: async (row) => {
          await runRowMutation(
            row,
            deleteNetworkDdnsRecord,
            $t('system.network.ddnsDeleteSubmitted'),
          );
        },
        permissionCodes: ['System:Network:Ddns:Delete'],
      },
    ];
    const [registerTable, tableApi] = useKtTable<SystemNetworkApi.DdnsRecord>({
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
              options: recordTypeOptions,
            },
            fieldName: 'recordType',
            label: $t('system.network.ddnsRecordType'),
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: syncStatusOptions,
            },
            fieldName: 'syncStatus',
            label: $t('system.network.ddnsSyncStatus'),
          },
        ],
      },
      immediate: false,
      rowActions,
      rowActionVisibleCount: 2,
      rowKey: 'id',
      tableTitle: $t('system.network.ddnsTitle'),
    });

    /**
     * 通过 DDNS 记录弹窗组件打开新建会话。
     */
    function openCreate() {
      modalRef.value?.openCreate();
    }

    /**
     * 仅在 DDNS 记录没有进行中操作时，把该记录交给弹窗编辑。
     *
     * @param row - 要传给 DDNS 编辑弹窗的记录。
     */
    function openEdit(row: SystemNetworkApi.DdnsRecord) {
      if (!isRowBusy(row)) modalRef.value?.openEdit(row);
    }

    /**
     * 当DDNS 记录保存后触发表格刷新。
     */
    function handleModalSaved() {
      void reload();
    }

    /**
     * 串行执行 DDNS 行变更；占用行直接忽略，成功后提示并并行刷新记录与提供商状态。
     *
     * @param row - 要执行重试、切换或删除操作的 DDNS 记录。
     * @param mutation - 接收 DDNS 记录标识并执行后端变更的异步函数。
     * @param successMessage - 操作成功后显示给用户的提示文本。
     */
    async function runRowMutation(
      row: SystemNetworkApi.DdnsRecord,
      mutation: (id: string) => Promise<unknown>,
      successMessage: string,
    ) {
      if (isRowBusy(row)) return;
      setRowBusy(row.id, true);
      try {
        await mutation(row.id);
        message.success(successMessage);
        await reload();
      } finally {
        setRowBusy(row.id, false);
      }
    }

    /**
     * 以不可变 Set 更新 DDNS 行占用标识，避免并发操作复用旧集合引用。
     *
     * @param id - 需要加入或移出忙碌集合的 DDNS 记录标识。
     * @param busy - 当前记录是否正在执行异步操作。
     */
    function setRowBusy(id: string, busy: boolean) {
      const next = new Set(busyRowIds.value);
      if (busy) next.add(id);
      else next.delete(id);
      busyRowIds.value = next;
    }

    /**
     * 通过检查 DDNS 记录是否正在重试、切换或删除，以统一控制行操作加载态。
     *
     * @param row - 需要按标识检查重试、切换或删除进行状态的 DDNS 记录。
     * @returns DDNS 记录正在重试、切换或删除时返回 true，否则返回 false。
     */
    function isRowBusy(row: SystemNetworkApi.DdnsRecord): boolean {
      return busyRowIds.value.has(row.id);
    }

    /**
     * 探测 DDNS 提供商配置状态；请求失败时标记状态未知而不清空旧值。
     */
    async function loadProviderStatus() {
      try {
        providerStatus.value = await getNetworkDdnsProviderStatus();
        providerStatusUnknown.value = false;
      } catch {
        providerStatusUnknown.value = true;
      }
    }

    /**
     * 并行刷新 DDNS 记录表格与提供商配置状态，单项失败不阻断另一项。
     */
    async function reload(): Promise<void> {
      await Promise.allSettled([tableApi.reload(), loadProviderStatus()]);
    }

    /**
     * 根据 DDNS 提供商的未知、未就绪或已配置状态渲染对应标签。
     *
     * @returns 表示 DDNS 提供商未知、未就绪或已配置状态的标签节点。
     */
    function renderProviderStatus() {
      const status = providerStatus.value;
      let color = 'warning';
      let label = $t('system.network.ddnsProviderUnavailable');
      if (providerStatusUnknown.value) {
        color = 'default';
        label = $t('system.network.ddnsProviderUnknown');
      } else if (status?.enabled && status.configured) {
        color = 'success';
        label = $t('system.network.ddnsProviderReady');
      }
      return (
        <Space wrap>
          <Tag color={color}>
            {$t('system.network.ddnsProviderName')}: {label}
          </Tag>
        </Space>
      );
    }

    /**
     * 根据列键渲染 DDNS 标识、来源、地址、同步状态或失败信息；其他列返回 undefined。
     *
     * @returns DDNS 标识、来源、地址、同步状态或失败信息节点；其他列返回 undefined。
     */
    function renderBodyCell({ column, record }: any) {
      const row = record as SystemNetworkApi.DdnsRecord;
      if (column.key === 'identity') {
        return (
          <Space orientation="vertical" size={0}>
            <Space size={4}>
              <ATypographyText strong>{row.name}</ATypographyText>
              <Tag
                color={(() => {
                  if (row.recordType === 'AAAA') {
                    return 'purple';
                  }
                  return 'blue';
                })()}
              >
                {row.recordType}
              </Tag>
            </Space>
            <ATypographyText type="secondary">{row.fqdn}</ATypographyText>
          </Space>
        );
      }
      if (column.key === 'source') {
        return row.source.name;
      }
      if (column.key === 'sourceAddress') {
        return getDdnsRawEndpoint(row);
      }
      if (column.key === 'appliedAddress') {
        return row.appliedAddress || '—';
      }
      if (column.key === 'accessEndpoint') {
        return row.accessEndpoint || '—';
      }
      if (column.key === 'syncStatus') {
        return (
          <Tag color={syncStatusColors[row.syncStatus]}>
            {syncStatusLabels[row.syncStatus]}
          </Tag>
        );
      }
      if (column.key === 'lastSync') {
        if (row.lastErrorMessage) {
          return `${row.lastErrorCode || '-'} · ${row.lastErrorMessage}`;
        }
        const retry = (() => {
          if (row.nextRetryAt) {
            return ` · ${$t('system.network.ddnsNextRetry')}: ${row.nextRetryAt}`;
          }
          return '';
        })();
        return `${row.lastSyncedAt || '-'}${retry}`;
      }
      return undefined;
    }

    expose({ reload } satisfies NetworkDdnsTableExposed);

    return () => (
      <>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: renderBodyCell,
            headerControls: renderProviderStatus,
          }}
        />
        <NetworkDdnsRecordModal onSaved={handleModalSaved} ref={modalRef} />
      </>
    );
  },
});

/**
 * 当 DDNS 已停用、正在同步、来源不可用或地址缺失时返回重试禁用原因。
 *
 * @param row - 需要核对启用、同步、来源资格和地址状态的 DDNS 记录。
 * @returns DDNS 停用、同步中、来源不可用或地址缺失时对应的原因；可重试时返回 undefined。
 */
export function getDdnsRetryDisabledReason(
  row: SystemNetworkApi.DdnsRecord,
): string | undefined {
  if (!row.enabled) return $t('system.network.ddnsRetryDisabled');
  if (row.syncStatus === 'syncing') {
    return $t('system.network.ddnsSyncInProgress');
  }
  if (!row.source.eligible) {
    if (row.source.disabledReasonCode) {
      return `${$t('system.network.ddnsSourceUnavailable')}: ${
        row.source.disabledReasonCode
      }`;
    }
    return $t('system.network.ddnsSourceUnavailable');
  }
  if (!row.source.currentAddress) {
    return $t('system.network.ddnsSourceAddressMissing');
  }
  return undefined;
}

/**
 * 从 DDNS 记录中提取未经 DNS 解析的原始公网端点，缺失时返回空字符串。
 *
 * @param row - 需要组合当前来源地址与端口的 DDNS 记录。
 * @returns DDNS 记录的原始公网端点；记录未上报时为空字符串。
 */
function getDdnsRawEndpoint(row: SystemNetworkApi.DdnsRecord): string {
  const address = row.source.currentAddress || row.sourceAddress;
  if (!address) return '—';
  if (row.source.currentPort) {
    return `${address}:${row.source.currentPort}`;
  }
  return address;
}
