import type { PropType } from 'vue';

import type {
  DataSchema,
  DefinitionDocument,
  DefinitionRevision,
} from '#/api/automation/definition';
import type { RuleDefinition } from '#/api/rule-engine';
import type { WorkflowNode } from '#/api/workflow-engine';

import { computed, defineComponent, ref, watch } from 'vue';

import { Alert, InputNumber, Select } from 'antdv-next';

import { ruleApi } from '#/api/rule-engine';

import BindingEditor from './BindingEditor';

type LoopNode = Extract<WorkflowNode, { type: 'loop' }>;

export default defineComponent({
  name: 'WorkflowLoopProperties',
  props: {
    node: { type: Object as PropType<LoopNode>, required: true },
    rules: {
      type: Array as PropType<DefinitionDocument<RuleDefinition>[]>,
      required: true,
    },
    inputSchema: { type: Object as PropType<DataSchema>, required: true },
    outputs: {
      type: Array as PropType<
        { name: string; nodeId: string; schema: DataSchema }[]
      >,
      required: true,
    },
  },
  emits: { change: (_node: LoopNode) => true },
  setup(props, { emit }) {
    const versions = ref<DefinitionRevision<RuleDefinition>[]>([]);
    const error = ref('');
    const selectedRuleId = ref('');
    const loading = ref(false);
    let request = 0;
    const selectedVersion = computed(() =>
      versions.value.find(
        (version) => version.version === props.node.condition?.ruleRef.version,
      ),
    );
    const loadVersions = async (id: string, choose: boolean) => {
      const current = ++request;
      error.value = '';
      if (!choose) {
        selectedRuleId.value = id;
        versions.value = [];
      }
      if (!id) {
        loading.value = false;
        return;
      }
      loading.value = true;
      try {
        const values = await ruleApi.versions(id);
        if (current !== request) return;
        const compatible = values.filter(
          (version) => version.definition.mode === 'condition',
        );
        if (compatible.length === 0) {
          error.value = '该规则没有已发布的布尔条件版本';
          return;
        }
        selectedRuleId.value = id;
        versions.value = compatible;
        const first = compatible[0];
        if (choose && first)
          emit('change', {
            ...props.node,
            condition: {
              ruleRef: { id, version: first.version },
              facts: {},
              continueOn: true,
            },
          });
      } catch {
        if (current === request) error.value = '规则版本加载失败';
      } finally {
        if (current === request) loading.value = false;
      }
    };
    watch(
      () => [props.node.id, props.node.condition?.ruleRef.id],
      () => {
        const id = props.node.condition?.ruleRef.id || '';
        void loadVersions(id, false);
      },
      { immediate: true },
    );
    return () => (
      <div class="space-y-4">
        <label class="block space-y-1">
          <span>循环次数上限</span>
          <InputNumber
            aria-label="循环次数上限"
            class="w-full"
            max={1000}
            min={1}
            onChange={(value) => {
              if (value !== null)
                emit('change', { ...props.node, maxIterations: Number(value) });
            }}
            precision={0}
            value={props.node.maxIterations}
          />
        </label>
        <label class="block space-y-1">
          <span>每轮结束判断</span>
          <Select
            allowClear
            aria-label="循环条件规则"
            class="w-full"
            loading={loading.value}
            onChange={(value) => {
              if (value) {
                void loadVersions(String(value), true);
              } else {
                void loadVersions('', false);
                emit('change', { ...props.node, condition: null });
              }
            }}
            options={props.rules.map((rule) => ({
              label: rule.name,
              value: rule.id,
            }))}
            placeholder="固定次数"
            value={selectedRuleId.value || undefined}
          />
        </label>
        {error.value && <Alert message={error.value} type="error" />}
        {props.node.condition && (
          <>
            <label class="block space-y-1">
              <span>固定规则版本</span>
              <Select
                class="w-full"
                disabled={loading.value}
                onChange={(value) => {
                  if (props.node.condition)
                    emit('change', {
                      ...props.node,
                      condition: {
                        ...props.node.condition,
                        ruleRef: {
                          id: selectedRuleId.value,
                          version: Number(value),
                        },
                        facts: {},
                      },
                    });
                }}
                options={versions.value.map((version) => ({
                  label: `版本 ${version.version}`,
                  value: version.version,
                }))}
                value={props.node.condition.ruleRef.version}
              />
            </label>
            <label class="block space-y-1">
              <span>继续循环</span>
              <Select
                class="w-full"
                onChange={(value) => {
                  if (props.node.condition)
                    emit('change', {
                      ...props.node,
                      condition: {
                        ...props.node.condition,
                        continueOn: value === 'true',
                      },
                    });
                }}
                options={[
                  { label: '条件成立时', value: 'true' },
                  { label: '条件不成立时', value: 'false' },
                ]}
                value={String(props.node.condition.continueOn)}
              />
            </label>
            {selectedVersion.value && (
              <BindingEditor
                fields={selectedVersion.value.definition.factSchema.fields}
                inputSchema={props.inputSchema}
                onChange={(facts) => {
                  if (props.node.condition)
                    emit('change', {
                      ...props.node,
                      condition: { ...props.node.condition, facts },
                    });
                }}
                outputs={props.outputs}
                values={props.node.condition.facts}
              />
            )}
          </>
        )}
      </div>
    );
  },
});
