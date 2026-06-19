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
     * Loads the latest task run records for the selected plugin task drawer.
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

    /**
     * Renders one scheduled-task execution record with themed evidence blocks.
     *
     * @param item - Task run row returned by the plugin task API.
     */
    const renderRun = (item: QqbotPluginTaskApi.TaskRun) => (
      <div class="border-b border-solid border-border py-3" key={item.id}>
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <Tag color={runStatusColor[item.status]}>{item.status}</Tag>
          <Tag>{item.triggerType}</Tag>
          <span class="text-muted-foreground">
            {item.startedAt || item.createTime || '-'}
          </span>
          <span class="text-muted-foreground">
            {item.durationMs === null || item.durationMs === undefined
              ? '-'
              : `${item.durationMs} ms`}
          </span>
        </div>
        {item.safeSummary ? (
          <pre class="whitespace-pre-wrap rounded border border-border bg-muted p-2 text-xs text-foreground">
            {JSON.stringify(item.safeSummary, null, 2)}
          </pre>
        ) : null}
        {item.errorMessage ? (
          <div class="mt-2 text-sm text-destructive">{item.errorMessage}</div>
        ) : null}
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
        {runs.value.length > 0 ? (
          <div>{runs.value.map((run) => renderRun(run))}</div>
        ) : (
          <span>暂无运行记录</span>
        )}
      </ADrawer>
    );
  },
});
