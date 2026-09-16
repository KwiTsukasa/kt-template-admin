import type { DataSchema } from '#/api/automation/definition';
import type { RuleDefinition } from '#/api/rule-engine';
import type { BpmnContract } from '#/api/workflow-engine/bpmn';

import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Card,
  InputNumber,
  message,
  Select,
  Space,
  Switch,
  Tabs,
} from 'antdv-next';

import { ruleApi } from '#/api/rule-engine';
import { scheduleApi } from '#/api/task-scheduling/schedule';
import { triggerApi } from '#/api/trigger-engine';
import { bpmnWorkflowApi } from '#/api/workflow-engine/bpmn';
import EditorHeader from '#/components/kt-automation/EditorHeader';
import ReferencePicker from '#/components/kt-definition-list/ReferencePicker';
import { useDefinitionEditor } from '#/components/kt-definition-list/useDefinitionEditor';
import {
  bpmnExtension,
  bpmnProcess,
  emptyBpmnContract,
} from '#/views/workflow-engine/designer/bpmn-model';

import BindingEditor from './BindingEditor';

export default defineComponent({
  name: 'AutomationScheduleDesigner',
  props: { definitionId: { type: String, default: '' } },
  emits: ['close'],
  setup(props, { emit, expose }) {
    let context: undefined | { close: () => void; id: () => string };
    if (props.definitionId)
      context = { id: () => props.definitionId, close: () => emit('close') };
    const editor = useDefinitionEditor(
      scheduleApi,
      'scheduleId',
      '/automation/schedules',
      context,
    );
    expose({ confirmLeave: editor.confirmLeave });
    const admissionEnabled = ref(false);
    const eventSchema = ref<DataSchema>({ fields: [] });
    const inputSchema = ref<DataSchema>({ fields: [] });
    const rule = ref<RuleDefinition>();
    const resourceError = ref('');
    const ruleError = ref('');
    let resourceGeneration = 0;
    let ruleGeneration = 0;
    watch(
      () => editor.document.value?.id,
      () => {
        admissionEnabled.value = Boolean(editor.definition.value?.admission);
      },
    );
    watch(
      () =>
        JSON.stringify([
          editor.definition.value?.triggerRef,
          editor.definition.value?.target,
        ]),
      async () => {
        const current = ++resourceGeneration;
        eventSchema.value = { fields: [] };
        inputSchema.value = { fields: [] };
        resourceError.value = '';
        const definition = editor.definition.value;
        if (!definition) return;
        try {
          const triggerRef = definition.triggerRef;
          const target = definition.target;
          if (triggerRef) {
            const trigger = await triggerApi.version(
              triggerRef.id,
              triggerRef.version,
            );
            if (current !== resourceGeneration) return;
            if (trigger.trigger.type === 'event')
              eventSchema.value = trigger.trigger.payloadSchema;
          }
          if (target?.type === 'workflow') {
            const workflow = await bpmnWorkflowApi.version(
              target.reference.id,
              target.reference.version,
            );
            if (current === resourceGeneration) {
              const contract =
                bpmnExtension<BpmnContract>(
                  bpmnProcess(workflow),
                  'kt:Contract',
                ) ?? emptyBpmnContract();
              if (contract.processRef) {
                resourceError.value =
                  '该流程仅限对应业务入口创建，请选择系统流程';
                return;
              }
              inputSchema.value = contract.inputSchema;
            }
          }
        } catch {
          if (current === resourceGeneration)
            resourceError.value =
              '固定资源版本加载失败，请检查选择的版本与访问权限。';
        }
      },
      { immediate: true },
    );
    watch(
      () => JSON.stringify(editor.definition.value?.admission?.ruleRef),
      async () => {
        const current = ++ruleGeneration;
        rule.value = undefined;
        ruleError.value = '';
        const reference = editor.definition.value?.admission?.ruleRef;
        if (!reference) return;
        try {
          const result = await ruleApi.version(reference.id, reference.version);
          if (current === ruleGeneration) rule.value = result;
        } catch {
          if (current === ruleGeneration)
            ruleError.value = '准入规则版本加载失败';
        }
      },
      { immediate: true },
    );
    onBeforeUnmount(() => {
      resourceGeneration += 1;
      ruleGeneration += 1;
    });
    const expectedOptions = computed(() => {
      if (!rule.value || rule.value.mode === 'condition')
        return [
          { label: '规则通过', value: 'true' },
          { label: '规则不通过', value: 'false' },
        ];
      const values = [
        ...rule.value.rows.map((row) => row.result),
        rule.value.defaultResult,
      ];
      return [...new Set(values.map((value) => JSON.stringify(value)))].map(
        (value) => ({ label: String(JSON.parse(value)), value }),
      );
    });
    const publish = async () => {
      if (resourceError.value || ruleError.value) {
        message.error(resourceError.value || ruleError.value);
        return;
      }
      if (admissionEnabled.value && !editor.definition.value?.admission) {
        message.error('请先选择准入规则的固定发布版本');
        return;
      }
      await editor.publish();
    };
    const resources = () => {
      const definition = editor.definition.value;
      if (!definition) return null;
      return (
        <div class="grid gap-4">
          <Card title="发生条件">
            <ReferencePicker
              api={triggerApi}
              basePath="/automation/triggers"
              label="触发器"
              onChange={(value) => {
                definition.triggerRef = value;
              }}
              value={definition.triggerRef}
            />
          </Card>
          <Card title="执行目标">
            <div class="space-y-3">
              <ReferencePicker
                api={bpmnWorkflowApi}
                basePath="/automation/workflows"
                label="工作流"
                onChange={(value) => {
                  definition.target = null;
                  if (value)
                    definition.target = {
                      type: 'workflow',
                      reference: value,
                    };
                }}
                value={definition.target?.reference || null}
                versionError={(version) => {
                  const contract = bpmnExtension<BpmnContract>(
                    bpmnProcess(version.definition),
                    'kt:Contract',
                  );
                  if (contract?.processRef) return '仅限对应业务入口创建';
                  return undefined;
                }}
              />
            </div>
          </Card>
          <Card title="准入规则">
            <div class="space-y-3">
              <Space>
                <Switch
                  checked={admissionEnabled.value}
                  onChange={(value) => {
                    admissionEnabled.value = Boolean(value);
                    if (!value) definition.admission = null;
                  }}
                />
                <span>派发前执行规则</span>
              </Space>
              {admissionEnabled.value && (
                <>
                  <ReferencePicker
                    api={ruleApi}
                    basePath="/automation/rules"
                    label="准入规则"
                    onChange={(value) => {
                      definition.admission = null;
                      if (value)
                        definition.admission = {
                          ruleRef: value,
                          facts: {},
                          expected: true,
                        };
                    }}
                    value={definition.admission?.ruleRef || null}
                  />
                  {definition.admission && (
                    <label class="block">
                      允许执行的规则结果
                      <Select
                        class="w-full"
                        onChange={(value) => {
                          if (definition.admission)
                            definition.admission.expected = JSON.parse(
                              String(value),
                            );
                        }}
                        options={expectedOptions.value}
                        value={JSON.stringify(definition.admission.expected)}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      );
    };
    const mappings = () => {
      const definition = editor.definition.value;
      if (!definition) return null;
      return (
        <div class="grid gap-4">
          <Card title="执行参数">
            <BindingEditor
              eventSchema={eventSchema.value}
              onChange={(value) => {
                definition.input = value;
              }}
              schema={inputSchema.value}
              values={definition.input}
            />
          </Card>
          {definition.admission && rule.value && (
            <Card title="规则事实">
              <BindingEditor
                eventSchema={eventSchema.value}
                onChange={(value) => {
                  if (definition.admission) definition.admission.facts = value;
                }}
                schema={rule.value.factSchema}
                values={definition.admission.facts}
              />
            </Card>
          )}
        </div>
      );
    };
    const policies = () => {
      const definition = editor.definition.value;
      if (!definition) return null;
      return (
        <Card title="执行策略">
          <div class="max-w-xl space-y-4">
            <label class="block">
              前一次运行未完成时
              <Select
                class="w-full"
                onChange={(value) => {
                  if (value === 'skip' || value === 'allow')
                    definition.overlap = value;
                }}
                options={[
                  { label: '跳过本次触发并记录原因', value: 'skip' },
                  { label: '允许产生新的运行', value: 'allow' },
                ]}
                value={definition.overlap}
              />
            </label>
            <label class="block">
              触发发起期限（秒）
              <InputNumber
                class="w-full"
                max={86_400}
                min={1}
                onChange={(value) => {
                  if (value !== null)
                    definition.taskDeadlineMs = Number(value) * 1000;
                }}
                value={definition.taskDeadlineMs / 1000}
              />
            </label>
          </div>
        </Card>
      );
    };
    return () => (
      <div class="automation-page automation-configuration">
        <div class="space-y-4">
          <EditorHeader
            description={editor.description.value}
            dirty={editor.dirty.value}
            label="定时任务"
            loading={editor.loading.value}
            name={editor.name.value}
            onBack={editor.back}
            onDescriptionChange={(description) => {
              editor.description.value = description;
            }}
            onNameChange={(name) => {
              editor.name.value = name;
            }}
            onPublish={publish}
            onSave={editor.save}
            permission="Automation:Schedule"
            publishedVersion={
              editor.document.value?.publishedVersion ?? undefined
            }
            revision={editor.document.value?.revision}
          />
          {[editor.error.value, resourceError.value, ruleError.value]
            .filter(Boolean)
            .map((error) => (
              <Alert key={error} message={error} type="error" />
            ))}
          <Tabs
            items={[
              { key: 'resources', label: '关联资源', content: resources },
              { key: 'bindings', label: '参数映射', content: mappings },
              { key: 'policies', label: '执行策略', content: policies },
            ]}
          />
        </div>
      </div>
    );
  },
});
