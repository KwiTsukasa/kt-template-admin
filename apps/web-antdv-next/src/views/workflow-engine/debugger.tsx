import type { FormDefinition } from '#/api/form-definition';
import type { WorkflowDefinition, WorkflowRun } from '#/api/workflow-engine';
import {
  computed,
  defineComponent,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import { Alert, Button, Card, Empty, Space, Tag } from 'antdv-next';
import { workflowApi } from '#/api/workflow-engine';
import FormRenderer from '#/components/kt-dynamic-form/FormRenderer';
import { formFromDataSchema } from '#/components/kt-dynamic-form/schema-adapter';
import WorkflowCanvas from './designer/WorkflowCanvas';

const labels: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  waiting: '等待中',
  succeeded: '成功',
  failed: '失败',
  skipped: '未选分支',
  cancelled: '已取消',
};
const colors: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  waiting: 'cyan',
  succeeded: 'success',
  failed: 'error',
  skipped: 'default',
  cancelled: 'default',
};

export default defineComponent({
  name: 'AutomationWorkflowDebugger',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const run = ref<WorkflowRun>();
    const definition = ref<WorkflowDefinition>();
    const form = ref<FormDefinition>();
    const selectedId = ref<string | null>(null);
    const selected = computed(() =>
      run.value?.nodes.find((node) => node.nodeId === selectedId.value),
    );
    const canvas = ref<{ fit: () => void; focus: (id: string) => void }>();
    const error = ref('');
    const cancelling = ref(false);
    const loading = ref(false);
    const active = computed(() =>
      Boolean(
        run.value &&
        ['pending', 'running', 'waiting'].includes(run.value.status),
      ),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    let definitionKey = '';
    const stop = () => {
      generation += 1;
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const load = async (current: number) => {
      loading.value = true;
      try {
        const value = await workflowApi.run(String(route.params.runId));
        if (current !== generation) return;
        if (value.workflowId !== String(route.params.workflowId)) {
          error.value = '运行记录不属于当前工作流。';
          return;
        }
        const key = `${value.workflowId}@${value.workflowVersion}`;
        if (key !== definitionKey) {
          const presentation = await workflowApi.runSchema(value.runId);
          const saved = presentation.definition;
          let savedForm = formFromDataSchema(saved.graph.inputSchema);
          if (presentation.form) savedForm = presentation.form;
          if (current !== generation) return;
          definition.value = saved;
          form.value = savedForm;
          definitionKey = key;
        }
        run.value = value;
        error.value = '';
        if (['pending', 'running', 'waiting'].includes(value.status))
          timer = setTimeout(() => void load(current), 1000);
      } catch {
        if (current === generation)
          error.value = '无法读取运行记录或固定版本，请检查权限后刷新。';
      } finally {
        if (current === generation) loading.value = false;
      }
    };
    const refresh = () => {
      stop();
      void load(generation);
    };
    watch(
      () => [route.params.workflowId, route.params.runId],
      () => {
        stop();
        definitionKey = '';
        run.value = undefined;
        definition.value = undefined;
        form.value = undefined;
        selectedId.value = null;
        error.value = '';
        void load(generation);
      },
      { immediate: true },
    );
    onDeactivated(stop);
    onActivated(() => {
      if (run.value) refresh();
    });
    onBeforeUnmount(stop);
    const cancel = async () => {
      if (!run.value || !active.value || cancelling.value) return;
      cancelling.value = true;
      try {
        await workflowApi.cancel(run.value.runId);
        refresh();
      } finally {
        cancelling.value = false;
      }
    };
    const values = (data: Record<string, unknown>) => (
      <dl class="grid grid-cols-[minmax(80px,1fr)_2fr] gap-2">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} class="contents">
            <dt class="break-all text-muted-foreground">{key}</dt>
            <dd class="break-all">{String(value)}</dd>
          </div>
        ))}
      </dl>
    );
    return () => (
      <Page>
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <Space>
              <Button onClick={() => router.push('/automation/workflows')}>
                返回工作流管理
              </Button>
              <strong>流程运行</strong>
              {run.value && (
                <Tag color={colors[run.value.status]}>
                  {labels[run.value.status]}
                </Tag>
              )}
              <span>版本 {run.value?.workflowVersion}</span>
            </Space>
            <Space>
              <Button loading={loading.value} onClick={refresh}>
                刷新
              </Button>
              <Button onClick={() => canvas.value?.fit()}>适应画布</Button>
              <Button
                danger
                disabled={!active.value}
                loading={cancelling.value}
                onClick={cancel}
              >
                取消运行
              </Button>
            </Space>
          </div>
          {error.value && <Alert type="error" message={error.value} />}
          {run.value?.error && <Alert type="error" message={run.value.error} />}
          <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div class="min-w-0">
              {definition.value && (
                <WorkflowCanvas
                  ref={canvas}
                  definition={definition.value}
                  readonly
                  nodeStates={run.value?.nodes || []}
                  onSelect={(id) => {
                    selectedId.value = id;
                  }}
                />
              )}
            </div>
            <Card title="节点运行">
              {selected.value && (
                <div class="space-y-3">
                  <strong>
                    {
                      definition.value?.graph.nodes.find(
                        (node) => node.id === selected.value?.nodeId,
                      )?.name
                    }
                  </strong>
                  <div>
                    <Tag color={colors[selected.value.status]}>
                      {labels[selected.value.status]}
                    </Tag>
                  </div>
                  {selected.value.wakeAt && (
                    <div>
                      唤醒时间：
                      {new Date(selected.value.wakeAt).toLocaleString()}
                    </div>
                  )}
                  {selected.value.taskRunId && (
                    <div class="break-all">
                      原子任务运行：{selected.value.taskRunId}
                    </div>
                  )}
                  {selected.value.error && (
                    <Alert type="error" message={selected.value.error} />
                  )}
                  {values(selected.value.output)}
                </div>
              )}
              {!selected.value && <Empty description="选择节点查看运行状态" />}
            </Card>
          </div>
          <Card title="节点进度">
            <Space wrap>
              {run.value?.nodes.map((node) => (
                <Button
                  key={node.nodeId}
                  onClick={() => canvas.value?.focus(node.nodeId)}
                >
                  <Tag color={colors[node.status]}>{labels[node.status]}</Tag>
                  {definition.value?.graph.nodes.find(
                    (item) => item.id === node.nodeId,
                  )?.name || node.nodeId}
                </Button>
              ))}
            </Space>
          </Card>
          {form.value && run.value && (
            <Card title="本次流程输入">
              <FormRenderer
                definition={form.value}
                values={run.value.formValues || run.value.input}
                writableFields={[]}
              />
            </Card>
          )}
          {run.value && (
            <Card title="流程输出">{values(run.value.output)}</Card>
          )}
        </div>
      </Page>
    );
  },
});
