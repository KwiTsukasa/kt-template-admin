import type { TableColumnType } from 'antdv-next';

import type { BotApi } from '#/api/bot';
import type { KtTableApi } from '#/components/kt-table';

import { defineComponent } from 'vue';

import { Page } from '@vben/common-ui';

import { Tag } from 'antdv-next';

import { getBotConversationList } from '#/api/bot';
import { KtTable, useKtTable } from '#/components/kt-table';

import { botMessageTypeOptions, getOptionLabel } from '../modules/options';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'BotConversationList',
  setup() {
    const columns: Array<TableColumnType<BotApi.Conversation>> = [
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
    const api: KtTableApi<BotApi.Conversation> = {
      list: async (params) => await getBotConversationList(params),
    };
    const [registerTable] = useKtTable<BotApi.Conversation>({
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
              options: botMessageTypeOptions,
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
              const row = record as BotApi.Conversation;
              if (column.key === 'targetType') {
                return (
                  <Tag
                    color={(() => {
                      if (row.targetType === 'group') {
                        return 'blue';
                      }
                      return 'green';
                    })()}
                  >
                    {getOptionLabel(botMessageTypeOptions, row.targetType)}
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
