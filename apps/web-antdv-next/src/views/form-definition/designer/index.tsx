import type { DataField } from '#/api/automation/definition';
import type { FormControl, FormDefinition } from '#/api/form-definition';
import { computed, defineComponent, ref } from 'vue';
import { Page } from '@vben/common-ui';
import { Alert, Button, Card, Empty, Input, Select, Space, Spin, Tag } from 'antdv-next';
import { formApi } from '#/api/form-definition';
import { useDefinitionEditor } from '#/components/kt-definition-list/useDefinitionEditor';
import FieldSchemaEditor from '#/components/kt-dynamic-form/FieldSchemaEditor';
import FormRenderer from '#/components/kt-dynamic-form/FormRenderer';

const palette: { label: string; component: FormControl; type: DataField['type']; format?: DataField['format']; options?: DataField['options'] }[] = [
  { label: '单行文本', component: 'Input', type: 'string' },
  { label: '多行文本', component: 'Textarea', type: 'string' },
  { label: '数字', component: 'InputNumber', type: 'number' },
  { label: '开关', component: 'Switch', type: 'boolean' },
  { label: '下拉选择', component: 'Select', type: 'string', options: [{ label: '选项一', value: 'first' }] },
  { label: '单选组', component: 'RadioGroup', type: 'string', options: [{ label: '选项一', value: 'first' }] },
  { label: '日期', component: 'DatePicker', type: 'string', format: 'date' },
  { label: '日期和时间', component: 'DatePicker', type: 'string', format: 'date-time' },
];

/**
 * 根据当前字段契约列出可用控件，类型调整时不会保留不相容的旧控件。
 * @param field - 正在设计的字段。
 * @returns Vben 已注册且满足该字段契约的控件名。
 */
function allowedControls(field: DataField): FormControl[] {
  if (field.type === 'boolean') return ['Switch'];
  if (field.options) return ['Select', 'RadioGroup'];
  if (field.format) return ['DatePicker'];
  if (field.type === 'number' || field.type === 'integer') return ['InputNumber'];
  return ['Input', 'Textarea'];
}

