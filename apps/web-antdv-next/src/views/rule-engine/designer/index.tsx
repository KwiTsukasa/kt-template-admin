import type { DataField } from '#/api/automation/definition';
import type { RuleCondition, RulePreview, RuleScalar } from '#/api/rule-engine';

import { computed, defineComponent, ref } from 'vue';

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
  Tag,
} from 'antdv-next';

import { ruleApi } from '#/api/rule-engine';
import { useDefinitionEditor } from '#/components/kt-definition-list/useDefinitionEditor';
import FieldSchemaEditor from '#/components/kt-dynamic-form/FieldSchemaEditor';
import FormRenderer from '#/components/kt-dynamic-form/FormRenderer';
import { formFromDataSchema } from '#/components/kt-dynamic-form/schema-adapter';

import ConditionEditor, { newCondition } from '../components/ConditionEditor';
import ConditionTrace from '../components/ConditionTrace';

/**
 * 事实字段更名时同步条件树的引用，保留比较关系和其他事实路径。
 * @param condition - 正在编辑的条件树。
 * @param previous - 旧事实字段标识。
 * @param next - 新事实字段标识。
 * @returns 引用更新后的条件树。
 */
function renameFact(
  condition: RuleCondition,
  previous: string,
  next: string,
): RuleCondition {
  if (condition.type === 'all' || condition.type === 'any')
    return {
      ...condition,
      rules: condition.rules.map((rule) => renameFact(rule, previous, next)),
    };
  if (condition.type === 'not')
    return { ...condition, rule: renameFact(condition.rule, previous, next) };
  if (condition.type === 'compare' && condition.path === previous)
    return { ...condition, path: next };
  return condition;
}

