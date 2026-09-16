import type { PropType } from 'vue';

import type { DataSchema } from '#/api/automation/definition';
import type {
  WorkflowScriptCall,
  WorkflowScriptCapability,
} from '#/api/workflow-engine';

import { computed, defineComponent } from 'vue';

import { Alert, Button, InputNumber, Select, Tag } from 'antdv-next';

import { KtActionGroup } from '#/components/kt-table';

import BindingEditor from './BindingEditor';

export default defineComponent({
  name: 'WorkflowScriptSequence',
  props: {
    values: { type: Array as PropType<WorkflowScriptCall[]>, required: true },
    catalog: {
      type: Array as PropType<WorkflowScriptCapability[]>,
      required: true,
    },
    processKey: { type: String, required: true },
    stepKey: { type: String, required: true },
    inputSchema: { type: Object as PropType<DataSchema>, required: true },
    preparedSchema: { type: Object as PropType<DataSchema>, required: true },
    iterationAvailable: { type: Boolean, default: false },
    outputs: {
      type: Array as PropType<
        { name: string; nodeId: string; schema: DataSchema }[]
      >,
      required: true,
    },
  },
  emits: { change: (_calls: WorkflowScriptCall[]) => true },
  setup(props, { emit }) {
    const available = computed(() =>
      props.catalog.filter(
        (script) =>
          script.processKey === props.processKey &&
          script.stepKey === props.stepKey,
      ),
    );
    const callFor = (script: WorkflowScriptCapability): WorkflowScriptCall => ({
      key: script.key,
      version: script.version,
      sha256: script.sha256,
      timeoutMs: script.maxTimeoutMs,
      maxAttempts: 1,
      retryBackoffMs: 1000,
      params: Object.fromEntries(
        Object.entries(script.defaults)
          .filter(
            ([key]) =>
              !props.preparedSchema.fields.some((field) => field.key === key),
          )
          .map(([key, value]) => [key, { type: 'literal', value }]),
      ),
    });
    const replace = (index: number, value: WorkflowScriptCall) =>
      emit(
        'change',
        props.values.map((current, position) => {
          if (position === index) return value;
          return current;
        }),
      );
    const move = (index: number, delta: number) => {
      const calls = [...props.values];
      const target = index + delta;
      if (target < 0 || target >= calls.length) return;
      const current = calls[index];
      const adjacent = calls[target];
      if (!current || !adjacent) return;
      calls[index] = adjacent;
      calls[target] = current;
      emit('change', calls);
    };
    return () => (
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold">执行脚本</h3>
          <Button
            disabled={available.value.length === 0 || props.values.length >= 16}
            onClick={() => {
              const script = available.value[0];
              if (script) emit('change', [...props.values, callFor(script)]);
            }}
            size="small"
          >
            添加
          </Button>
        </div>
        {props.values.map((call, index) => {
          const script = available.value.find(
            (item) =>
              item.key === call.key &&
              item.version === call.version &&
              item.sha256 === call.sha256,
          );
          return (
            <div
              class="space-y-3 rounded border p-3"
              key={`${index}-${call.key}`}
            >
              <div class="flex items-center justify-between">
                <strong>脚本 {index + 1}</strong>
                <KtActionGroup
                  items={[
                    {
                      key: 'up',
                      content: (
                        <Button
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          size="small"
                        >
                          上移
                        </Button>
                      ),
                    },
                    {
                      key: 'down',
                      content: (
                        <Button
                          disabled={index === props.values.length - 1}
                          onClick={() => move(index, 1)}
                          size="small"
                        >
                          下移
                        </Button>
                      ),
                    },
                    {
                      key: 'remove',
                      content: (
                        <Button
                          danger
                          onClick={() =>
                            emit(
                              'change',
                              props.values.filter(
                                (_, position) => position !== index,
                              ),
                            )
                          }
                          size="small"
                        >
                          移除
                        </Button>
                      ),
                    },
                  ]}
                  size="small"
                  visibleCount={2}
                />
              </div>
              <Select
                class="w-full"
                onChange={(value) => {
                  const selected = available.value.find(
                    (item) => `${item.key}@${item.version}` === value,
                  );
                  if (selected) replace(index, callFor(selected));
                }}
                options={available.value.map((item) => ({
                  label: `${item.name} · v${item.version}`,
                  value: `${item.key}@${item.version}`,
                }))}
                value={`${call.key}@${call.version}`}
              />
              {!script && (
                <Alert message="固定脚本版本或摘要不可用" type="error" />
              )}
              {script && (
                <>
                  <div>
                    <Tag>{script.runtime}</Tag>
                    <Tag>{script.target}</Tag>
                    <span class="text-sm text-muted-foreground">
                      {script.description}
                    </span>
                  </div>
                  <label class="block">
                    超时（秒）
                    <InputNumber
                      class="w-full"
                      max={script.maxTimeoutMs / 1000}
                      min={1}
                      onChange={(value) =>
                        replace(index, {
                          ...call,
                          timeoutMs: Number(value) * 1000,
                        })
                      }
                      value={call.timeoutMs / 1000}
                    />
                  </label>
                  <label class="block">
                    最多尝试次数
                    <InputNumber
                      class="w-full"
                      disabled={!script.idempotent}
                      max={5}
                      min={1}
                      onChange={(value) =>
                        replace(index, { ...call, maxAttempts: Number(value) })
                      }
                      value={call.maxAttempts}
                    />
                  </label>
                  <label class="block">
                    重试间隔（秒）
                    <InputNumber
                      class="w-full"
                      disabled={call.maxAttempts === 1}
                      max={3600}
                      min={1}
                      onChange={(value) =>
                        replace(index, {
                          ...call,
                          retryBackoffMs: Number(value) * 1000,
                        })
                      }
                      value={call.retryBackoffMs / 1000}
                    />
                  </label>
                  <h4 class="font-semibold">
                    扩展参数 · {script.paramsSchema.fields.length}
                  </h4>
                  <BindingEditor
                    fields={script.paramsSchema.fields}
                    inheritedFields={props.preparedSchema.fields.map(
                      (field) => field.key,
                    )}
                    inputSchema={props.inputSchema}
                    iterationAvailable={props.iterationAvailable}
                    onChange={(params) => replace(index, { ...call, params })}
                    outputs={props.outputs}
                    values={call.params}
                  />
                </>
              )}
            </div>
          );
        })}
      </section>
    );
  },
});
