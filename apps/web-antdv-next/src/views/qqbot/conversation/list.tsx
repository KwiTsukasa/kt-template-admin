import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type { KtTableApi } from '#/components/ktTable';

import { defineComponent } from 'vue';

import { Page } from '@vben/common-ui';

import { Tag } from 'antdv-next';

import { getQqbotConversationList } from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

import { getOptionLabel, qqbotMessageTypeOptions } from '../modules/options';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'QqBotConversationList',
  setup() {
    const columns: Array<TableColumnType<QqbotApi.Conversation>> = [
      { dataIndex: 'selfId', key: 'selfId', title: 'Self ID', width: 150 },
      {
        dataIndex: 'targetType',
        key: 'targetType',
        title: '会话类型',
        width: 110,
      },
      { dataIndex: 'targetId', key: 'targetId', title: '目标 ID', width: 160 },
      { dataIndex: 'targetName', key: 'targetName', title: '名称', width: 160 },
      {
        dataIndex: 'lastMessageText',
        key: 'lastMessageText',
        title: '最后消息',
        width: 360,
      },
      {
        dataIndex: 'messageCount',
        key: 'messageCount',
        title: '消息数',
        width: 100,
      },
      {
        dataIndex: 'lastMessageTime',
        key: 'lastMessageTime',
        title: '最后时间',
        width: 190,
      },
    ];
    const api: KtTableApi<QqbotApi.Conversation> = {
      list: async (params) => await getQqbotConversationList(params),
    };
    const [registerTable] = useKtTable<QqbotApi.Conversation>({
      api,
      columns,
      formOptions: {
        schema: [
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
            label: '会话类型',
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
      tableTitle: '会话管理',
    });

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as QqbotApi.Conversation;
              if (column.key === 'targetType') {
                return (
                  <Tag color={row.targetType === 'group' ? 'blue' : 'green'}>
                    {getOptionLabel(qqbotMessageTypeOptions, row.targetType)}
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
