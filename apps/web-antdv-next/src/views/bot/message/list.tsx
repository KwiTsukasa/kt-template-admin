import type { TableColumnType } from 'antdv-next';

import type { BotApi } from '#/api/bot';
import type { KtTableApi } from '#/components/kt-table';

import { defineComponent } from 'vue';

import { Page } from '@vben/common-ui';

import { Tag } from 'antdv-next';

import { getBotMessageList } from '#/api/bot';
import { KtTable, useKtTable } from '#/components/kt-table';

import { botMessageTypeOptions, getOptionLabel } from '../modules/options';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'BotMessageList',
  setup() {
    const columns: Array<TableColumnType<BotApi.Message>> = [
      { dataIndex: 'selfId', key: 'selfId', title: 'Self ID', width: 150 },
      {
        dataIndex: 'messageType',
        key: 'messageType',
        title: '消息类型',
        width: 110,
      },
      { dataIndex: 'direction', key: 'direction', title: '方向', width: 100 },
      { dataIndex: 'targetId', key: 'targetId', title: '目标 ID', width: 150 },
      { dataIndex: 'userId', key: 'userId', title: '用户 ID', width: 150 },
      {
        dataIndex: 'senderNickname',
        key: 'senderNickname',
        title: '发送人',
        width: 150,
      },
      {
        dataIndex: 'messageText',
        key: 'messageText',
        title: '消息内容',
        width: 420,
      },
      {
        dataIndex: 'eventTime',
        key: 'eventTime',
        title: '消息时间',
        width: 190,
      },
    ];
    const api: KtTableApi<BotApi.Message> = {
      list: async (params) => await getBotMessageList(params),
    };
    const [registerTable] = useKtTable<BotApi.Message>({
      api,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: { allowClear: true, placeholder: '关键词' },
            fieldName: 'keyword',
            label: '关键词',
          },
          {
            component: 'Input',
            componentProps: { allowClear: true, placeholder: 'Self ID' },
            fieldName: 'selfId',
            label: 'Self ID',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: botMessageTypeOptions,
            },
            fieldName: 'targetType',
            label: '消息类型',
          },
          {
            component: 'Input',
            componentProps: { allowClear: true, placeholder: '目标 ID' },
            fieldName: 'targetId',
            label: '目标 ID',
          },
        ],
      },
      rowActions: [],
      tableTitle: '消息日志',
    });

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as BotApi.Message;
              if (column.key === 'messageType') {
                return (
                  <Tag
                    color={(() => {
                      if (row.messageType === 'group') {
                        return 'blue';
                      }
                      return 'green';
                    })()}
                  >
                    {getOptionLabel(botMessageTypeOptions, row.messageType)}
                  </Tag>
                );
              }
              if (column.key === 'direction') {
                return (
                  <Tag
                    color={(() => {
                      if (row.direction === 'inbound') {
                        return 'default';
                      }
                      return 'processing';
                    })()}
                  >
                    {(() => {
                      if (row.direction === 'inbound') {
                        return '接收';
                      }
                      return '发送';
                    })()}
                  </Tag>
                );
              }
              return undefined;
            },
          }}
        />
      </Page>
    );
  },
});
