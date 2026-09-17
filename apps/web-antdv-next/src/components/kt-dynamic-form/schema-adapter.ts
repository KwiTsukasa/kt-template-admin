import type { VbenFormSchema } from '#/adapter/form';
import type { DataField, DataSchema } from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';

import { z } from '#/adapter/form';

/**
 * 将标量值按服务端相同的字段约束校验，避免控件展示正常但提交数据类型错误。
 * @param field - 当前字段的数据契约。
 * @param value - 表单控件当前填写的原始值，空值是否允许由字段必填约束决定。
 * @returns 校验错误文字；合法时返回空字符串。
 */
export function fieldValidationError(field: DataField, value: unknown): string {
  if (value === undefined || value === null) {
    if (field.required) return `${field.label}：必填字段缺失`;
    return '';
  }
  let valid = false;
  if (field.type === 'string')
    valid = typeof value === 'string' && value.length <= 16_384;
  if (field.type === 'boolean') valid = typeof value === 'boolean';
  if (field.type === 'number')
    valid = typeof value === 'number' && Number.isFinite(value);
  if (field.type === 'integer')
    valid = typeof value === 'number' && Number.isSafeInteger(value);
  if (!valid) return `${field.label}：值类型不正确`;
  if (field.required && typeof value === 'string' && !value.trim())
    return `${field.label}：不能为空`;
  let measure: number | undefined;
  if (typeof value === 'string') measure = value.length;
  if (typeof value === 'number') measure = value;
  if (measure !== undefined && field.min !== undefined && measure < field.min)
    return `${field.label}：小于允许的最小值`;
  if (measure !== undefined && field.max !== undefined && measure > field.max)
    return `${field.label}：超过允许的最大值`;
  if (field.options && !field.options.some((option) => option.value === value))
    return `${field.label}：不属于允许的选项`;
  if (
    field.format === 'date' &&
    (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value)
  )
    return `${field.label}：日期不合法`;
  if (
    field.format === 'date-time' &&
    (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) ||
      !Number.isFinite(Date.parse(value)))
  )
    return `${field.label}：时间必须包含明确时区`;
  return '';
}

/**
 * 将持久表单定义转换为现有 Vben 控件与校验规则，不读取或执行保存的函数。
 * @param definition - 已通过服务端检查的表单版本。
 * @param writableFields - 消费方解析的可写字段，未授权控件统一禁用。
 * @returns Vben 表单使用的字段结构。
 * @throws 布局引用了不存在的数据字段时拒绝渲染。
 */
export function toVbenFormSchema(
  definition: FormDefinition,
  writableFields?: readonly string[],
): VbenFormSchema[] {
  const fields = new Map(
    definition.dataSchema.fields.map((field) => [field.key, field]),
  );
  let writable: Set<string> | undefined;
  if (writableFields) writable = new Set(writableFields);
  return definition.uiSchema.fields.map((layout) => {
    const field = fields.get(layout.key);
    if (!field) throw new Error(`表单布局缺少数据字段：${layout.key}`);
    const componentProps: Record<string, unknown> = {
      placeholder: layout.placeholder,
      disabled: Boolean(writable && !writable.has(field.key)),
    };
    if (field.options) componentProps.options = field.options;
    if (field.type === 'number' || field.type === 'integer') {
      componentProps.class = 'w-full';
      componentProps.min = field.min;
      componentProps.max = field.max;
      if (field.type === 'integer') componentProps.precision = 0;
    }
    if (field.format === 'date') componentProps.valueFormat = 'YYYY-MM-DD';
    if (field.format === 'date-time') {
      componentProps.valueFormat = 'YYYY-MM-DDTHH:mm:ssZ';
      componentProps.showTime = true;
    }
    const spans: Record<number, string> = {
      1: 'col-span-1',
      2: 'col-span-1 md:col-span-2',
      3: 'col-span-1 md:col-span-3',
    };
    const schema: VbenFormSchema = {
      fieldName: field.key,
      label: field.label,
      component: layout.component,
      componentProps,
      formItemClass: spans[layout.span],
      help: layout.help,
      rules: z.any().superRefine((value, context) => {
        const error = fieldValidationError(field, value);
        if (error) context.addIssue({ code: 'custom', message: error });
      }),
    };
    const condition = layout.requiredWhen;
    if (condition) {
      const required = (values: Record<string, unknown>) =>
        field.required || values[condition.field] === condition.equals;
      schema.dependencies = {
        triggerFields: [condition.field],
        required,
        rules: (values) =>
          z.any().superRefine((value, context) => {
            const error = fieldValidationError(
              { ...field, required: required(values) },
              value,
            );
            if (error) context.addIssue({ code: 'custom', message: error });
          }),
      };
    }
    return schema;
  });
}

/**
 * 从任务参数或规则事实契约派生填写表单，字段定义仍归对应业务模块所有。
 * @param schema - 已声明类型的参数或事实结构。
 * @returns 使用允许控件的只读结构适配结果。
 */
export function formFromDataSchema(schema: DataSchema): FormDefinition {
  return {
    schemaVersion: 1,
    dataSchema: schema,
    uiSchema: {
      columns: 2,
      fields: schema.fields.map((field) => {
        let component: FormDefinition['uiSchema']['fields'][number]['component'] =
          'Input';
        if (field.type === 'boolean') component = 'Switch';
        else if (field.options) component = 'Select';
        else if (field.format) component = 'DatePicker';
        else if (field.type === 'number' || field.type === 'integer')
          component = 'InputNumber';
        return {
          key: field.key,
          component,
          span: 1,
          placeholder: '',
          help: '',
        };
      }),
    },
  };
}
