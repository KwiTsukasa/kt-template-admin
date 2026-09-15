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
  watch,
} from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Select, Space, Tag } from 'antdv-next';

import { executionEventsUrl, executionPage } from '#/api/automation-monitor';
import { KtTable } from '#/components/kt-table';

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
    const { hasAccessByCodes } = useAccess();
    const kind = ref<RunKind>();
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
          rows.value = page.items;
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
        else rows.value = result.items;
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
    watch(
      [kind, phase],
      () => {
        rows.value = [];
        cursor.value = null;
        void refresh();
      },
      { immediate: true },
    );
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
      <Page>
        <div class="space-y-4">
          <Card title="执行中心">
            <Space wrap>
              <Select
                allowClear
                aria-label="运行类型"
                class="w-40"
                onChange={(value) => {
                  kind.value = value as RunKind | undefined;
                }}
                options={Object.entries(kinds).map(([value, label]) => ({
                  value,
                  label,
                }))}
                placeholder="全部类型"
                value={kind.value}
              />
              <Select
                allowClear
                aria-label="执行状态"
                class="w-40"
                onChange={(value) => {
                  phase.value = value as RunPhase | undefined;
                }}
                options={Object.entries(phases).map(([value, label]) => ({
                  value,
                  label,
                }))}
                placeholder="全部状态"
                value={phase.value}
              />
              <Button loading={loading.value} onClick={() => refresh()}>
                刷新
              </Button>
              {live.value && <Tag color="green">实时更新</Tag>}
              {browsingHistory.value && (
                <Button onClick={() => refresh()}>返回最新记录</Button>
              )}
            </Space>
          </Card>
          {error.value && <Alert message={error.value} showIcon type="error" />}
          <Table
            columns={[
              {
                title: '类型',
                dataIndex: 'kind',
                width: 110,
              },
              { title: '名称', dataIndex: 'name', width: 220 },
              { title: '版本', dataIndex: 'resourceVersion', width: 80 },
              {
                title: '状态',
                dataIndex: 'status',
                width: 150,
              },
              { title: '运行编号', dataIndex: 'runId', width: 210 },
              { title: '创建时间', dataIndex: 'createdAt', width: 195 },
              { title: '完成时间', dataIndex: 'finishedAt', width: 195 },
              {
                title: '详情',
                key: 'details',
                width: 100,
              },
            ]}
            dataSource={rows.value}
            immediate={false}
            rowKey={(row: RunSummary) => `${row.kind}:${row.runId}`}
            showDefaultButtons={false}
            showPagination={false}
            showSelection={false}
            tableTitle="运行记录"
            v-slots={{
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
                        <Tag color="orange">需核验</Tag>
                      )}
                    </Space>
                  );
                if (column.key === 'details')
                  return (
                    <Button
                      disabled={
                        !hasAccessByCodes([
                          `Automation:${permissions[record.kind]}:List`,
                        ])
                      }
                      onClick={() => open(record)}
                      type="link"
                    >
                      查看
                    </Button>
                  );
                return undefined;
              },
            }}
          />
          <div class="flex justify-center">
            <Button
              disabled={!cursor.value || loading.value}
              loading={loading.value}
              onClick={() => refresh(true)}
            >
              加载更早记录
            </Button>
          </div>
        </div>
      </Page>
    );
  },
});
