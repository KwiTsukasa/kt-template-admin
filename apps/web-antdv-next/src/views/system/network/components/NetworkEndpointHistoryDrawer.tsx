import type { TableColumnType } from 'antdv-next';

import type { SystemNetworkApi } from '#/api/system/network';
import type { KtTableApi } from '#/components/kt-table';

import { computed, defineComponent, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Tag } from 'antdv-next';

import { getNetworkPortForwardChannelEndpointHistory } from '#/api/system/network';
import { KtTable, useKtTable } from '#/components/kt-table';
import { $t } from '#/locales';

export interface NetworkEndpointHistoryDrawerExposed {
  open: (
    row: SystemNetworkApi.PortForwardGroup,
    protocol: SystemNetworkApi.Protocol,
  ) => void;
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
  setup(_, { expose }) {
    const selectedProtocol = ref<SystemNetworkApi.Protocol>();
    const selectedRow = ref<SystemNetworkApi.PortForwardGroup>();
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
        dataIndex: 'mechanism',
        key: 'mechanism',
        title: $t('system.network.endpointMechanism'),
        width: 130,
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
      list: async (params) => {
        if (!selectedRow.value || !selectedProtocol.value) {
          return { items: [], total: 0 };
        }
        return await getNetworkPortForwardChannelEndpointHistory(
          selectedRow.value.id,
          selectedProtocol.value,
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
    const drawerTitle = computed(() => {
      if (selectedRow.value) {
        return `${$t('system.network.endpointHistory')} · ${
          selectedRow.value.name
        } / ${selectedProtocol.value?.toUpperCase()}`;
      }
      return $t('system.network.endpointHistory');
    });
    const [Drawer, drawerApi] = useVbenDrawer({
      class: 'w-[860px]',
      destroyOnClose: true,
      footer: false,
      /**
       * 当端点历史抽屉打开后加载最新历史记录。
       */
      onOpened() {
        void tableApi.reload();
      },
    });

    /**
     * 保存端口转发记录与协议，并打开对应端点历史抽屉。
     *
     * @param row - 要查询端点历史的端口转发分组。
     * @param protocol - 目标端口转发通道的 TCP 或 UDP 协议。
     */
    function open(
      row: SystemNetworkApi.PortForwardGroup,
      protocol: SystemNetworkApi.Protocol,
    ) {
      selectedRow.value = row;
      selectedProtocol.value = protocol;
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
              if (column.key === 'mechanism') {
                return (
                  <Tag
                    color={(() => {
                      if (item.mechanism === 'tcp_natmap') {
                        return 'purple';
                      }
                      return 'blue';
                    })()}
                  >
                    {(() => {
                      if (item.mechanism === 'tcp_natmap') {
                        return 'TCP NATMap';
                      }
                      return 'UDP STUN';
                    })()}
                  </Tag>
                );
              }
              if (column.key === 'publicEndpoint') {
                if (item.publicIpv4 && item.publicPort) {
                  return `${item.publicIpv4}:${item.publicPort}`;
                }
                return '-';
              }
              return undefined;
            },
          }}
        />
      </Drawer>
    );
  },
});
