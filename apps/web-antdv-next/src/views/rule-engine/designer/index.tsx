import type { DataField } from '#/api/automation/definition';
import type { RuleCondition, RulePreview, RuleScalar } from '#/api/rule-engine';
import { computed, defineComponent, ref } from 'vue';
import { Page } from '@vben/common-ui';
import { Alert, Button, Card, Input, InputNumber, message, Select, Space, Switch, Tabs, Tag } from 'antdv-next';
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
function renameFact(condition: RuleCondition, previous: string, next: string): RuleCondition {
  if (condition.type === 'all' || condition.type === 'any') return { ...condition, rules: condition.rules.map((rule) => renameFact(rule, previous, next)) };
  if (condition.type === 'not') return { ...condition, rule: renameFact(condition.rule, previous, next) };
  if (condition.type === 'compare' && condition.path === previous) return { ...condition, path: next };
  return condition;
}

export default defineComponent({
  name: 'AutomationRuleDesigner',
  setup() {
    const editor = useDefinitionEditor(ruleApi, 'ruleId', '/automation/rules');
    const tab = ref('conditions');
    const selectedFact = ref(0);
    const tester = ref<{ validate: () => Promise<Record<string, unknown> | undefined> }>();
    const preview = ref<RulePreview>();
    const expected = ref<RuleScalar>(true);
    const caseName = ref('');
    const previewError = ref('');
    const testResultType = (passed: boolean) => { if (passed) return 'success'; return 'error'; };
    const factForm = computed(() => formFromDataSchema(editor.definition.value?.factSchema || { fields: [] }));
    const changeFact = (field: DataField) => {
      const definition = editor.definition.value;
      const previous = definition?.factSchema.fields[selectedFact.value];
      if (!definition || !previous) return;
      definition.factSchema.fields[selectedFact.value] = field;
      if (definition.mode === 'condition') definition.condition = renameFact(definition.condition, previous.key, field.key);
      else for (const row of definition.rows) row.condition = renameFact(row.condition, previous.key, field.key);
    };
    const addFact = () => {
      const definition = editor.definition.value;
      if (!definition || definition.factSchema.fields.length >= 64) return;
      let index = definition.factSchema.fields.length + 1;
      while (definition.factSchema.fields.some((field) => field.key === `fact_${index}`)) index += 1;
      definition.factSchema.fields.push({ key: `fact_${index}`, label: '新事实', type: 'string', required: false });
      selectedFact.value = definition.factSchema.fields.length - 1;
    };
    const scalarInput = (value: RuleScalar, change: (value: RuleScalar) => void) => {
      if (typeof value === 'boolean') return <Switch checked={value} onChange={(next) => change(Boolean(next))} />;
      if (typeof value === 'number') return <InputNumber value={value} onChange={(next) => change(Number(next))} />;
      return <Input value={String(value || '')} onChange={(event) => change(event.target.value || '')} />;
    };
    const setMode = (mode: unknown) => {
      const definition = editor.definition.value;
      if (!definition || definition.mode === mode) return;
      if (mode === 'condition') {
        let condition = newCondition(definition.factSchema.fields);
        if (definition.mode === 'decision-table' && definition.rows[0]) condition = definition.rows[0].condition;
        editor.definition.value = { schemaVersion: 1, factSchema: definition.factSchema, testCases: [], mode: 'condition', condition };
      } else {
        let condition = newCondition(definition.factSchema.fields);
        if (definition.mode === 'condition') condition = definition.condition;
        editor.definition.value = { schemaVersion: 1, factSchema: definition.factSchema, testCases: [], mode: 'decision-table', rows: [{ id: 'row_1', condition, result: true }], defaultResult: false };
      }
      preview.value = undefined;
    };
    const test = async () => {
      const facts = await tester.value?.validate();
      if (!facts || !editor.definition.value) return;
      previewError.value = '';
      try { preview.value = await ruleApi.preview(editor.definition.value, facts); }
      catch (error) { previewError.value = String(error); }
    };
    const saveCase = async () => {
      const facts = await tester.value?.validate();
      if (!facts || !editor.definition.value || !caseName.value.trim()) { message.warning('填写用例名称和有效事实'); return; }
      editor.definition.value.testCases.push({ name: caseName.value.trim(), facts, expected: expected.value });
      caseName.value = '';
    };
    const factsPanel = () => {
      const definition = editor.definition.value;
      if (!definition) return null;
      const current = definition.factSchema.fields[selectedFact.value];
      return <div class="grid gap-4 lg:grid-cols-[240px_1fr]"><Card title="事实目录" extra={<Button onClick={addFact}>新增</Button>}><div class="space-y-2">{definition.factSchema.fields.map((field, index) => <Button block key={index} onClick={() => { selectedFact.value = index; }}>{field.label} · {field.key}</Button>)}</div></Card><Card title="事实字段">{current && <FieldSchemaEditor field={current} onChange={changeFact} />}</Card></div>;
    };
    const conditionsPanel = () => {
      const definition = editor.definition.value;
      if (!definition) return null;
      if (definition.mode === 'condition') return <ConditionEditor value={definition.condition} fields={definition.factSchema.fields} onChange={(value) => { definition.condition = value; }} />;
      return <div class="space-y-4"><Alert type="info" message="按行顺序匹配，第一条命中的结果作为决策输出。" />
        <Space><span>输出类型</span><Select value={typeof definition.defaultResult} options={[{ label: '是否', value: 'boolean' }, { label: '文本', value: 'string' }, { label: '数字', value: 'number' }]} onChange={(type) => { let value: RuleScalar = ''; if (type === 'boolean') value = false; if (type === 'number') value = 0; definition.defaultResult = value; for (const row of definition.rows) row.result = value; expected.value = value; }} /><span>未命中结果</span>{scalarInput(definition.defaultResult, (value) => { definition.defaultResult = value; })}</Space>
        {definition.rows.map((row, index) => <Card key={row.id} title={`决策行 ${index + 1}`} extra={<Space><span>输出</span>{scalarInput(row.result, (value) => { row.result = value; })}<Button disabled={index === 0} onClick={() => { const previous = definition.rows[index - 1]; if (previous) { definition.rows[index - 1] = row; definition.rows[index] = previous; } }}>上移</Button><Button danger disabled={definition.rows.length <= 1} onClick={() => { definition.rows.splice(index, 1); }}>删除</Button></Space>}><ConditionEditor value={row.condition} fields={definition.factSchema.fields} onChange={(value) => { row.condition = value; }} /></Card>)}
        <Button disabled={definition.rows.length >= 64} onClick={() => definition.rows.push({ id: `row_${crypto.randomUUID()}`, condition: newCondition(definition.factSchema.fields), result: definition.defaultResult })}>添加决策行</Button>
      </div>;
    };
    const testsPanel = () => <div class="grid gap-4 lg:grid-cols-2"><Card title="输入事实"><FormRenderer ref={tester} definition={factForm.value} /><Button type="primary" onClick={test}>执行规则测试</Button>{previewError.value && <Alert type="error" message={previewError.value} />}{preview.value && <div class="mt-4"><Tag>{`结果：${String(preview.value.result)}`}</Tag><span>命中行：{preview.value.matchedRowId || '无'}</span><ConditionTrace trace={preview.value.trace || []} fields={editor.definition.value?.factSchema.fields || []} /></div>}</Card><Card title="保存的测试用例"><div class="space-y-4"><Input placeholder="用例名称" value={caseName.value} onChange={(event) => { caseName.value = event.target.value || ''; }} /><Space><span>预期结果</span>{scalarInput(expected.value, (value) => { expected.value = value; })}<Button onClick={saveCase}>加入用例</Button></Space>{editor.definition.value?.testCases.map((item, index) => <div key={index} class="flex justify-between border-b pb-2"><span>{item.name} → {String(item.expected)}</span><Button danger onClick={() => editor.definition.value?.testCases.splice(index, 1)}>删除</Button></div>)}{preview.value?.cases.map((item) => <Alert key={item.name} type={testResultType(item.passed)} message={`${item.name}：预期 ${String(item.expected)}，实际 ${String(item.actual)}`} />)}</div></Card></div>;
    return () => <Page><div class="space-y-4"><div class="flex flex-wrap justify-between gap-3"><Space><Button onClick={editor.back}>返回规则管理</Button><Input value={editor.name.value} onChange={(event) => { editor.name.value = event.target.value || ''; }} /><Select value={editor.definition.value?.mode} options={[{ label: '条件树', value: 'condition' }, { label: '决策表', value: 'decision-table' }]} onChange={setMode} /></Space><Space><Button loading={editor.loading.value} onClick={editor.save}>保存</Button><Button type="primary" loading={editor.loading.value} onClick={editor.publish}>发布版本</Button></Space></div>
      {editor.error.value && <Alert type="error" message={editor.error.value} />}
      <Tabs activeKey={tab.value} onChange={(key) => { tab.value = String(key); }} items={[{ key: 'facts', label: '事实目录', content: factsPanel }, { key: 'conditions', label: '规则设计', content: conditionsPanel }, { key: 'tests', label: '规则测试', content: testsPanel }]} />
    </div></Page>;
  },
});