export default defineComponent({
  name: 'AutomationRuleDesigner',
  setup() {
    const editor = useDefinitionEditor(ruleApi, 'ruleId', '/automation/rules');
    const tab = ref('conditions');
    const selectedFact = ref(0);
    const tester = ref<{
      validate: () => Promise<Record<string, unknown> | undefined>;
    }>();
    const preview = ref<RulePreview>();
    const expected = ref<RuleScalar>(true);
    const caseName = ref('');
    const previewError = ref('');
    const testResultType = (passed: boolean) => {
      if (passed) return 'success';
      return 'error';
    };
    const factForm = computed(() =>
      formFromDataSchema(editor.definition.value?.factSchema || { fields: [] }),
    );
    const changeFact = (field: DataField) => {
      const definition = editor.definition.value;
      const previous = definition?.factSchema.fields[selectedFact.value];
      if (!definition || !previous) return;
      definition.factSchema.fields[selectedFact.value] = field;
      if (definition.mode === 'condition')
        definition.condition = renameFact(
          definition.condition,
          previous.key,
          field.key,
        );
      else
        for (const row of definition.rows)
          row.condition = renameFact(row.condition, previous.key, field.key);
    };
    const addFact = () => {
      const definition = editor.definition.value;
      if (!definition || definition.factSchema.fields.length >= 64) return;
      let index = definition.factSchema.fields.length + 1;
      while (
        definition.factSchema.fields.some(
          (field) => field.key === `fact_${index}`,
        )
      )
        index += 1;
      definition.factSchema.fields.push({
        key: `fact_${index}`,
        label: '新事实',
        type: 'string',
        required: false,
      });
      selectedFact.value = definition.factSchema.fields.length - 1;
    };
    const scalarInput = (
      value: RuleScalar,
      change: (value: RuleScalar) => void,
    ) => {
      if (typeof value === 'boolean')
        return (
          <Switch checked={value} onChange={(next) => change(Boolean(next))} />
        );
      if (typeof value === 'number')
        return (
          <InputNumber
            onChange={(next) => change(Number(next))}
            value={value}
          />
        );
      return (
        <Input
          onChange={(event) => change(event.target.value || '')}
          value={String(value || '')}
        />
      );
    };
    const setMode = (mode: unknown) => {
      const definition = editor.definition.value;
      if (!definition || definition.mode === mode) return;
      if (mode === 'condition') {
        let condition = newCondition(definition.factSchema.fields);
        if (definition.mode === 'decision-table' && definition.rows[0])
          condition = definition.rows[0].condition;
        editor.definition.value = {
          schemaVersion: 1,
          factSchema: definition.factSchema,
          testCases: [],
          mode: 'condition',
          condition,
        };
      } else {
        let condition = newCondition(definition.factSchema.fields);
        if (definition.mode === 'condition') condition = definition.condition;
        editor.definition.value = {
          schemaVersion: 1,
          factSchema: definition.factSchema,
          testCases: [],
          mode: 'decision-table',
          rows: [{ id: 'row_1', condition, result: true }],
          defaultResult: false,
        };
      }
      preview.value = undefined;
    };
    const test = async () => {
      const facts = await tester.value?.validate();
      if (!facts || !editor.definition.value) return;
      previewError.value = '';
      try {
        preview.value = await ruleApi.preview(editor.definition.value, facts);
      } catch (error) {
        previewError.value = String(error);
      }
    };
    const saveCase = async () => {
      const facts = await tester.value?.validate();
      if (!facts || !editor.definition.value || !caseName.value.trim()) {
        message.warning('填写用例名称和有效事实');
        return;
      }
      editor.definition.value.testCases.push({
        name: caseName.value.trim(),
        facts,
        expected: expected.value,
      });
      caseName.value = '';
    };
    const factsPanel = () => {
      const definition = editor.definition.value;
      if (!definition) return null;
      const current = definition.factSchema.fields[selectedFact.value];
      return (
        <div class="grid gap-4 lg:grid-cols-[240px_1fr]">
          <Card
            extra={<Button onClick={addFact}>新增</Button>}
            title="事实目录"
          >
            <div class="space-y-2">
              {definition.factSchema.fields.map((field, index) => (
                <Button
                  block
                  key={index}
                  onClick={() => {
                    selectedFact.value = index;
                  }}
                >
                  {field.label} · {field.key}
                </Button>
              ))}
            </div>
          </Card>
          <Card title="事实字段">
            {current && (
              <FieldSchemaEditor field={current} onChange={changeFact} />
            )}
          </Card>
        </div>
      );
    };
    const conditionsPanel = () => {
      const definition = editor.definition.value;
      if (!definition) return null;
      if (definition.mode === 'condition')
        return (
          <ConditionEditor
            fields={definition.factSchema.fields}
            onChange={(value) => {
              definition.condition = value;
            }}
            value={definition.condition}
          />
        );
      return (
        <div class="space-y-4">
          <Alert
            message="按行顺序匹配，第一条命中的结果作为决策输出。"
            type="info"
          />
          <Space>
            <span>输出类型</span>
            <Select
              onChange={(type) => {
                let value: RuleScalar = '';
                if (type === 'boolean') value = false;
                if (type === 'number') value = 0;
                definition.defaultResult = value;
                for (const row of definition.rows) row.result = value;
                expected.value = value;
              }}
              options={[
                { label: '是否', value: 'boolean' },
                { label: '文本', value: 'string' },
                { label: '数字', value: 'number' },
              ]}
              value={typeof definition.defaultResult}
            />
            <span>未命中结果</span>
            {scalarInput(definition.defaultResult, (value) => {
              definition.defaultResult = value;
            })}
          </Space>
          {definition.rows.map((row, index) => (
            <Card
              extra={
                <Space>
                  <span>输出</span>
                  {scalarInput(row.result, (value) => {
                    row.result = value;
                  })}
                  <Button
                    disabled={index === 0}
                    onClick={() => {
                      const previous = definition.rows[index - 1];
                      if (previous) {
                        definition.rows[index - 1] = row;
                        definition.rows[index] = previous;
                      }
                    }}
                  >
                    上移
                  </Button>
                  <Button
                    danger
                    disabled={definition.rows.length <= 1}
                    onClick={() => {
                      definition.rows.splice(index, 1);
                    }}
                  >
                    删除
                  </Button>
                </Space>
              }
              key={row.id}
              title={`决策行 ${index + 1}`}
            >
              <ConditionEditor
                fields={definition.factSchema.fields}
                onChange={(value) => {
                  row.condition = value;
                }}
                value={row.condition}
              />
            </Card>
          ))}
          <Button
            disabled={definition.rows.length >= 64}
            onClick={() =>
              definition.rows.push({
                id: `row_${crypto.randomUUID()}`,
                condition: newCondition(definition.factSchema.fields),
                result: definition.defaultResult,
              })
            }
          >
            添加决策行
          </Button>
        </div>
      );
    };
    const testsPanel = () => (
      <div class="grid gap-4 lg:grid-cols-2">
        <Card title="输入事实">
          <FormRenderer definition={factForm.value} ref={tester} />
          <Button onClick={test} type="primary">
            执行规则测试
          </Button>
          {previewError.value && (
            <Alert message={previewError.value} type="error" />
          )}
          {preview.value && (
            <div class="mt-4">
              <Tag>{`结果：${String(preview.value.result)}`}</Tag>
              <span>命中行：{preview.value.matchedRowId || '无'}</span>
              <ConditionTrace
                fields={editor.definition.value?.factSchema.fields || []}
                trace={preview.value.trace || []}
              />
            </div>
          )}
        </Card>
        <Card title="保存的测试用例">
          <div class="space-y-4">
            <Input
              onChange={(event) => {
                caseName.value = event.target.value || '';
              }}
              placeholder="用例名称"
              value={caseName.value}
            />
            <Space>
              <span>预期结果</span>
              {scalarInput(expected.value, (value) => {
                expected.value = value;
              })}
              <Button onClick={saveCase}>加入用例</Button>
            </Space>
            {editor.definition.value?.testCases.map((item, index) => (
              <div class="flex justify-between border-b pb-2" key={index}>
                <span>
                  {item.name} → {String(item.expected)}
                </span>
                <Button
                  danger
                  onClick={() =>
                    editor.definition.value?.testCases.splice(index, 1)
                  }
                >
                  删除
                </Button>
              </div>
            ))}
            {preview.value?.cases.map((item) => (
              <Alert
                key={item.name}
                message={`${item.name}：预期 ${String(item.expected)}，实际 ${String(item.actual)}`}
                type={testResultType(item.passed)}
              />
            ))}
          </div>
        </Card>
      </div>
    );
    return () => (
      <Page>
        <div class="space-y-4">
          <div class="flex flex-wrap justify-between gap-3">
            <Space>
              <Button onClick={editor.back}>返回规则管理</Button>
              <Input
                onChange={(event) => {
                  editor.name.value = event.target.value || '';
                }}
                value={editor.name.value}
              />
              <Select
                onChange={setMode}
                options={[
                  { label: '条件树', value: 'condition' },
                  { label: '决策表', value: 'decision-table' },
                ]}
                value={editor.definition.value?.mode}
              />
            </Space>
            <Space>
              <Button loading={editor.loading.value} onClick={editor.save}>
                保存
              </Button>
              <Button
                loading={editor.loading.value}
                onClick={editor.publish}
                type="primary"
              >
                发布版本
              </Button>
            </Space>
          </div>
          {editor.error.value && (
            <Alert message={editor.error.value} type="error" />
          )}
          <Tabs
            activeKey={tab.value}
            items={[
              { key: 'facts', label: '事实目录', content: factsPanel },
              {
                key: 'conditions',
                label: '规则设计',
                content: conditionsPanel,
              },
              { key: 'tests', label: '规则测试', content: testsPanel },
            ]}
            onChange={(key) => {
              tab.value = String(key);
            }}
          />
        </div>
      </Page>
    );
  },
});
