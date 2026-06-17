import type { TableColumnType } from 'antdv-next';

import type { QqbotPluginTaskApi } from '#/api/qqbot/plugin-task';
import type { KtTableApi, KtTableRowAction } from '#/components/ktTable';

import { defineComponent, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { message, Tag } from 'antdv-next';

import {
  disableQqbotPluginTask,
  enableQqbotPluginTask,
  getQqbotPluginTaskPage,
  runQqbotPluginTaskOnce,
} from '#/api/qqbot/plugin-task';
import { KtTable, useKtTable } from '#/components/ktTable';

import TaskCronModal from './components/TaskCronModal';
import TaskRunDrawer from './components/TaskRunDrawer';

const AKtTable = KtTable as any;

const runtimeStatusColor: Record<QqbotPluginTaskApi.RuntimeStatus, string> = {
  disabled: 'default',
  failed: 'error',
  idle: 'default',
  running: 'processing',
  scheduled: 'success',
};

const runStatusColor: Record<QqbotPluginTaskApi.RunStatus, string> = {
  failed: 'error',
  running: 'processing',
  skipped: 'default',
  success: 'success',
};

export default defineComponent({
  name: 'QqBotPluginTaskList',
  setup() {
    const cronModalOpen = ref(false);
    const cronTask = ref<QqbotPluginTaskApi.Task>();
    const runDrawerOpen = ref(false);
    const runTask = ref<QqbotPluginTaskApi.Task>();

    const columns: Array<TableColumnType<QqbotPluginTaskApi.Task>> = [
      { dataIndex: 'pluginName', key: 'pluginName', title: '插件', width: 160 },
      { dataIndex: 'taskKey', key: 'taskKey', title: '任务 Key', width: 260 },
      { dataIndex: 'taskName', key: 'taskName', title: '任务名称', width: 180 },
      {
        dataIndex: 'cronExpression',
        key: 'cronExpression',
        title: 'Cron',
        width: 150,
      },
      { dataIndex: 'enabled', key: 'enabled', title: '启用', width: 90 },
      {
        dataIndex: 'runtimeStatus',
        key: 'runtimeStatus',
        title: '运行状态',
        width: 120,
      },
      {
        dataIndex: 'lastStatus',
        key: 'lastStatus',
        title: '最近结果',
        width: 120,
      },
      {
        dataIndex: 'nextRunAt',
        key: 'nextRunAt',
        title: '下次运行',
        width: 180,
      },
    ];
    const api: KtTableApi<QqbotPluginTaskApi.Task> = {
      list: async (params) => await getQqbotPluginTaskPage(params),
    };
    const rowActions: Array<KtTableRowAction<QqbotPluginTaskApi.Task>> = [
      {
        key: 'run',
        label: '运行一次',
        onClick: async (row, context) => {
          await runQqbotPluginTaskOnce(row.id, {});
          message.success('任务已提交');
          await context.reload();
        },
        permissionCodes: ['QqBot:PluginTask:Run'],
      },
      {
        key: 'cron',
        label: '修改 Cron',
        onClick: (row) => {
          cronTask.value = row;
          cronModalOpen.value = true;
        },
        permissionCodes: ['QqBot:PluginTask:UpdateCron'],
      },
      {
        key: 'runs',
        label: '运行记录',
        onClick: (row) => {
          runTask.value = row;
          runDrawerOpen.value = true;
        },
        permissionCodes: ['QqBot:PluginTask:RunLog'],
      },
      {
        key: 'toggle',
        label: '启停',
        onClick: async (row, context) => {
          if (row.enabled) {
            await disableQqbotPluginTask(row.id);
            message.success('任务已停用');
          } else {
            await enableQqbotPluginTask(row.id);
            message.success('任务已启用');
          }
          await context.reload();
        },
        permissionCodes: [
          'QqBot:PluginTask:Enable',
          'QqBot:PluginTask:Disable',
        ],
      },
    ];
    const [registerTable, tableApi] = useKtTable<QqbotPluginTaskApi.Task>({
      api,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
              placeholder: '插件 Key',
            },
            fieldName: 'pluginKey',
            label: '插件',
          },
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
              placeholder: '任务 Key',
            },
            fieldName: 'taskKey',
            label: '任务',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '已调度', value: 'scheduled' },
                { label: '运行中', value: 'running' },
                { label: '失败', value: 'failed' },
                { label: '停用', value: 'disabled' },
                { label: '空闲', value: 'idle' },
              ],
            },
            fieldName: 'status',
            label: '状态',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '启用', value: true },
                { label: '停用', value: false },
              ],
            },
            fieldName: 'enabled',
            label: '启用',
          },
        ],
      },
      rowActions,
      tableTitle: '插件定时任务',
    });

    function closeCronModal() {
      cronModalOpen.value = false;
      cronTask.value = undefined;
    }

    async function handleCronSaved() {
      closeCronModal();
      await tableApi.reload();
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as QqbotPluginTaskApi.Task;
              if (column.key === 'pluginName') {
                return row.pluginName || row.pluginKey || row.pluginId || '-';
              }
              if (column.key === 'enabled') {
                return (
                  <Tag color={row.enabled ? 'success' : 'default'}>
                    {row.enabled ? '启用' : '停用'}
                  </Tag>
                );
              }
              if (column.key === 'runtimeStatus') {
                return (
                  <Tag color={runtimeStatusColor[row.runtimeStatus]}>
                    {row.runtimeStatus}
                  </Tag>
                );
              }
              if (column.key === 'lastStatus') {
                return row.lastStatus ? (
                  <Tag color={runStatusColor[row.lastStatus]}>
                    {row.lastStatus}
                  </Tag>
                ) : (
                  '-'
                );
              }
              return undefined;
            },
          }}
        />
        <TaskCronModal
          onClose={closeCronModal}
          onSaved={() => void handleCronSaved()}
          open={cronModalOpen.value}
          task={cronTask.value}
        />
        <TaskRunDrawer
          onClose={() => {
            runDrawerOpen.value = false;
          }}
          open={runDrawerOpen.value}
          task={runTask.value}
        />
      </Page>
    );
  },
});
