import type {
  ExecutionPage,
  RunKind,
  RunPhase,
  RunSummary,
} from '#/api/automation-monitor';

import {
  defineComponent,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { Alert, Space, Tag } from 'antdv-next';

import { executionEventsUrl, executionPage } from '#/api/automation-monitor';
import { KtTable, useKtTable } from '#/components/kt-table';

import '#/components/kt-automation/automation.scss';

const Table = KtTable as any;
const kinds: Record<RunKind, string> = {
  task: '原子任务',
  workflow: '工作流',
  schedule: '调度计划',
};
const phases: Record<RunPhase, string> = {
  pending: '待执行',
  active: '进行中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
  skipped: '已跳过',
};
const statuses: Record<string, string> = {
  pending: '待执行',
  starting: '正在发起',
  running: '执行中',
  waiting: '等待唤醒',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
  skipped: '已跳过',
};
const permissions: Record<RunKind, string> = {
  task: 'Task',
  workflow: 'Workflow',
  schedule: 'Schedule',
};

export default defineComponent({
  name: 'AutomationMonitorList',
  setup() {
    const router = useRouter();
    const route = useRoute();
    const { hasAccessByCodes } = useAccess();
    const kind = ref<RunKind>();
    if (['schedule', 'task', 'workflow'].includes(String(route.query.kind)))
      kind.value = route.query.kind as RunKind;
    const phase = ref<RunPhase>();
    const rows = ref<RunSummary[]>([]);
    const cursor = ref<null | string>(null);
    const loading = ref(false);
    const error = ref('');
    const live = ref(false);
    const browsingHistory = ref(false);
    let stream: EventSource | undefined;
    let generation = 0;
    let active = true;
    const closeStream = () => {
      stream?.close();
      stream = undefined;
      live.value = false;
    };
    const startStream = () => {
      closeStream();
      if (!active || browsingHistory.value) return;
      const source = new EventSource(
        executionEventsUrl({ kind: kind.value, phase: phase.value, limit: 30 }),
        { withCredentials: true },
      );
      stream = source;
      source.addEventListener('execution-snapshot', (event) => {
        if (source !== stream || !active) return;
        try {
          const page = JSON.parse(
            (event as MessageEvent<string>).data,
          ) as ExecutionPage;
          if (!Array.isArray(page.items)) return;
          rows.value.splice(0, rows.value.length, ...page.items);
          cursor.value = page.nextCursor;
          live.value = true;
          error.value = '';
        } catch {
          error.value = '实时记录格式异常，请刷新。';
        }
      });
      source.addEventListener('error', () => {
        if (source !== stream) return;
        live.value = false;
        error.value = '实时连接中断，正在重新连接；已有记录保留。';
      });
    };
    const refresh = async (append = false) => {
      if (append && !cursor.value) return;
      closeStream();
      browsingHistory.value = append;
      const current = ++generation;
      loading.value = true;
      error.value = '';
      let beforeId: string | undefined;
      if (append && cursor.value) beforeId = cursor.value;
      try {
        const result = await executionPage({
          kind: kind.value,
          phase: phase.value,
          beforeId,
          limit: 30,
        });
        if (current !== generation || !active) return;
        if (append) rows.value.push(...result.items);
        else rows.value.splice(0, rows.value.length, ...result.items);
        cursor.value = result.nextCursor;
      } catch {
        if (current === generation) error.value = '执行记录加载失败，请重试。';
      } finally {
        if (current === generation) {
          loading.value = false;
          startStream();
        }
      }
    };
    const open = async (row: RunSummary) => {
      let path = `/automation/schedules/${row.resourceId}/control`;
      if (row.kind === 'task')
        path = `/automation/tasks/${row.resourceId}/runs/${row.runId}`;
      if (row.kind === 'workflow')
        path = `/automation/workflows/${row.resourceId}/runs/${row.runId}`;
      await router.push(path);
    };
    const [register] = useKtTable<RunSummary>({
      tableTitle: '运行记录',
      rowKey: (row) => `${row.kind}:${row.runId}`,
      showPagination: false,
      showFooter: false,
      api: {
        list: async (params) => {
          kind.value = params.kind || undefined;
          phase.value = params.phase || undefined;
          rows.value.splice(0);
          cursor.value = null;
          await refresh();
          return rows.value;
        },
      },
      formOptions: {
        schema: [
          {
            fieldName: 'kind',
            label: '运行类型',
            component: 'Select',
            defaultValue: kind.value,
            componentProps: {
              allowClear: true,
              placeholder: '全部类型',
              options: Object.entries(kinds).map(([value, label]) => ({
                value,
                label,
              })),
            },
          },
          {
            fieldName: 'phase',
            label: '执行状态',
            component: 'Select',
            componentProps: {
              allowClear: true,
              placeholder: '全部状态',
              options: Object.entries(phases).map(([value, label]) => ({
                value,
                label,
              })),
            },
          },
        ],
      },
      columns: [
        { title: '类型', dataIndex: 'kind', width: 110 },
        { title: '名称', dataIndex: 'name', width: 220 },
        { title: '版本', dataIndex: 'resourceVersion', width: 80 },
        { title: '状态', dataIndex: 'status', width: 150 },
        { title: '运行编号', dataIndex: 'runId', width: 210 },
        { title: '创建时间', dataIndex: 'createdAt', width: 195 },
        { title: '完成时间', dataIndex: 'finishedAt', width: 195 },
      ],
      rowActions: [
        {
          key: 'details',
          label: '查看',
          rowVisible: (row) =>
            hasAccessByCodes([`Automation:${permissions[row.kind]}:List`]),
          onClick: open,
        },
      ],
    });
    onActivated(() => {
      if (!active) {
        active = true;
        void refresh();
      }
    });
    const deactivate = () => {
      active = false;
      closeStream();
      generation += 1;
      loading.value = false;
    };
    onDeactivated(deactivate);
    onBeforeUnmount(deactivate);
    return () => (
      <Page autoContentHeight>
        <div class="automation-page">
          {error.value && <Alert message={error.value} showIcon type="error" />}
          <div class="automation-page__content">
            <Table
              buttons={[
                {
                  key: 'latest',
                  label: '返回最新记录',
                  visible: () => browsingHistory.value,
                  loading: loading.value,
                  onClick: () => refresh(),
                },
                {
                  key: 'history',
                  label: '加载更早记录',
                  visible: () => Boolean(cursor.value),
                  loading: loading.value,
                  onClick: () => refresh(true),
                },
              ]}
              onRegister={register}
              v-slots={{
                title: () => (
                  <Space>
                    <span>运行记录</span>
                    {live.value && <Tag color="success">实时更新</Tag>}
                    {browsingHistory.value && <Tag>历史记录</Tag>}
                  </Space>
                ),
                bodyCell: ({
                  column,
                  record,
                }: {
                  column: { dataIndex?: string; key?: string };
                  record: RunSummary;
                }) => {
                  if (column.dataIndex === 'kind') return kinds[record.kind];
                  if (column.dataIndex === 'status')
                    return (
                      <Space>
                        <Tag>{statuses[record.status] || record.status}</Tag>
                        {record.requiresReview && (
                          <Tag color="warning">需核验</Tag>
                        )}
                      </Space>
                    );
                  return undefined;
                },
              }}
            />
          </div>
        </div>
      </Page>
    );
  },
});
