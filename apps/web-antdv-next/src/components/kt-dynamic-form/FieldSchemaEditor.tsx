import type { PropType } from 'vue';

import type { DataField, DataScalar } from '#/api/automation/definition';

import { defineComponent } from 'vue';

import {
  Button,
  Checkbox,
  Input,
  InputNumber,
  Select,
  Space,
} from 'antdv-next';

export default defineComponent({
  name: 'KtFieldSchemaEditor',
  props: { field: { type: Object as PropType<DataField>, required: true } },
  emits: { change: (_field: DataField) => true },
  setup(props, { emit }) {
    const update = (patch: Partial<DataField>) =>
      emit('change', { ...props.field, ...patch });
    const setType = (value: unknown) => {
      const type = value as DataField['type'];
      emit('change', {
        key: props.field.key,
        label: props.field.label,
        required: props.field.required,
        type,
      });
    };
    const options = () => {
      if (!props.field.options) return null;
      return (
        <div class="space-y-2">
          {props.field.options.map((option, index) => (
            <div class="flex gap-2" key={index}>
              <Input
                aria-label="选项名称"
                onChange={(event) => {
                  const next = [...(props.field.options || [])];
                  next[index] = { ...option, label: event.target.value || '' };
                  update({ options: next });
                }}
                value={option.label}
              />
              <Input
                aria-label="选项值"
                onChange={(event) => {
                  const text = event.target.value || '';
                  let value: DataScalar = text;
                  if (
                    props.field.type === 'number' ||
                    props.field.type === 'integer'
                  )
                    value = Number(text);
                  if (props.field.type === 'boolean') value = text === 'true';
                  const next = [...(props.field.options || [])];
                  next[index] = { ...option, value };
                  update({ options: next });
                }}
                value={String(option.value)}
              />
              <Button
                danger
                onClick={() =>
                  update({
                    options: props.field.options?.filter(
                      (_, item) => item !== index,
                    ),
                  })
                }
              >
                移除
              </Button>
            </div>
          ))}
          <Button
            onClick={() => {
              let value: DataScalar = '';
              if (
                props.field.type === 'number' ||
                props.field.type === 'integer'
              )
                value = 0;
              if (props.field.type === 'boolean') value = false;
              update({
                options: [
                  ...(props.field.options || []),
                  { label: '新选项', value },
                ],
              });
            }}
          >
            添加选项
          </Button>
        </div>
      );
    };
    const constraints = () => {
      if (props.field.type === 'boolean') return null;
      let minLabel = '最小值';
      let maxLabel = '最大值';
      if (props.field.type === 'string') {
        minLabel = '最短长度';
        maxLabel = '最长长度';
      }
      return (
        <Space>
          <label>
            {minLabel}
            <InputNumber
              onChange={(value) => {
                if (value === null) {
                  update({ min: undefined });
                  return;
                }
                update({ min: Number(value) });
              }}
              value={props.field.min}
            />
          </label>
          <label>
            {maxLabel}
            <InputNumber
              onChange={(value) => {
                if (value === null) {
                  update({ max: undefined });
                  return;
                }
                update({ max: Number(value) });
              }}
              value={props.field.max}
            />
          </label>
        </Space>
      );
    };
    const format = () => {
      if (props.field.type !== 'string' || props.field.options) return null;
      return (
        <label class="block">
          格式
          <Select
            class="w-full"
            onChange={(value) => {
              if (!value) {
                update({ format: undefined });
                return;
              }
              update({ format: value as DataField['format'] });
            }}
            options={[
              { label: '普通文本', value: '' },
              { label: '日期', value: 'date' },
              { label: '日期和时间', value: 'date-time' },
            ]}
            value={props.field.format || ''}
          />
        </label>
      );
    };
    return () => (
      <div class="space-y-4">
        <label class="block">
          字段标识
          <Input
            maxlength={64}
            onChange={(event) => update({ key: event.target.value || '' })}
            value={props.field.key}
          />
        </label>
        <label class="block">
          显示名称
          <Input
            maxlength={80}
            onChange={(event) => update({ label: event.target.value || '' })}
            value={props.field.label}
          />
        </label>
        <label class="block">
          数据类型
          <Select
            class="w-full"
            onChange={setType}
            options={[
              { label: '文本', value: 'string' },
              { label: '数字', value: 'number' },
              { label: '整数', value: 'integer' },
              { label: '开关', value: 'boolean' },
            ]}
            value={props.field.type}
          />
        </label>
        <Checkbox
          checked={props.field.required}
          onChange={(event) => update({ required: event.target.checked })}
        >
          必填
        </Checkbox>
        {constraints()}
        {format()}
        <Checkbox
          checked={Boolean(props.field.options)}
          onChange={(event) => {
            if (event.target.checked) {
              let value: DataScalar = '';
              if (
                props.field.type === 'number' ||
                props.field.type === 'integer'
              )
                value = 0;
              if (props.field.type === 'boolean') value = false;
              update({
                options: [{ label: '选项一', value }],
                format: undefined,
              });
            } else update({ options: undefined });
          }}
        >
          限定枚举选项
        </Checkbox>
        {options()}
      </div>
    );
  },
});
