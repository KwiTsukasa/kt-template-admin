import type { FormDefinition } from '#/api/form-definition';
import type { WorkflowRun } from '#/api/workflow-engine';
import type {
  BpmnContract,
  BpmnDefinition,
  BpmnStep,
} from '#/api/workflow-engine/bpmn';

import {
  computed,
  defineComponent,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { Alert, Button, Empty, Select, Space, Tabs, Tag } from 'antdv-next';

import { workflowApi } from '#/api/workflow-engine';
import FormRenderer from '#/components/kt-dynamic-form/FormRenderer';
import { formFromDataSchema } from '#/components/kt-dynamic-form/schema-adapter';
import { BPMN_EXTENSION } from '#/constants/automation/bpmn';
import { AUTOMATION_PERMISSION } from '#/constants/automation/resources';
import {
  WORKFLOW_RUN_STATUS_COLORS as colors,
  WORKFLOW_NODE_STATUS_LABELS as labels,
  RUN_STATUS_GROUP,
} from '#/constants/automation/run-status';
import {
  WORKFLOW_LIMITS,
  WORKFLOW_PATH,
} from '#/constants/automation/workflow';
import { usePageReturn } from '#/hooks/usePageReturn';

import {
  bpmnExtension,
  bpmnProcess,
  emptyBpmnContract,
  indexBpmn,
} from './designer/bpmn-model';
import BpmnCanvas from './designer/BpmnCanvas';
import NodeRunDetails from './NodeRunDetails';
import { workflowRunNodeStates } from './workflow-run-presentation';

import '#/components/kt-automation/automation.scss';

export default defineComponent({
  name: 'AutomationWorkflowDebugger',
  setup() {
    const route = useRoute();
    const { hasAccessByCodes } = useAccess();
    const returnToPage = usePageReturn(WORKFLOW_PATH);
    const run = ref<WorkflowRun>();
    const definition = ref<BpmnDefinition>();
    const scopeId = ref('');
    const form = ref<FormDefinition>();
    const selectedId = ref<null | string>(null);
    const selected = computed(() =>
      run.value?.nodes.find((node) => node.nodeId === selectedId.value),
    );
    const nodeStates = computed(() => {
      if (!run.value) return [];
      return workflowRunNodeStates(run.value);
    });
    const selectedState = computed(() =>
      nodeStates.value.find((node) => node.nodeId === selectedId.value),
    );
    const actionTaskId = computed(() => {
      const document = definition.value;
      if (!document || !selectedId.value) return '';
      const element = indexBpmn(document).get(selectedId.value)?.element;
      if (!element) return '';
      const step = bpmnExtension<BpmnStep>(element, BPMN_EXTENSION.Step);
      if (step?.kind === 'action') return step.taskRef.id;
      return '';
    });
    const detailTab = ref('node');
    const nodeNames = computed(() => {
      const document = definition.value;
      if (!document) return {};
      return Object.fromEntries(
        [...indexBpmn(document).values()].map(({ element }) => [
          element.id,
          element.name || element.id,
        ]),
      );
    });
    const canvas = ref<{ fit: () => void; focus: (id: string) => void }>();
    const error = ref('');
    const cancelling = ref(false);
    const loading = ref(false);
    const active = computed(() =>
      Boolean(
        run.value && RUN_STATUS_GROUP.workflowOpen.includes(run.value.status),
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
          let savedForm = formFromDataSchema(
            (
              bpmnExtension<BpmnContract>(
                bpmnProcess(saved),
                BPMN_EXTENSION.Contract,
              ) ?? emptyBpmnContract()
            ).inputSchema,
          );
          if (presentation.form) savedForm = presentation.form;
          if (current !== generation) return;
          definition.value = saved;
          form.value = savedForm;
          definitionKey = key;
        }
        run.value = value;
        error.value = '';
        if (RUN_STATUS_GROUP.workflowOpen.includes(value.status))
          timer = setTimeout(
            () => void load(current),
            WORKFLOW_LIMITS.runPollMs,
          );
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
        if (
          typeof route.params.runId !== 'string' ||
          typeof route.params.workflowId !== 'string'
        )
          return;
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
      if (
        !run.value ||
        !active.value ||
        cancelling.value ||
        !hasAccessByCodes([AUTOMATION_PERMISSION.workflowCancel])
      )
        return;
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
          <div class="contents" key={key}>
            <dt class="break-all text-muted-foreground">{key}</dt>
            <dd class="break-all">{JSON.stringify(value)}</dd>
          </div>
        ))}
      </dl>
    );
    return () => (
      <Page autoContentHeight contentClass="automation-designer-viewport">
        <div class="automation-page automation-page--designer">
          <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <Space>
              <Button onClick={returnToPage}>返回</Button>
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
                disabled={
                  !active.value ||
                  !hasAccessByCodes([AUTOMATION_PERMISSION.workflowCancel])
                }
                loading={cancelling.value}
                onClick={cancel}
              >
                取消运行
              </Button>
            </Space>
          </div>
          {error.value && <Alert message={error.value} type="error" />}
          {run.value?.error && <Alert message={run.value.error} type="error" />}
          <div class="grid min-h-0 flex-1 grid-rows-[minmax(240px,3fr)_minmax(160px,2fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
            <div class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border">
              {definition.value && (
                <>
                  {scopeId.value && (
                    <Button
                      onClick={() => {
                        scopeId.value = '';
                      }}
                    >
                      返回主流程
                    </Button>
                  )}
                  <BpmnCanvas
                    definition={definition.value}
                    nodeStates={nodeStates.value}
                    onOpenScope={(id) => {
                      scopeId.value = id;
                    }}
                    onSelect={(id) => {
                      selectedId.value = id;
                      detailTab.value = 'node';
                    }}
                    readonly
                    ref={canvas}
                    scopeId={scopeId.value}
                    selectedId={selectedId.value || ''}
                  />
                </>
              )}
              {!definition.value && !loading.value && (
                <Empty description="暂无运行图" />
              )}
            </div>
            <aside class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
              <Tabs
                activeKey={detailTab.value}
                class="shrink-0 px-4"
                items={[
                  { key: 'node', label: '节点运行' },
                  { key: 'input', label: '流程输入' },
                  { key: 'output', label: '流程结果' },
                ]}
                onChange={(key) => {
                  detailTab.value = String(key);
                }}
              />
              <div class="min-h-0 flex-1 overflow-auto px-4 pb-4">
                {detailTab.value === 'node' && (
                  <div class="space-y-4">
                    <Select
                      aria-label="运行节点"
                      class="w-full"
                      onChange={(id) => {
                        selectedId.value = String(id);
                        canvas.value?.focus(String(id));
                      }}
                      options={nodeStates.value.map((node) => ({
                        value: node.nodeId,
                        label: `${nodeNames.value[node.nodeId] || node.nodeId} · ${labels[node.status]}`,
                      }))}
                      placeholder="选择节点"
                      value={selectedId.value || undefined}
                    />
                    {selected.value && run.value && (
                      <NodeRunDetails
                        actionTaskId={actionTaskId.value}
                        node={selected.value}
                        nodeNames={nodeNames.value}
                        runId={run.value.runId}
                      />
                    )}
                    {!selected.value && selectedState.value && (
                      <div class="space-y-3">
                        <strong>
                          {nodeNames.value[selectedState.value.nodeId] ||
                            selectedState.value.nodeId}
                        </strong>
                        <Tag color={colors[selectedState.value.status]}>
                          {labels[selectedState.value.status]}
                        </Tag>
                        {(run.value?.activeActivities || [])
                          .filter(
                            (activity) => activity.nodeId === selectedId.value,
                          )
                          .map((activity) => (
                            <div
                              class="break-all text-xs text-muted-foreground"
                              key={activity.executionId}
                            >
                              {activity.executionId}
                            </div>
                          ))}
                      </div>
                    )}
                    {!selected.value && !selectedState.value && (
                      <Empty description="未选择节点" />
                    )}
                  </div>
                )}
                {detailTab.value === 'input' && form.value && run.value && (
                  <FormRenderer
                    definition={form.value}
                    values={run.value.formValues || run.value.input}
                    writableFields={[]}
                  />
                )}
                {detailTab.value === 'output' &&
                  run.value &&
                  values(run.value.output)}
              </div>
            </aside>
          </div>
        </div>
      </Page>
    );
  },
});
