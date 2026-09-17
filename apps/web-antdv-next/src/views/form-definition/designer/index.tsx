import type { DataField } from '#/api/automation/definition';
import type { FormControl } from '#/api/form-definition';

import { computed, defineComponent, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Empty,
  Input,
  message,
  Segmented,
  Select,
  Space,
} from 'antdv-next';

import { formApi } from '#/api/form-definition';
import EditorHeader from '#/components/kt-automation/EditorHeader';
import { useDefinitionEditor } from '#/components/kt-definition-list/useDefinitionEditor';
import { nextFieldKey } from '#/components/kt-dynamic-form/field-options';
import FieldSchemaEditor from '#/components/kt-dynamic-form/FieldSchemaEditor';
import FormRenderer from '#/components/kt-dynamic-form/FormRenderer';
import ScalarValueInput from '#/components/kt-dynamic-form/ScalarValueInput';
import { AUTOMATION_PATH } from '#/constants/automation/resources';

const palette: {
  component: FormControl;
  format?: DataField['format'];
  label: string;
  options?: DataField['options'];
  type: DataField['type'];
}[] = [
  { label: '单行文本', component: 'Input', type: 'string' },
  { label: '多行文本', component: 'Textarea', type: 'string' },
  { label: '数字', component: 'InputNumber', type: 'number' },
  { label: '开关', component: 'Switch', type: 'boolean' },
  {
    label: '下拉选择',
    component: 'Select',
    type: 'string',
    options: [{ label: '选项一', value: 'first' }],
  },
  {
    label: '单选组',
    component: 'RadioGroup',
    type: 'string',
    options: [{ label: '选项一', value: 'first' }],
  },
  { label: '日期', component: 'DatePicker', type: 'string', format: 'date' },
  {
    label: '日期和时间',
    component: 'DatePicker',
    type: 'string',
    format: 'date-time',
  },
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
  if (field.type === 'number' || field.type === 'integer')
    return ['InputNumber'];
  return ['Input', 'Textarea'];
}

