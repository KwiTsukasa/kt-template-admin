import type {
  ScheduleHistory,
  ScheduleState,
} from '#/api/task-scheduling/schedule';

import { defineComponent, onBeforeUnmount, ref, watch } from 'vue';

import { Tag } from 'antdv-next';

import { scheduleApi } from '#/api/task-scheduling/schedule';

const resultLabels: Record<ScheduleHistory['status'], string> = {
  cancelled: '已取消',
  failed: '执行失败',
  pending: '等待准入',
  running: '执行中',
  skipped: '已跳过',
  starting: '正在发起',
  succeeded: '执行完成',
};

export default defineComponent({
  name: 'AutomationScheduleStatus',
  props: {
    id: { type: String, required: true },
    revision: { type: Number, required: true },
  },
  setup(props) {
    const state = ref<ScheduleState>();
    const latest = ref<ScheduleHistory>();
    const error = ref('');
    let generation = 0;
    watch(
      () => [props.id, props.revision],
      async () => {
        const current = ++generation;
        state.value = undefined;
        latest.value = undefined;
        error.value = '';
        try {
          const [control, history] = await Promise.all([
            scheduleApi.state(props.id),
            scheduleApi.history(props.id),
          ]);
          if (current !== generation) return;
          state.value = control;
          latest.value = history.list[0];
        } catch {
          if (current === generation) error.value = '状态读取失败';
        }
      },
      { immediate: true },
    );
    onBeforeUnmount(() => {
      generation += 1;
    });
    return () => (
      <div class="automation-definition-meta">
        {error.value && <span class="text-destructive">{error.value}</span>}
        {!error.value && !state.value && <span>读取状态…</span>}
        {state.value?.enabled && (
          <span>
            <Tag color="green">{`运行版本 v${state.value.activeVersion}`}</Tag>
          </span>
        )}
        {state.value && !state.value.enabled && (
          <span>
            <Tag>已停用</Tag>
          </span>
        )}
        {latest.value && (
          <small title={latest.value.error || ''}>
            {resultLabels[latest.value.status]} · {latest.value.occurredAt}
          </small>
        )}
        {state.value && !latest.value && <small>暂无触发记录</small>}
        {state.value?.nextRunAt && (
          <small>下次 {new Date(state.value.nextRunAt).toLocaleString()}</small>
        )}
        {state.value?.error && (
          <small class="text-destructive">{state.value.error}</small>
        )}
      </div>
    );
  },
});
