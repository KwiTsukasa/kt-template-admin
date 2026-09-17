import type { PropType } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type { MediaWorkflowHumanTask as HumanTask } from '#/api/media-governance/workflow';
import type { WorkflowRun } from '#/api/workflow-engine';

import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Descriptions,
  message,
  Popconfirm,
  Space,
  Spin,
} from 'antdv-next';

import { mediaWorkflowApi } from '#/api/media-governance/workflow';

import MediaWorkflowHumanTask from './MediaWorkflowHumanTask';

const AAlert = Alert as any;
const AButton = Button as any;
const ADescriptions = Descriptions as any;
const APopconfirm = Popconfirm as any;
const ASpace = Space as any;
const ASpin = Spin as any;
const statusNames = {
  pending: '等待执行',
  running: '执行中',
  waiting: '等待中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export default defineComponent({
  name: 'MediaGovernanceTaskRunPanel',
  props: {
    active: { default: true, type: Boolean },
    readOnly: { default: false, type: Boolean },
    task: { required: true, type: Object as PropType<MediaGovernanceApi.Task> },
  },
  emits: ['changed'],
  setup(props, { emit }) {
    const router = useRouter();
    const { hasAccessByCodes } = useAccess();
    const run = ref<null | WorkflowRun>(null);
    const humanTasks = ref<HumanTask[]>([]);
    const cancelling = ref(false);
    const failure = ref('');
    const loading = ref(false);
    let generation = 0;
    let poll: ReturnType<typeof setTimeout> | undefined;
    const activeRun = computed(
      () =>
        !!run.value &&
        ['pending', 'running', 'waiting'].includes(run.value.status),
    );
    const canCancel = computed(
      () =>
        !props.readOnly &&
        hasAccessByCodes(['Media:Governance:WorkflowRun']) &&
        activeRun.value &&
        !cancelling.value &&
        !loading.value,
    );

    /**
     * 读取当前任务已创建的唯一实例，丢弃切换任务后的旧响应。
     * @param silent - 后台更新时不重复显示加载遮罩。
     */
    async function refresh(silent = false) {
      clearTimeout(poll);
      const current = ++generation;
      if (!silent) loading.value = true;
      try {
        const [result, pending] = await Promise.all([
          mediaWorkflowApi.latest(props.task.id),
          mediaWorkflowApi.humanTasks(props.task.id),
        ]);
        if (current !== generation) return;
        run.value = result;
        const previousTasks = new Map(
          humanTasks.value.map((item) => [item.executionId, item]),
        );
        humanTasks.value = pending.map((item) => {
          const previous = previousTasks.get(item.executionId);
          if (previous && JSON.stringify(previous) === JSON.stringify(item))
            return previous;
          return item;
        });
        failure.value = '';
      } catch (error) {
        if (current === generation)
          failure.value =
            (error instanceof Error && error.message) || '工作流状态读取失败';
      } finally {
        if (current === generation) {
          loading.value = false;
          if (props.active && activeRun.value)
            poll = setTimeout(() => void refresh(true), 3000);
        }
      }
    }

    /**
     * 将取消意图提交给任务当前实例，由工作流停止脚本并回写终态。
     */
    async function cancel() {
      if (!canCancel.value || !run.value) return;
      cancelling.value = true;
      try {
        await mediaWorkflowApi.cancel(props.task.id, run.value.runId);
        await refresh(true);
        emit('changed');
      } catch (error) {
        message.error(
          (error instanceof Error && error.message) || '取消流程失败',
        );
      } finally {
        cancelling.value = false;
      }
    }

    watch(
      [() => props.task.id, () => props.active],
      () => {
        clearTimeout(poll);
        generation += 1;
        run.value = null;
        humanTasks.value = [];
        if (props.active) void refresh();
      },
      { immediate: true },
    );
    onBeforeUnmount(() => {
      generation += 1;
      clearTimeout(poll);
    });

    return () => {
      const current = run.value;
      let status = '未关联实例';
      let reference = '—';
      if (current) {
        status = statusNames[current.status];
        reference = `${current.workflowId} · v${current.workflowVersion}`;
      }
      return (
        <div class="grid min-w-0 gap-4">
          <ASpace wrap>
            <AButton
              disabled={!current}
              onClick={() => {
                if (current)
                  void router.push(
                    `/automation/workflows/${current.workflowId}/runs/${current.runId}`,
                  );
              }}
            >
              运行详情
            </AButton>
            <APopconfirm
              disabled={!canCancel.value}
              onConfirm={cancel}
              title="取消当前流程？"
            >
              <AButton
                danger
                disabled={!canCancel.value}
                loading={cancelling.value}
              >
                取消流程
              </AButton>
            </APopconfirm>
            <AButton
              disabled={cancelling.value}
              loading={loading.value}
              onClick={() => refresh()}
            >
              刷新
            </AButton>
          </ASpace>
          {failure.value && (
            <AAlert showIcon title={failure.value} type="error" />
          )}
          {current &&
            humanTasks.value.map((item) => (
              <MediaWorkflowHumanTask
                disabled={
                  props.readOnly ||
                  !hasAccessByCodes(['Media:Governance:WorkflowRun'])
                }
                key={item.executionId}
                submit={async (values) => {
                  await mediaWorkflowApi.completeHumanTask(
                    props.task.id,
                    current.runId,
                    item.executionId,
                    values,
                  );
                  await refresh(true);
                  emit('changed');
                }}
                task={item}
              />
            ))}
          <ASpin spinning={loading.value}>
            <ADescriptions
              bordered
              column={1}
              items={[
                { key: 'model', label: '实例版本', content: reference },
                { key: 'status', label: '流程状态', content: status },
                {
                  key: 'run',
                  label: '流程运行',
                  content: current?.runId ?? '—',
                },
                {
                  key: 'action',
                  label: '当前步骤',
                  content:
                    current?.activeActivities
                      ?.map((activity) => activity.name)
                      .join('、') || '—',
                },
                {
                  key: 'gate',
                  label: '阻塞原因',
                  content: current?.error || '—',
                },
              ]}
            />
          </ASpin>
        </div>
      );
    };
  },
});