export default defineComponent({
  name: 'AutomationFormDesigner',
  setup() {
    const editor = useDefinitionEditor(
      formApi,
      'formId',
      AUTOMATION_PATH.forms,
    );
    const selected = ref(0);
    const mode = ref('design');
    const dragged = ref<number>();
    const renderer = ref<{
      validate: () => Promise<Record<string, unknown> | undefined>;
    }>();
    const previewValid = ref(false);
    const current = computed(
      () => editor.definition.value?.dataSchema.fields[selected.value],
    );
    const addField = (template: (typeof palette)[number]) => {
      const definition = editor.definition.value;
      if (!definition || definition.dataSchema.fields.length >= 64) return;
      const key = nextFieldKey(definition.dataSchema.fields, 'field');
      const field: DataField = {
        key,
        label: template.label,
        type: template.type,
        required: false,
      };
      if (template.format) field.format = template.format;
      if (template.options) field.options = structuredClone(template.options);
      definition.dataSchema.fields.push(field);
      definition.uiSchema.fields.push({
        key: field.key,
        component: template.component,
        span: 1,
        placeholder: '',
        help: '',
      });
      selected.value = definition.dataSchema.fields.length - 1;
    };
    const changeField = (field: DataField) => {
      const definition = editor.definition.value;
      const previous = current.value;
      if (!definition || !previous) return;
      const layout = definition.uiSchema.fields.find(
        (item) => item.key === previous.key,
      );
      if (!layout) return;
      layout.key = field.key;
      for (const item of definition.uiSchema.fields) {
        if (item.requiredWhen?.field === previous.key)
          item.requiredWhen.field = field.key;
      }
      if (field.required) delete layout.requiredWhen;
      const allowed = allowedControls(field);
      const firstComponent = allowed[0];
      if (!allowed.includes(layout.component) && firstComponent)
        layout.component = firstComponent;
      definition.dataSchema.fields[selected.value] = field;
    };
    const removeField = () => {
      const definition = editor.definition.value;
      if (!definition || !current.value) return;
      const key = current.value.key;
      if (
        definition.uiSchema.fields.some(
          (layout) => layout.requiredWhen?.field === key,
        )
      ) {
        message.warning('其他字段的必填条件正在引用此字段，请先调整条件。');
        return;
      }
      definition.dataSchema.fields.splice(selected.value, 1);
      definition.uiSchema.fields = definition.uiSchema.fields.filter(
        (field) => field.key !== key,
      );
      selected.value = Math.max(0, selected.value - 1);
    };
    const moveField = (direction: number) => {
      const definition = editor.definition.value;
      const destination = selected.value + direction;
      if (
        !definition ||
        destination < 0 ||
        destination >= definition.dataSchema.fields.length
      )
        return;
      const fields = definition.dataSchema.fields;
      const item = fields.splice(selected.value, 1)[0];
      if (!item) return;
      fields.splice(destination, 0, item);
      const layouts = new Map(
        definition.uiSchema.fields.map((layout) => [layout.key, layout]),
      );
      definition.uiSchema.fields = fields.flatMap((field) => {
        const layout = layouts.get(field.key);
        if (layout) return [layout];
        return [];
      });
      selected.value = destination;
    };
    const inspector = () => {
      const definition = editor.definition.value;
      const field = current.value;
      if (!definition || !field) return <Empty description="选择或添加字段" />;
      const layout = definition.uiSchema.fields.find(
        (item) => item.key === field.key,
      );
      if (!layout) return null;
      const dependency = definition.dataSchema.fields.find(
        (item) => item.key === layout.requiredWhen?.field,
      );
      return (
        <div class="space-y-4">
          <FieldSchemaEditor field={field} onChange={changeField} />
          <label class="block">
            控件
            <Select
              class="w-full"
              onChange={(value) => {
                layout.component = value as FormControl;
              }}
              options={allowedControls(field).map((component) => ({
                label:
                  palette.find((item) => item.component === component)?.label ||
                  component,
                value: component,
              }))}
              value={layout.component}
            />
          </label>
          <label class="block">
            跨列数
            <Select
              class="w-full"
              onChange={(value) => {
                layout.span = Number(value);
              }}
              options={Array.from(
                { length: definition.uiSchema.columns },
                (_, index) => ({ label: `${index + 1} 列`, value: index + 1 }),
              )}
              value={layout.span}
            />
          </label>
          <label class="block">
            占位提示
            <Input
              onChange={(event) => {
                layout.placeholder = event.target.value || '';
              }}
              value={layout.placeholder}
            />
          </label>
          <label class="block">
            帮助说明
            <Input
              onChange={(event) => {
                layout.help = event.target.value || '';
              }}
              value={layout.help}
            />
          </label>
          <Space>
            <Button onClick={() => moveField(-1)}>上移</Button>
            <Button onClick={() => moveField(1)}>下移</Button>
            <Button danger onClick={removeField}>
              删除字段
            </Button>
          </Space>
          <div class="automation-field-condition">
            <strong>条件必填</strong>
            <Select
              allowClear
              aria-label="条件必填字段"
              class="w-full"
              onChange={(value) => {
                const source = definition.dataSchema.fields.find(
                  (item) => item.key === value,
                );
                if (!source) {
                  delete layout.requiredWhen;
                  return;
                }
                let equals: boolean | number | string = '';
                if (source.type === 'boolean') equals = true;
                if (source.type === 'number' || source.type === 'integer')
                  equals = source.min ?? 0;
                if (source.options?.[0]) equals = source.options[0].value;
                layout.requiredWhen = { field: source.key, equals };
                field.required = false;
              }}
              options={definition.dataSchema.fields
                .filter((item) => item.key !== field.key)
                .map((item) => ({ label: item.label, value: item.key }))}
              placeholder="选择条件字段"
              value={layout.requiredWhen?.field}
            />
            {layout.requiredWhen && dependency && (
              <div class="automation-field-condition__value">
                <span>等于</span>
                <ScalarValueInput
                  field={dependency}
                  onChange={(value) => {
                    if (value !== undefined && layout.requiredWhen)
                      layout.requiredWhen.equals = value;
                  }}
                  value={layout.requiredWhen.equals}
                />
              </div>
            )}
          </div>
        </div>
      );
    };
    const testForm = async () => {
      previewValid.value = false;
      try {
        const values = await renderer.value?.validate();
        if (!values || !editor.definition.value) return;
        await formApi.preview(editor.definition.value, values);
        previewValid.value = true;
        message.success('填写内容通过校验，尚未提交业务');
      } catch {
        previewValid.value = false;
      }
    };
    const fieldIcons: Record<FormControl, string> = {
      Input: 'lucide:type',
      Textarea: 'lucide:align-left',
      InputNumber: 'lucide:hash',
      Switch: 'lucide:toggle-right',
      Select: 'lucide:list-filter',
      RadioGroup: 'lucide:circle-dot',
      DatePicker: 'lucide:calendar-days',
    };
    return () => (
      <Page autoContentHeight contentClass="automation-designer-viewport">
        <div class="automation-page automation-page--designer">
          <EditorHeader
            description={editor.description.value}
            dirty={editor.dirty.value}
            label="表单管理"
            loading={editor.loading.value}
            name={editor.name.value}
            onBack={editor.back}
            onDescriptionChange={(description) => {
              editor.description.value = description;
            }}
            onNameChange={(name) => {
              editor.name.value = name;
            }}
            onPublish={editor.publish}
            onSave={editor.save}
            permission="Automation:Form"
            publishedVersion={
              editor.document.value?.publishedVersion ?? undefined
            }
            revision={editor.document.value?.revision}
          />
          {editor.error.value && (
            <Alert message={editor.error.value} showIcon type="error" />
          )}
          <div class="automation-studio">
            <aside class="automation-studio__panel">
              <div class="automation-studio__panel-heading">
                <h2>添加字段</h2>
              </div>
              <div class="automation-studio__panel-body">
                <div class="automation-palette">
                  {palette.map((item) => (
                    <button
                      class="automation-palette__item"
                      disabled={
                        editor.loading.value ||
                        (editor.definition.value?.dataSchema.fields.length ||
                          0) >= 64
                      }
                      key={item.label}
                      onClick={() => {
                        addField(item);
                        mode.value = 'design';
                        previewValid.value = false;
                      }}
                      type="button"
                    >
                      <IconifyIcon icon={fieldIcons[item.component]} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div class="automation-studio__panel-heading">
                <h2>字段顺序</h2>
              </div>
              <div class="automation-studio__panel-body automation-outline">
                {editor.definition.value?.dataSchema.fields.map(
                  (field, index) => (
                    <button
                      aria-pressed={selected.value === index}
                      class="automation-outline__item"
                      draggable
                      key={field.key}
                      onClick={() => {
                        selected.value = index;
                        mode.value = 'design';
                      }}
                      onDragend={() => {
                        dragged.value = undefined;
                      }}
                      onDragover={(event) => event.preventDefault()}
                      onDragstart={() => {
                        dragged.value = index;
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragged.value === undefined) return;
                        selected.value = dragged.value;
                        moveField(index - dragged.value);
                        dragged.value = undefined;
                      }}
                      type="button"
                    >
                      <IconifyIcon icon="lucide:grip-vertical" />
                      <span>{field.label}</span>
                      <small>{index + 1}</small>
                    </button>
                  ),
                )}
                {!editor.definition.value?.dataSchema.fields.length && (
                  <p class="automation-muted">暂无字段</p>
                )}
              </div>
            </aside>
            <main class="automation-studio__canvas">
              <div class="automation-studio__toolbar">
                <Segmented
                  onChange={(value) => {
                    mode.value = String(value);
                    previewValid.value = false;
                  }}
                  options={[
                    { label: '表单设计', value: 'design' },
                    { label: '填写预览', value: 'preview' },
                  ]}
                  value={mode.value}
                />
                <Select
                  aria-label="表单列数"
                  onChange={(value) => {
                    const definition = editor.definition.value;
                    if (!definition) return;
                    definition.uiSchema.columns = value as 1 | 2 | 3;
                    for (const field of definition.uiSchema.fields)
                      field.span = Math.min(field.span, Number(value));
                  }}
                  options={[
                    { label: '单列布局', value: 1 },
                    { label: '双列布局', value: 2 },
                    { label: '三列布局', value: 3 },
                  ]}
                  style={{ width: '112px' }}
                  value={editor.definition.value?.uiSchema.columns}
                />
              </div>
              <div class="automation-form-stage">
                <div class="automation-form-paper">
                  <h2>{editor.name.value || '未命名表单'}</h2>
                  {editor.definition.value &&
                    editor.definition.value.dataSchema.fields.length > 0 && (
                      <FormRenderer
                        definition={editor.definition.value}
                        onChange={() => {
                          previewValid.value = false;
                        }}
                        ref={renderer}
                      />
                    )}
                  {editor.definition.value?.dataSchema.fields.length === 0 && (
                    <Empty description="暂无字段" />
                  )}
                  {mode.value === 'preview' && (
                    <div class="automation-form-feedback">
                      <Button onClick={testForm} type="primary">
                        验证填写
                      </Button>
                    </div>
                  )}
                  {previewValid.value && (
                    <Alert
                      class="automation-form-feedback"
                      message="填写校验通过 · 预览不会发起业务"
                      showIcon
                      type="success"
                    />
                  )}
                </div>
              </div>
            </main>
            <aside class="automation-studio__panel automation-studio__inspector">
              <div class="automation-studio__panel-heading">
                <h2>字段属性</h2>
                <small>{current.value?.key}</small>
              </div>
              <div class="automation-studio__panel-body">{inspector()}</div>
            </aside>
          </div>
        </div>
      </Page>
    );
  },
});
