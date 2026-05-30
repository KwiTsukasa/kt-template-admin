import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type { KtTableApi } from '#/components/ktTable';

import { defineComponent } from 'vue';

import { Page } from '@vben/common-ui';

import { Tag } from 'antdv-next';

import { getQqbotMessageList } from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

import { getOptionLabel, qqbotMessageTypeOptions } from '../modules/options';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'QqBotMessageList',
  setup() {
    const columns: Array<TableColumnType<QqbotApi.Message>> = [
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
    const api: KtTableApi<QqbotApi.Message> = {
      list: async (params) => await getQqbotMessageList(params),
    };
    const [registerTable] = useKtTable<QqbotApi.Message>({
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
              options: qqbotMessageTypeOptions,
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
              const row = record as QqbotApi.Message;
              if (column.key === 'messageType') {
                return (
                  <Tag color={row.messageType === 'group' ? 'blue' : 'green'}>
                    {getOptionLabel(qqbotMessageTypeOptions, row.messageType)}
                  </Tag>
                );
              }
              if (column.key === 'direction') {
                return (
                  <Tag
                    color={
                      row.direction === 'inbound' ? 'default' : 'processing'
                    }
                  >
                    {row.direction === 'inbound' ? '接收' : '发送'}
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
