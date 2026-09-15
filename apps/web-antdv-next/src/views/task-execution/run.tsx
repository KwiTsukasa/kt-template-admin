import type { AtomicTaskDefinition, AtomicTaskRun } from '#/api/task-execution';

import {
  defineComponent,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Space, Tag } from 'antdv-next';

import { taskApi } from '#/api/task-execution';

import TaskRunReview from './components/TaskRunReview';

const statusLabels = {
  pending: '等待执行',
  running: '执行中',
  succeeded: '已完成',
  failed: '执行失败',
  cancelled: '已取消',
};

export default defineComponent({
  name: 'AutomationTaskRun',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { hasAccessByCodes } = useAccess();
    const run = ref<AtomicTaskRun>();
    const definition = ref<AtomicTaskDefinition>();
    const error = ref('');
    const loading = ref(false);
    const cancelling = ref(false);
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inactive = false;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const refresh = async () => {
      stop();
      const current = ++generation;
      loading.value = true;
      error.value = '';
      try {
        const value = await taskApi.run(String(route.params.runId));
        if (value.taskId !== String(route.params.taskId))
          throw new Error('运行记录不属于当前任务');
        const schema = await taskApi.version(value.taskId, value.taskVersion);
        if (current !== generation || inactive) return;
        run.value = value;
        definition.value = schema;
        if (value.status === 'pending' || value.status === 'running')
          timer = setTimeout(() => void refresh(), 1000);
      } catch (error_) {
        if (current === generation) error.value = String(error_);
      } finally {
        if (current === generation) loading.value = false;
      }
    };
    const cancel = async () => {
      if (!run.value || cancelling.value) return;
      cancelling.value = true;
      try {
        await taskApi.cancel(run.value.runId);
        await refresh();
      } finally {
        cancelling.value = false;
      }
    };
    watch(
      () => [route.params.taskId, route.params.runId],
      () => {
        run.value = undefined;
        definition.value = undefined;
        void refresh();
      },
      { immediate: true },
    );
    onDeactivated(() => {
      inactive = true;
      generation += 1;
      stop();
    });
    onActivated(() => {
      if (inactive) {
        inactive = false;
        void refresh();
      }
    });
    onBeforeUnmount(() => {
      generation += 1;
      stop();
    });
    return () => {
      let canCancel = false;
      if (run.value)
        canCancel =
          (run.value.status === 'pending' || run.value.status === 'running') &&
          hasAccessByCodes(['Automation:Task:Cancel']);
      return (
        <Page>
          <div class="space-y-4">
            <Space>
              <Button onClick={() => router.push('/automation/tasks')}>
                返回原子任务
              </Button>
              <Button loading={loading.value} onClick={refresh}>
                刷新状态
              </Button>
              <Button
                danger
                disabled={!canCancel}
                loading={cancelling.value}
                onClick={cancel}
              >
                取消运行
              </Button>
            </Space>
            {error.value && <Alert message={error.value} type="error" />}
            {run.value && (
              <Card
                extra={<Tag>{statusLabels[run.value.status]}</Tag>}
                title={`任务运行 ${run.value.runId}`}
              >
                <div class="space-y-4">
                  <div>固定任务版本：v{run.value.taskVersion}</div>
                  {run.value.error && (
                    <Alert message={run.value.error} type="error" />
                  )}
                  {run.value.requiresReview && (
                    <Alert
                      message="上一次执行结果无法自动确认，需要核实业务实际状态后再恢复该任务。"
                      type="warning"
                    />
                  )}
                  <h3>声明输出</h3>
                  {definition.value?.contract.outputSchema.fields.map(
                    (field) => (
                      <div
                        class="flex gap-4 rounded border p-3"
                        key={field.key}
                      >
                        <strong>{field.label}</strong>
                        <span>
                          {String(run.value?.output[field.key] ?? '尚无结果')}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </Card>
            )}
            {run.value && (
              <Card title="执行尝试">
                <div class="space-y-3">
                  {(run.value.attempts || []).map((attempt) => (
                    <div class="space-y-2 rounded border p-3" key={attempt.id}>
                      <Space>
                        <strong>第 {attempt.attemptNo} 次</strong>
                        <Tag>{statusLabels[attempt.status]}</Tag>
                      </Space>
                      <div>尝试 ID：{attempt.id}</div>
                      <div>
                        处理器：{attempt.handlerKey} · v{attempt.handlerVersion}
                      </div>
                      <div>运行版本：{attempt.runtimeIdentity}</div>
                      <div>
                        {attempt.startedAt} → {attempt.finishedAt || '尚未结束'}
                      </div>
                      {attempt.errorMessage && (
                        <Alert message={attempt.errorMessage} type="error" />
                      )}
                    </div>
                  ))}
                  {!run.value.attempts?.length && <div>尚未进入处理器。</div>}
                </div>
              </Card>
            )}
            {run.value && (
              <TaskRunReview onReviewed={refresh} run={run.value} />
            )}
          </div>
        </Page>
      );
    };
  },
});
