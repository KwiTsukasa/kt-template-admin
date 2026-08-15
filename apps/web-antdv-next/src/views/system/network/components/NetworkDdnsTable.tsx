import type { TableColumnType } from 'antdv-next';

import type { NetworkDdnsRecordModalExposed } from './NetworkDdnsRecordModal';

import type { SystemNetworkApi } from '#/api/system/network';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { defineComponent, ref } from 'vue';

import { Plus } from '@vben/icons';

import { message, Space, Tag, Typography } from 'antdv-next';

import {
  deleteNetworkDdnsRecord,
  getNetworkDdnsList,
  getNetworkDdnsProviderStatus,
  retryNetworkDdnsRecord,
} from '#/api/system/network';
import { KtTable, useKtTable } from '#/components/ktTable';
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
        disabledReason: (row) =>
          isRowBusy(row) ? $t('system.network.operationInProgress') : undefined,
        key: 'edit',
        label: $t('system.network.editAction'),
        onClick: openEdit,
        permissionCodes: ['System:Network:Ddns:Update'],
      },
      {
        disabled: (row) => isRowBusy(row) || !!getDdnsRetryDisabledReason(row),
        disabledReason: (row) =>
          isRowBusy(row)
            ? $t('system.network.operationInProgress')
            : getDdnsRetryDisabledReason(row),
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
        disabledReason: (row) =>
          isRowBusy(row) ? $t('system.network.operationInProgress') : undefined,
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

    function openCreate() {
      modalRef.value?.openCreate();
    }

    function openEdit(row: SystemNetworkApi.DdnsRecord) {
      if (!isRowBusy(row)) modalRef.value?.openEdit(row);
    }

    function handleModalSaved() {
      void reload();
    }

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

    function setRowBusy(id: string, busy: boolean) {
      const next = new Set(busyRowIds.value);
      if (busy) next.add(id);
      else next.delete(id);
      busyRowIds.value = next;
    }

    function isRowBusy(row: SystemNetworkApi.DdnsRecord): boolean {
      return busyRowIds.value.has(row.id);
    }

    async function loadProviderStatus() {
      try {
        providerStatus.value = await getNetworkDdnsProviderStatus();
        providerStatusUnknown.value = false;
      } catch {
        providerStatusUnknown.value = true;
      }
    }

    async function reload(): Promise<void> {
      await Promise.allSettled([tableApi.reload(), loadProviderStatus()]);
    }

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

    function renderBodyCell({ column, record }: any) {
      const row = record as SystemNetworkApi.DdnsRecord;
      if (column.key === 'identity') {
        return (
          <Space orientation="vertical" size={0}>
            <Space size={4}>
              <ATypographyText strong>{row.name}</ATypographyText>
              <Tag color={row.recordType === 'AAAA' ? 'purple' : 'blue'}>
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
        const retry = row.nextRetryAt
          ? ` · ${$t('system.network.ddnsNextRetry')}: ${row.nextRetryAt}`
          : '';
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

export function getDdnsRetryDisabledReason(
  row: SystemNetworkApi.DdnsRecord,
): string | undefined {
  if (!row.enabled) return $t('system.network.ddnsRetryDisabled');
  if (row.syncStatus === 'syncing') {
    return $t('system.network.ddnsSyncInProgress');
  }
  if (!row.source.eligible) {
    return row.source.disabledReasonCode
      ? `${$t('system.network.ddnsSourceUnavailable')}: ${
          row.source.disabledReasonCode
        }`
      : $t('system.network.ddnsSourceUnavailable');
  }
  if (!row.source.currentAddress) {
    return $t('system.network.ddnsSourceAddressMissing');
  }
  return undefined;
}

function getDdnsRawEndpoint(row: SystemNetworkApi.DdnsRecord): string {
  const address = row.source.currentAddress || row.sourceAddress;
  if (!address) return '—';
  return row.source.currentPort
    ? `${address}:${row.source.currentPort}`
    : address;
}
