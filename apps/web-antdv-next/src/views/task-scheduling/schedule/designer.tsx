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

import { ruleApi } from '#/api/rule-engine';
import { taskApi } from '#/api/task-execution';
import { scheduleApi } from '#/api/task-scheduling/schedule';
import { triggerApi } from '#/api/trigger-engine';
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
              <Select
                class="w-full"
                onChange={(value) => {
                  if (value === 'task' || value === 'workflow') {
                    targetKind.value = value;
                    definition.target = null;
                    definition.input = {};
                  }
                }}
                options={[
                  { label: '原子任务', value: 'task' },
                  { label: '工作流', value: 'workflow' },
                ]}
                value={targetKind.value}
              />
              <ReferencePicker
                api={targetApi}
                basePath={targetPath}
                key={targetKind.value}
                label="执行资源"
                onChange={(value) => {
                  definition.target = null;
                  if (value)
                    definition.target = {
                      type: targetKind.value,
                      reference: value,
                    };
                }}
                value={definition.target?.reference || null}
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
        <div class="grid gap-4 lg:grid-cols-2">
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
              原子任务排队与执行总期限（秒）
              <InputNumber
                class="w-full"
                disabled={targetKind.value !== 'task'}
                max={86_400}
                min={1}
                onChange={(value) => {
                  if (value !== null)
                    definition.taskDeadlineMs = Number(value) * 1000;
                }}
                value={definition.taskDeadlineMs / 1000}
              />
            </label>
            <Alert
              message="工作流使用其固定版本声明的总期限。停用计划会阻止新准入，已通过准入的运行继续恢复到可确认状态。"
              type="info"
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
                onChange={(event) => {
                  editor.name.value = event.target.value || '';
                }}
                value={editor.name.value}
              />
            </Space>
            <Space>
              <Button loading={editor.loading.value} onClick={editor.save}>
                保存草稿
              </Button>
              <Button
                loading={editor.loading.value}
                onClick={publish}
                type="primary"
              >
                发布版本
              </Button>
            </Space>
          </div>
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
      </Page>
    );
  },
});