export default defineComponent({
  name: 'AutomationFormDesigner',
  setup() {
    const editor = useDefinitionEditor(formApi, 'formId', '/automation/forms');
    const selected = ref(0);
    const current = computed(() => editor.definition.value?.dataSchema.fields[selected.value]);
    const addField = (template: typeof palette[number]) => {
      const definition = editor.definition.value;
      if (!definition || definition.dataSchema.fields.length >= 64) return;
      let number = definition.dataSchema.fields.length + 1;
      while (definition.dataSchema.fields.some((field) => field.key === `field_${number}`)) number += 1;
      const field: DataField = { key: `field_${number}`, label: template.label, type: template.type, required: false };
      if (template.format) field.format = template.format;
      if (template.options) field.options = structuredClone(template.options);
      definition.dataSchema.fields.push(field);
      definition.uiSchema.fields.push({ key: field.key, component: template.component, span: 1, placeholder: '', help: '' });
      selected.value = definition.dataSchema.fields.length - 1;
    };
    const changeField = (field: DataField) => {
      const definition = editor.definition.value;
      const previous = current.value;
      if (!definition || !previous) return;
      const layout = definition.uiSchema.fields.find((item) => item.key === previous.key);
      if (!layout) return;
      layout.key = field.key;
      const allowed = allowedControls(field);
      if (!allowed.includes(layout.component)) layout.component = allowed[0]!;
      definition.dataSchema.fields[selected.value] = field;
    };
    const removeField = () => {
      const definition = editor.definition.value;
      if (!definition || !current.value) return;
      const key = current.value.key;
      definition.dataSchema.fields.splice(selected.value, 1);
      definition.uiSchema.fields = definition.uiSchema.fields.filter((field) => field.key !== key);
      selected.value = Math.max(0, selected.value - 1);
    };
    const moveField = (direction: number) => {
      const definition = editor.definition.value;
      const destination = selected.value + direction;
      if (!definition || destination < 0 || destination >= definition.dataSchema.fields.length) return;
      const fields = definition.dataSchema.fields;
      const item = fields.splice(selected.value, 1)[0];
      if (!item) return;
      fields.splice(destination, 0, item);
      definition.uiSchema.fields = fields.map((field) => definition.uiSchema.fields.find((layout) => layout.key === field.key)!);
      selected.value = destination;
    };
    const inspector = () => {
      const definition = editor.definition.value;
      const field = current.value;
      if (!definition || !field) return <Empty description="选择或添加字段" />;
      const layout = definition.uiSchema.fields.find((item) => item.key === field.key);
      if (!layout) return null;
      return <div class="space-y-4"><FieldSchemaEditor field={field} onChange={changeField} />
        <label class="block">控件<Select class="w-full" value={layout.component} options={allowedControls(field).map((component) => ({ label: component, value: component }))} onChange={(value) => { layout.component = value as FormControl; }} /></label>
        <label class="block">跨列数<Select class="w-full" value={layout.span} options={Array.from({ length: definition.uiSchema.columns }, (_, index) => ({ label: `${index + 1} 列`, value: index + 1 }))} onChange={(value) => { layout.span = Number(value); }} /></label>
        <label class="block">占位提示<Input value={layout.placeholder} onChange={(event) => { layout.placeholder = event.target.value || ''; }} /></label>
        <label class="block">帮助说明<Input value={layout.help} onChange={(event) => { layout.help = event.target.value || ''; }} /></label>
        <Space><Button onClick={() => moveField(-1)}>上移</Button><Button onClick={() => moveField(1)}>下移</Button><Button danger onClick={removeField}>删除字段</Button></Space>
      </div>;
    };
    const canvas = () => {
      const definition = editor.definition.value;
      if (!definition) return null;
      if (!definition.dataSchema.fields.length) return <Empty description="从左侧选择控件，开始设计表单" />;
      return <div class="grid gap-4" style={{ gridTemplateColumns: `repeat(${definition.uiSchema.columns}, minmax(0, 1fr))` }}>{definition.uiSchema.fields.map((layout) => {
        const field = definition.dataSchema.fields.find((item) => item.key === layout.key);
        if (!field) return null;
        const fragment: FormDefinition = { schemaVersion: 1, dataSchema: { fields: [field] }, uiSchema: { columns: 1, fields: [{ ...layout, span: 1 }] } };
        return <div key={layout.key} class="rounded border p-3" style={{ gridColumn: `span ${layout.span}` }} onClick={() => { selected.value = definition.dataSchema.fields.findIndex((item) => item.key === field.key); }}>
          <Button type="link" size="small" onClick={() => { selected.value = definition.dataSchema.fields.findIndex((item) => item.key === field.key); }}>编辑 {field.key}</Button><FormRenderer definition={fragment} />
        </div>;
      })}</div>;
    };
    return () => <Page><div class="space-y-4">
      <div class="flex flex-wrap justify-between gap-3 items-center"><Space><Button onClick={editor.back}>返回表单管理</Button><Input style={{ width: '240px' }} value={editor.name.value} onChange={(event) => { editor.name.value = event.target.value || ''; }} /><Tag>{`草稿 ${editor.document.value?.revision || 0}`}</Tag></Space><Space><Button loading={editor.loading.value} onClick={editor.save}>保存</Button><Button type="primary" loading={editor.loading.value} onClick={editor.publish}>发布版本</Button></Space></div>
      <Input placeholder="表单说明" value={editor.description.value} onChange={(event) => { editor.description.value = event.target.value || ''; }} />
      {editor.error.value && <Alert type="error" message={editor.error.value} />}
      <Spin spinning={editor.loading.value}><div class="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)_320px]">
        <Card title="控件库"><div class="space-y-2">{palette.map((item) => <Button key={item.label} block onClick={() => addField(item)}>{item.label}</Button>)}</div></Card>
        <Card title="表单画布" extra={<Select style={{ width: '100px' }} value={editor.definition.value?.uiSchema.columns} options={[{ label: '单列', value: 1 }, { label: '双列', value: 2 }, { label: '三列', value: 3 }]} onChange={(value) => { const definition = editor.definition.value; if (!definition) return; definition.uiSchema.columns = value as 1 | 2 | 3; for (const field of definition.uiSchema.fields) field.span = Math.min(field.span, Number(value)); }}></Select>}>{canvas()}</Card>
        <Card title="字段属性">{inspector()}</Card>
      </div></Spin>
    </div></Page>;
  },
});
