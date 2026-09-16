import type { AtomicTaskDefinition, AtomicTaskRun } from '#/api/task-execution';

import {
  defineComponent,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Empty, Space, Tag } from 'antdv-next';

import { taskApi } from '#/api/task-execution';
import { usePageReturn } from '#/hooks/usePageReturn';

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
    const returnToPage = usePageReturn('/automation/tasks');
    const run = ref<AtomicTaskRun>();
    const definition = ref<AtomicTaskDefinition>();
    const error = ref('');
    const loading = ref(false);
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
      return (
        <Page autoContentHeight contentClass="automation-designer-viewport">
          <div class="automation-page automation-page--designer">
            <Space class="shrink-0" wrap>
              <Button onClick={returnToPage}>返回</Button>
              <strong>动作运行</strong>
              {run.value && <Tag>{statusLabels[run.value.status]}</Tag>}
              {run.value && <span>版本 v{run.value.taskVersion}</span>}
              <Button loading={loading.value} onClick={refresh}>
                刷新状态
              </Button>
            </Space>
            {error.value && <Alert message={error.value} type="error" />}
            {run.value && (
              <div class="automation-action-layout">
                <section class="automation-studio__panel automation-records">
                  <div class="automation-studio__panel-heading">
                    <h2>执行结果</h2>
                  </div>
                  <div class="automation-studio__panel-body automation-records__body">
                    <div class="break-all text-muted-foreground">
                      运行编号：{run.value.runId}
                    </div>
                    {run.value.error && (
                      <Alert message={run.value.error} type="error" />
                    )}
                    {run.value.requiresReview && (
                      <Alert
                        message="上一次执行结果无法自动确认，需要核实业务实际状态后再恢复该任务。"
                        type="warning"
                      />
                    )}
                    {!definition.value?.contract.outputSchema.fields.length && (
                      <Empty description="无输出字段" />
                    )}
                    {definition.value?.contract.outputSchema.fields.map(
                      (field) => (
                        <div
                          class="flex flex-wrap gap-4 rounded border p-3"
                          key={field.key}
                        >
                          <strong>{field.label}</strong>
                          <pre class="m-0 min-w-0 whitespace-pre-wrap break-all">
                            {JSON.stringify(
                              run.value?.output[field.key] ?? '尚无结果',
                              null,
                              2,
                            )}
                          </pre>
                        </div>
                      ),
                    )}
                    {(run.value.requiresReview || run.value.review) && (
                      <TaskRunReview onReviewed={refresh} run={run.value} />
                    )}
                  </div>
                </section>
                <section class="automation-studio__panel automation-records">
                  <div class="automation-studio__panel-heading">
                    <h2>执行尝试</h2>
                    <span>{run.value.attempts?.length || 0} 次</span>
                  </div>
                  <div class="automation-studio__panel-body automation-records__body">
                    {(run.value.attempts || []).map((attempt) => (
                      <div
                        class="space-y-2 break-all rounded border p-3"
                        key={attempt.id}
                      >
                        <Space wrap>
                          <strong>第 {attempt.attemptNo} 次</strong>
                          <Tag>{statusLabels[attempt.status]}</Tag>
                        </Space>
                        <div>尝试 ID：{attempt.id}</div>
                        <div>
                          处理器：{attempt.handlerKey} · v
                          {attempt.handlerVersion}
                        </div>
                        <div>运行版本：{attempt.runtimeIdentity}</div>
                        <div>
                          {attempt.startedAt} →{' '}
                          {attempt.finishedAt || '尚未结束'}
                        </div>
                        {attempt.errorMessage && (
                          <Alert message={attempt.errorMessage} type="error" />
                        )}
                      </div>
                    ))}
                    {!run.value.attempts?.length && (
                      <Empty description="暂无执行尝试" />
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </Page>
      );
    };
  },
});
