import type { PropType } from 'vue';

import type { QqbotPluginTaskApi } from '#/api/qqbot/plugin-task';

import { defineComponent, ref, watch } from 'vue';

import { Drawer, Tag } from 'antdv-next';

import { getQqbotPluginTaskRunPage } from '#/api/qqbot/plugin-task';

const ADrawer = Drawer as any;

const runStatusColor: Record<QqbotPluginTaskApi.RunStatus, string> = {
  failed: 'error',
  running: 'processing',
  skipped: 'default',
  success: 'success',
};

export default defineComponent({
  name: 'QqBotPluginTaskRunDrawer',
  props: {
    open: {
      default: false,
      type: Boolean,
    },
    task: {
      default: undefined,
      type: Object as PropType<QqbotPluginTaskApi.Task | undefined>,
    },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const loading = ref(false);
    const runs = ref<QqbotPluginTaskApi.TaskRun[]>([]);

    watch(
      () => [props.open, props.task?.id],
      () => {
        if (props.open && props.task?.id) void loadRuns();
      },
      { immediate: true },
    );

    /**
     * 任务存在时加载最近二十条执行记录，并在请求期间维护抽屉加载态。
     */
    async function loadRuns() {
      if (!props.task?.id) return;
      loading.value = true;
      try {
        const page = await getQqbotPluginTaskRunPage(props.task.id, {
          pageNo: 1,
          pageSize: 20,
        });
        runs.value = page.list || [];
      } finally {
        loading.value = false;
      }
    }

    const renderRun = (item: QqbotPluginTaskApi.TaskRun) => (
      <div class="border-b border-solid border-border py-3" key={item.id}>
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <Tag color={runStatusColor[item.status]}>{item.status}</Tag>
          <Tag>{item.triggerType}</Tag>
          <span class="text-muted-foreground">
            {item.startedAt || item.createTime || '-'}
          </span>
          <span class="text-muted-foreground">
            {(() => {
              if (item.durationMs === null || item.durationMs === undefined) {
                return '-';
              }
              return `${item.durationMs} ms`;
            })()}
          </span>
        </div>
        {(() => {
          if (item.safeSummary) {
            return (
              <pre class="whitespace-pre-wrap rounded border border-border bg-muted p-2 text-xs text-foreground">
                {JSON.stringify(item.safeSummary, null, 2)}
              </pre>
            );
          }
          return null;
        })()}
        {(() => {
          if (item.errorMessage) {
            return (
              <div class="mt-2 text-sm text-destructive">
                {item.errorMessage}
              </div>
            );
          }
          return null;
        })()}
      </div>
    );

    return () => (
      <ADrawer
        loading={loading.value}
        onClose={() => emit('close')}
        open={props.open}
        size="large"
        title={props.task?.taskName || '运行记录'}
      >
        {(() => {
          if (runs.value.length > 0) {
            return <div>{runs.value.map((run) => renderRun(run))}</div>;
          }
          return <span>暂无运行记录</span>;
        })()}
      </ADrawer>
    );
  },
});
