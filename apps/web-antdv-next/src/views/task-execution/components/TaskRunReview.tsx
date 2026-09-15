import type { PropType } from 'vue';

import type { AtomicTaskRun, TaskReviewResolution } from '#/api/task-execution';

import { defineComponent, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import { Alert, Button, Card, Input, Select } from 'antdv-next';

import { taskApi } from '#/api/task-execution';

const resolutions = [
  { value: 'effect-confirmed', label: '已确认业务动作生效' },
  { value: 'no-effect', label: '已确认未产生业务动作' },
  { value: 'compensated', label: '已完成业务补偿' },
];

export default defineComponent({
  name: 'TaskRunReview',
  props: { run: { type: Object as PropType<AtomicTaskRun>, required: true } },
  emits: ['reviewed'],
  setup(props, { emit }) {
    const { hasAccessByCodes } = useAccess();
    const resolution = ref<TaskReviewResolution>();
    const reason = ref('');
    const saving = ref(false);
    const error = ref('');
    watch(
      () => props.run.runId,
      () => {
        resolution.value = undefined;
        reason.value = '';
        error.value = '';
      },
    );
    const submit = async () => {
      if (!resolution.value || !reason.value.trim() || saving.value) return;
      const runId = props.run.runId;
      saving.value = true;
      error.value = '';
      try {
        await taskApi.review(runId, {
          resolution: resolution.value,
          reason: reason.value.trim(),
        });
        if (runId === props.run.runId) emit('reviewed');
      } catch (error_) {
        if (runId === props.run.runId) error.value = String(error_);
      } finally {
        saving.value = false;
      }
    };
    return () => {
      const review = props.run.review;
      const disabled =
        !props.run.requiresReview ||
        !hasAccessByCodes(['Automation:Task:Review']) ||
        saving.value;
      if (review)
        return (
          <Card title="核对记录">
            <div class="space-y-2">
              <div>
                {
                  resolutions.find((item) => item.value === review.resolution)
                    ?.label
                }
              </div>
              <div class="whitespace-pre-wrap">{review.reason}</div>
              <div>
                操作人：{review.reviewedBy} · {review.reviewedAt}
              </div>
              <div>原运行状态和尝试记录已保留，后续运行可正常发起。</div>
            </div>
          </Card>
        );
      if (!props.run.requiresReview) return <div />;
      return (
        <Card title="核对执行结果">
          <div class="space-y-4">
            <Alert
              message="请先核实业务系统中的实际结果。提交后解除该任务的执行阻塞；原失败记录保留，旧运行不会自动重试。"
              type="warning"
            />
            <label class="block space-y-2">
              <span>核对结论</span>
              <Select
                class="w-full"
                disabled={disabled}
                onChange={(value) => {
                  resolution.value = value as TaskReviewResolution;
                }}
                options={resolutions}
                placeholder="选择已核实的结果"
                value={resolution.value}
              />
            </label>
            <label class="block space-y-2">
              <span>业务证据或补偿说明</span>
              <Input.TextArea
                disabled={disabled}
                maxlength={2048}
                onChange={(event) => {
                  reason.value = event.target.value || '';
                }}
                placeholder="填写业务记录编号、核查结果或补偿记录"
                rows={3}
                value={reason.value}
              />
            </label>
            {error.value && <Alert message={error.value} type="error" />}
            <Button
              disabled={disabled || !resolution.value || !reason.value.trim()}
              loading={saving.value}
              onClick={submit}
              type="primary"
            >
              封存核对记录并解除阻塞
            </Button>
          </div>
        </Card>
      );
    };
  },
});
