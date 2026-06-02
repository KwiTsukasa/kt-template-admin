import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type { KtTableApi, KtTableButton } from '#/components/ktTable';

import { defineComponent, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { message, Tag } from 'antdv-next';

import {
  getQqbotPluginHealth,
  getQqbotPluginList,
  getQqbotPluginOperationList,
} from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'QqBotPluginList',
  setup() {
    const pluginOptions = ref<Array<{ label: string; value: string }>>([]);
    const pluginMap = ref<Record<string, QqbotApi.Plugin>>({});

    const columns: Array<TableColumnType<QqbotApi.PluginOperation>> = [
      { dataIndex: 'pluginKey', key: 'pluginKey', title: '插件', width: 160 },
      { dataIndex: 'key', key: 'key', title: '能力 Key', width: 220 },
      { dataIndex: 'name', key: 'name', title: '能力名称', width: 160 },
      {
        dataIndex: 'description',
        key: 'description',
        title: '说明',
        width: 360,
      },
      {
        dataIndex: 'cacheTtlMs',
        key: 'cacheTtlMs',
        title: '建议缓存',
        width: 120,
      },
    ];
    const api: KtTableApi<QqbotApi.PluginOperation> = {
      list: async (params) =>
        await getQqbotPluginOperationList(params.pluginKey),
    };
    const buttons: Array<KtTableButton<QqbotApi.PluginOperation>> = [
      {
        key: 'health',
        label: '健康检查',
        onClick: async () => {
          const health = await getQqbotPluginHealth();
          const content = health
            .map((item) => `${item.status}: ${item.message || 'OK'}`)
            .join('；');
          message.success(content || '插件健康检查完成');
        },
      },
    ];
    const [registerTable] = useKtTable<QqbotApi.PluginOperation>({
      api,
      buttons,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Select',
            componentProps: () => ({
              allowClear: true,
              options: pluginOptions.value,
            }),
            fieldName: 'pluginKey',
            label: '插件',
          },
        ],
      },
      showSelection: false,
      tableTitle: '插件能力',
    });

    onMounted(() => {
      void loadPlugins();
    });

    async function loadPlugins() {
      const plugins = await getQqbotPluginList();
      const nextPluginMap: Record<string, QqbotApi.Plugin> = {};
      for (const item of plugins) {
        nextPluginMap[item.key] = item;
      }
      pluginMap.value = nextPluginMap;
      pluginOptions.value = plugins.map((item) => ({
        label: `${item.name} (${item.key})`,
        value: item.key,
      }));
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as QqbotApi.PluginOperation;
              if (column.key === 'pluginKey') {
                const plugin = pluginMap.value[row.pluginKey];
                return plugin ? (
                  <Tag color="processing">
                    {plugin.name} v{plugin.version}
                  </Tag>
                ) : (
                  row.pluginKey
                );
              }
              if (column.key === 'cacheTtlMs') {
                return row.cacheTtlMs ? `${row.cacheTtlMs} ms` : '-';
              }
              return undefined;
            },
          }}
        />
      </Page>
    );
  },
});
