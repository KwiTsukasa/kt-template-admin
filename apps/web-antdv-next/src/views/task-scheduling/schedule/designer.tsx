import type { DataSchema } from '#/api/automation/definition';
import type { RuleDefinition } from '#/api/rule-engine';
import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { Page } from '@vben/common-ui';
import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Switch,
  Tabs,
} from 'antdv-next';
import { scheduleApi } from '#/api/task-scheduling/schedule';
import { triggerApi } from '#/api/trigger-engine';
import { ruleApi } from '#/api/rule-engine';
import { taskApi } from '#/api/task-execution';
import { workflowApi } from '#/api/workflow-engine';
import ReferencePicker from '#/components/kt-definition-list/ReferencePicker';
import { useDefinitionEditor } from '#/components/kt-definition-list/useDefinitionEditor';
import BindingEditor from './BindingEditor';

export default defineComponent({
  name: 'AutomationScheduleDesigner',
  setup() {
    const editor = useDefinitionEditor(
      scheduleApi,
      'scheduleId',
      '/automation/schedules',
    );
    const targetKind = ref<'task' | 'workflow'>('task');
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
        targetKind.value = editor.definition.value?.target?.type || 'task';
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
          if (target?.type === 'task') {
            const task = await taskApi.version(
              target.reference.id,
              target.reference.version,
            );
            if (current === resourceGeneration)
              inputSchema.value = task.contract.inputSchema;
          }
          if (target?.type === 'workflow') {
            const workflow = await workflowApi.version(
              target.reference.id,
              target.reference.version,
            );
            if (current === resourceGeneration)
              inputSchema.value = workflow.graph.inputSchema;
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
      if (admissionEnabled.value && !editor.definition.value?.admission) {
        message.error('请先选择准入规则的固定发布版本');
        return;
      }
      await editor.publish();
    };
    const resources = () => {
      const definition = editor.definition.value;
      if (!definition) return null;
      let targetApi = taskApi as typeof taskApi | typeof workflowApi;
      let targetPath = '/automation/tasks';
      if (targetKind.value === 'workflow') {
        targetApi = workflowApi;
        targetPath = '/automation/workflows';
      }
      return (
        <div class="grid gap-4 lg:grid-cols-3">
          <Card title="发生条件">
            <ReferencePicker
              api={triggerApi}
              label="触发器"
              basePath="/automation/triggers"
              value={definition.triggerRef}
              onChange={(value) => {
                definition.triggerRef = value;
              }}
            />
          </Card>
          <Card title="执行目标">
            <div class="space-y-3">
              <Select
                class="w-full"
                value={targetKind.value}
                options={[
                  { label: '原子任务', value: 'task' },
                  { label: '工作流', value: 'workflow' },
                ]}
                onChange={(value) => {
                  if (value === 'task' || value === 'workflow') {
                    targetKind.value = value;
                    definition.target = null;
                    definition.input = {};
                  }
                }}
              />
              <ReferencePicker
                key={targetKind.value}
                api={targetApi}
                label="执行资源"
                basePath={targetPath}
                value={definition.target?.reference || null}
                onChange={(value) => {
                  definition.target = null;
                  if (value)
                    definition.target = {
                      type: targetKind.value,
                      reference: value,
                    };
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
                    label="准入规则"
                    basePath="/automation/rules"
                    value={definition.admission?.ruleRef || null}
                    onChange={(value) => {
                      definition.admission = null;
                      if (value)
                        definition.admission = {
                          ruleRef: value,
                          facts: {},
                          expected: true,
                        };
                    }}
                  />
                  {definition.admission && (
                    <label class="block">
                      允许执行的规则结果
                      <Select
                        class="w-full"
                        value={JSON.stringify(definition.admission.expected)}
                        options={expectedOptions.value}
                        onChange={(value) => {
                          if (definition.admission)
                            definition.admission.expected = JSON.parse(
                              String(value),
                            );
                        }}
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
        <div class="grid gap-4 lg:grid-cols-2">
          <Card title="执行参数">
            <BindingEditor
              schema={inputSchema.value}
              eventSchema={eventSchema.value}
              values={definition.input}
              onChange={(value) => {
                definition.input = value;
              }}
            />
          </Card>
          {definition.admission && rule.value && (
            <Card title="规则事实">
              <BindingEditor
                schema={rule.value.factSchema}
                eventSchema={eventSchema.value}
                values={definition.admission.facts}
                onChange={(value) => {
                  if (definition.admission) definition.admission.facts = value;
                }}
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
                value={definition.overlap}
                options={[
                  { label: '跳过本次触发并记录原因', value: 'skip' },
                  { label: '允许产生新的运行', value: 'allow' },
                ]}
                onChange={(value) => {
                  if (value === 'skip' || value === 'allow')
                    definition.overlap = value;
                }}
              />
            </label>
            <label class="block">
              原子任务排队与执行总期限（秒）
              <InputNumber
                class="w-full"
                min={1}
                max={86400}
                disabled={targetKind.value !== 'task'}
                value={definition.taskDeadlineMs / 1000}
                onChange={(value) => {
                  if (value !== null)
                    definition.taskDeadlineMs = Number(value) * 1000;
                }}
              />
            </label>
            <Alert
              type="info"
              message="工作流使用其固定版本声明的总期限。停用计划会阻止新准入，已通过准入的运行继续恢复到可确认状态。"
            />
          </div>
        </Card>
      );
    };
    return () => (
      <Page>
        <div class="space-y-4">
          <div class="flex justify-between gap-3">
            <Space>
              <Button onClick={editor.back}>返回调度计划</Button>
              <Input
                value={editor.name.value}
                onChange={(event) => {
                  editor.name.value = event.target.value || '';
                }}
              />
            </Space>
            <Space>
              <Button loading={editor.loading.value} onClick={editor.save}>
                保存草稿
              </Button>
              <Button
                type="primary"
                loading={editor.loading.value}
                onClick={publish}
              >
                发布版本
              </Button>
            </Space>
          </div>
          {[editor.error.value, resourceError.value, ruleError.value]
            .filter(Boolean)
            .map((error) => (
              <Alert key={error} type="error" message={error} />
            ))}
          <Tabs
            items={[
              { key: 'resources', label: '关联资源', content: resources },
              { key: 'bindings', label: '参数映射', content: mappings },
              { key: 'policies', label: '执行策略', content: policies },
            ]}
          />
        </div>
      </Page>
    );
  },
});
