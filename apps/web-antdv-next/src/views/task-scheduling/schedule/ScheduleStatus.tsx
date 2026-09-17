import type { PropType } from 'vue';

import type {
  ScheduleHistory,
  ScheduleListRuntime,
} from '#/api/task-scheduling/schedule';

import { defineComponent } from 'vue';

import { Tag } from 'antdv-next';

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
    value: { type: Object as PropType<ScheduleListRuntime>, required: true },
  },
  setup(props) {
    return () => {
      const state = props.value?.state;
      const latest = props.value?.latest;
      return (
        <div class="automation-definition-meta">
          {!state && <span class="text-destructive">状态读取失败</span>}
          {state?.enabled && (
            <span>
              <Tag color="green">{`运行版本 v${state.activeVersion}`}</Tag>
            </span>
          )}
          {state && !state.enabled && (
            <span>
              <Tag>已停用</Tag>
            </span>
          )}
          {latest && (
            <small title={latest.error || ''}>
              {resultLabels[latest.status]} · {latest.occurredAt}
            </small>
          )}
          {state && !latest && <small>暂无触发记录</small>}
          {state?.nextRunAt && (
            <small>下次 {new Date(state.nextRunAt).toLocaleString()}</small>
          )}
          {state?.error && (
            <small class="text-destructive">{state.error}</small>
          )}
        </div>
      );
    };
  },
});
