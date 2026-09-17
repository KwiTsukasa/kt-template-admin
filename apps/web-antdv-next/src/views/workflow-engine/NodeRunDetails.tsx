import type { PropType } from 'vue';

import type { WorkflowNodeRun, WorkflowNodeVisit } from '#/api/workflow-engine';

import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { formatDateTime } from '@vben/utils';

import { Alert, Button, Empty, Select, Tag } from 'antdv-next';

import { workflowApi } from '#/api/workflow-engine';
import {
  AUTOMATION_PATH,
  AUTOMATION_PERMISSION,
} from '#/constants/automation/resources';
import {
  WORKFLOW_NODE_STATUS_COLORS as colors,
  WORKFLOW_NODE_STATUS_LABELS as labels,
} from '#/constants/automation/run-status';

import { workflowNodeVisits } from './workflow-run-presentation';

export default defineComponent({
  name: 'WorkflowNodeRunDetails',
  props: {
    actionTaskId: { type: String, default: '' },
    runId: { type: String, required: true },
    node: { type: Object as PropType<WorkflowNodeRun>, required: true },
    nodeNames: {
      type: Object as PropType<Record<string, string>>,
      required: true,
    },
  },
  setup(props) {
    const router = useRouter();
    const { hasAccessByCodes } = useAccess();
    const history = ref<WorkflowNodeVisit[]>([]);
    const before = ref<null | number>(null);
    const chosen = ref<null | number>(null);
    const loading = ref(false);
    const error = ref('');
    let generation = 0;
    const visits = computed(() =>
      workflowNodeVisits(props.node, history.value),
    );
    const selected = computed(() =>
      visits.value.find(
        (item) => item.visit === (chosen.value ?? props.node.visit),
      ),
    );
    const load = async (append = false) => {
      const current = ++generation;
      loading.value = true;
      try {
        let cursor: number | undefined;
        if (append && before.value !== null) cursor = before.value;
        const result = await workflowApi.nodeVisits(
          props.runId,
          props.node.nodeId,
          cursor,
        );
        if (current !== generation) return;
        const firstPage = history.value.length === 0;
        const loaded = new Map(history.value.map((item) => [item.visit, item]));
        for (const item of result.items) loaded.set(item.visit, item);
        history.value = [...loaded.values()];
        if (append || firstPage) before.value = result.nextBeforeVisit;
        error.value = '';
      } catch {
        if (current === generation) error.value = '执行历史读取失败';
      } finally {
        if (current === generation) loading.value = false;
      }
    };
    watch(
      () => [props.runId, props.node.nodeId],
      () => {
        history.value = [];
        chosen.value = null;
        before.value = null;
        void load();
      },
      { immediate: true },
    );
    watch(
      () => [
        props.node.visit,
        props.node.status,
        props.node.scriptAttempts.length,
        props.node.scriptAttempts.at(-1)?.status,
      ],
      () => {
        void load();
      },
    );
    onBeforeUnmount(() => {
      generation += 1;
    });
    const renderValues = (values: Record<string, unknown>) => (
      <dl class="grid grid-cols-[minmax(64px,1fr)_2fr] gap-2">
        {Object.entries(values).map(([key, value]) => (
          <div class="contents" key={key}>
            <dt class="break-all text-muted-foreground">{key}</dt>
            <dd class="break-all">{JSON.stringify(value)}</dd>
          </div>
        ))}
      </dl>
    );
    return () => (
      <div class="space-y-4">
        <strong>
          {props.nodeNames[props.node.nodeId] || props.node.nodeId}
        </strong>
        {(props.node.visit > 1 || visits.value.length > 1) && (
          <div class="space-y-2">
            <Select
              aria-label="执行轮次"
              class="w-full"
              loading={loading.value}
              onChange={(value) => {
                chosen.value = Number(value);
              }}
              options={visits.value.map((item) => ({
                label: `第 ${item.visit} 次 · ${labels[item.status]}`,
                value: item.visit,
              }))}
              value={chosen.value ?? props.node.visit}
            />
            {before.value !== null && (
              <Button block loading={loading.value} onClick={() => load(true)}>
                更早记录
              </Button>
            )}
          </div>
        )}
        {error.value && (
          <Alert
            action={
              <Button onClick={() => load()} size="small">
                重试
              </Button>
            }
            message={error.value}
            type="error"
          />
        )}
        {selected.value && (
          <>
            <Tag color={colors[selected.value.status]}>
              {labels[selected.value.status]}
            </Tag>
            {selected.value.startedAt && (
              <div>开始：{formatDateTime(selected.value.startedAt)}</div>
            )}
            {selected.value.finishedAt && (
              <div>结束：{formatDateTime(selected.value.finishedAt)}</div>
            )}
            {Object.entries(selected.value.loopPath || {}).map(
              ([id, iteration]) => (
                <div key={id}>
                  {props.nodeNames[id] || id}：第 {iteration} 轮
                </div>
              ),
            )}
            {chosen.value === null && props.node.loopIteration > 0 && (
              <div>已进入第 {props.node.loopIteration} 轮</div>
            )}
            {selected.value.error && (
              <Alert message={selected.value.error} type="error" />
            )}
            {selected.value.taskRunId && (
              <Button
                disabled={
                  !props.actionTaskId ||
                  !hasAccessByCodes([AUTOMATION_PERMISSION.taskList])
                }
                onClick={() =>
                  router.push(
                    `${AUTOMATION_PATH.tasks}/${props.actionTaskId}/runs/${selected.value?.taskRunId}`,
                  )
                }
              >
                查看动作记录
              </Button>
            )}
            {renderValues(selected.value.output)}
            {selected.value.scriptAttempts?.map((attempt) => (
              <section
                class="space-y-2 rounded-md border p-3"
                key={attempt.executionId}
              >
                <div class="flex flex-wrap items-center gap-2">
                  <strong>
                    {attempt.index + 1}. {attempt.script.key}
                  </strong>
                  <Tag color={colors[attempt.status]}>
                    {labels[attempt.status]}
                  </Tag>
                </div>
                <div class="text-muted-foreground">
                  版本 {attempt.script.version} · 第 {attempt.attempt} 次尝试
                </div>
                <div class="break-all text-xs text-muted-foreground">
                  {attempt.executionId}
                </div>
                <div>开始：{formatDateTime(attempt.startedAt)}</div>
                {attempt.finishedAt && (
                  <div>结束：{formatDateTime(attempt.finishedAt)}</div>
                )}
                {attempt.exitCode !== null && (
                  <div>退出码：{attempt.exitCode}</div>
                )}
                {renderValues(attempt.output)}
              </section>
            ))}
          </>
        )}
        {!selected.value && <Empty description="暂无执行记录" />}
      </div>
    );
  },
});
