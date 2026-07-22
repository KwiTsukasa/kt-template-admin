import type { TableColumnType } from 'antdv-next';

import type { SystemNetworkApi } from '#/api/system/network';
import type { KtTableApi } from '#/components/ktTable';

import { computed, defineComponent, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Tag } from 'antdv-next';

import { getNetworkPortForwardEndpointHistory } from '#/api/system/network';
import { KtTable, useKtTable } from '#/components/ktTable';
import { $t } from '#/locales';

export interface NetworkEndpointHistoryDrawerExposed {
  open: (row: SystemNetworkApi.PortForward) => void;
}

const AKtTable = KtTable as any;
const eventColors: Record<SystemNetworkApi.EndpointEventType, string> = {
  changed: 'warning',
  published: 'success',
  restored: 'processing',
  withdrawn: 'default',
};

export default defineComponent({
  name: 'NetworkEndpointHistoryDrawer',
  /** Creates a lazy, record-scoped history table inside a disposable drawer. */
  setup(_, { expose }) {
    const selectedRow = ref<SystemNetworkApi.PortForward>();
    const columns: Array<
      TableColumnType<SystemNetworkApi.EndpointHistoryItem>
    > = [
      {
        dataIndex: 'eventType',
        key: 'eventType',
        title: $t('system.network.historyEvent'),
        width: 110,
      },
      {
        key: 'publicEndpoint',
        title: $t('system.network.publicEndpoint'),
        width: 190,
      },
      {
        dataIndex: 'firstObservedAt',
        key: 'firstObservedAt',
        title: $t('system.network.firstObservedAt'),
        width: 190,
      },
      {
        dataIndex: 'lastObservedAt',
        key: 'lastObservedAt',
        title: $t('system.network.lastObservedAt'),
        width: 190,
      },
      {
        dataIndex: 'withdrawalReason',
        key: 'withdrawalReason',
        title: $t('system.network.withdrawalReason'),
        width: 220,
      },
    ];
    const api: KtTableApi<SystemNetworkApi.EndpointHistoryItem> = {
      /** Loads only the selected mapping's append-only endpoint transitions. */
      list: async (params) => {
        if (!selectedRow.value) return { items: [], total: 0 };
        return await getNetworkPortForwardEndpointHistory(
          selectedRow.value.id,
          {
            pageNo: Number(params.pageNo || params.page || 1),
            pageSize: Number(params.pageSize || 10),
          },
        );
      },
    };
    const [registerTable, tableApi] =
      useKtTable<SystemNetworkApi.EndpointHistoryItem>({
        api,
        columns,
        immediate: false,
        pageSize: 10,
        rowKey: 'eventId',
        showDefaultButtons: false,
        showIndex: false,
        tableSettings: {
          column: true,
          density: true,
          fullscreen: false,
          reload: true,
          showSearch: false,
        },
        tableTitle: $t('system.network.endpointHistory'),
      });
    const drawerTitle = computed(() =>
      selectedRow.value
        ? `${$t('system.network.endpointHistory')} · ${selectedRow.value.name}`
        : $t('system.network.endpointHistory'),
    );
    const [Drawer, drawerApi] = useVbenDrawer({
      class: 'w-[860px]',
      destroyOnClose: true,
      footer: false,
      onOpened() {
        void tableApi.reload();
      },
    });

    /**
     * Opens history for one mapping and discards rows from the prior selection.
     * @param row - Mapping whose append-only history should be queried.
     */
    function open(row: SystemNetworkApi.PortForward) {
      selectedRow.value = row;
      drawerApi.open();
    }

    expose({ open } satisfies NetworkEndpointHistoryDrawerExposed);

    return () => (
      <Drawer title={drawerTitle.value}>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const item = record as SystemNetworkApi.EndpointHistoryItem;
              if (column.key === 'eventType') {
                return (
                  <Tag color={eventColors[item.eventType]}>
                    {item.eventType}
                  </Tag>
                );
              }
              if (column.key === 'publicEndpoint') {
                return item.publicIpv4 && item.publicPort
                  ? `${item.publicIpv4}:${item.publicPort}`
                  : '-';
              }
              return undefined;
            },
          }}
        />
      </Drawer>
    );
  },
});
