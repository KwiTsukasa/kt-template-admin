import type { PropType, VNode } from 'vue';

import type { BpmnExpression } from './bpmn-expression';

import type { DataField } from '#/api/automation/definition';

import { defineComponent } from 'vue';

import { Alert, Button, Input, InputNumber, Select, Switch } from 'antdv-next';

import { isBpmnExpression } from './bpmn-expression';

export type { BpmnExpression } from './bpmn-expression';

/**
 * 依据字段类型创建比较条件，使布尔和数值判断保持原始类型。
 * @param field - 当前可读取的流程输入或步骤结果。
 * @returns 默认等值条件。
 */
export function bpmnComparison(field?: DataField): BpmnExpression {
  let value: boolean | number | string = '';
  if (field?.type === 'boolean') value = true;
  if (field?.type === 'number' || field?.type === 'integer') value = 0;
  return { op: 'eq', left: { path: field?.key ?? '' }, right: { value } };
}

export default defineComponent({
  name: 'BpmnExpressionEditor',
  props: {
    value: { type: Object as PropType<BpmnExpression>, default: undefined },
    fields: { type: Array as PropType<DataField[]>, required: true },
  },
  emits: { change: (_value: BpmnExpression) => true },
  setup(props, { emit }) {
    const renderExpression = (
      expression: BpmnExpression,
      change: (value: BpmnExpression) => void,
      depth: number,
    ): VNode => {
      let mode = 'literal';
      if ('op' in expression) mode = expression.op;
      if ('left' in expression || 'path' in expression) mode = 'compare';
      if (
        'left' in expression &&
        'op' in expression.left &&
        expression.left.op === 'sum'
      )
        mode = 'sum-compare';
      const numericFields = props.fields.filter((field) =>
        ['integer', 'number'].includes(field.type),
      );
      const selector = (
        <Select
          class="w-full"
          onChange={(value) => {
            switch (value) {
              case 'compare': {
                change(bpmnComparison(props.fields[0]));
                break;
              }
              case 'literal': {
                change({ value: true });
                break;
              }
              case 'not': {
                change({ op: 'not', value: expression });
                break;
              }
              case 'sum-compare': {
                const values: BpmnExpression[] = [];
                if (numericFields[0])
                  values.push({ path: numericFields[0].key });
                change({
                  op: 'gte',
                  left: { op: 'sum', values },
                  right: { value: 1 },
                });
                break;
              }
              default: {
                if (depth < 8)
                  change({ op: value as 'and' | 'or', values: [expression] });
              }
            }
          }}
          options={[
            { label: '固定判断', value: 'literal' },
            { label: '字段比较', value: 'compare' },
            {
              label: '字段求和比较',
              value: 'sum-compare',
              disabled: numericFields.length === 0,
            },
            { label: '全部满足', value: 'and' },
            { label: '任一满足', value: 'or' },
            { label: '取反', value: 'not' },
          ]}
          value={mode}
        />
      );
      if (
        'op' in expression &&
        (expression.op === 'and' || expression.op === 'or')
      )
        return (
          <div class="space-y-3 rounded border p-3">
            {selector}
            {expression.values.map((value, index) => (
              <div class="space-y-2" key={index}>
                {renderExpression(
                  value,
                  (next) =>
                    change({
                      ...expression,
                      values: expression.values.map((item, offset) => {
                        if (offset === index) return next;
                        return item;
                      }),
                    }),
                  depth + 1,
                )}
                <Button
                  danger
                  disabled={expression.values.length <= 1}
                  onClick={() =>
                    change({
                      ...expression,
                      values: expression.values.filter(
                        (_, offset) => offset !== index,
                      ),
                    })
                  }
                >
                  删除条件
                </Button>
              </div>
            ))}
            <Button
              disabled={depth >= 8 || expression.values.length >= 32}
              onClick={() =>
                change({
                  ...expression,
                  values: [
                    ...expression.values,
                    bpmnComparison(props.fields[0]),
                  ],
                })
              }
            >
              添加条件
            </Button>
          </div>
        );
      if ('op' in expression && expression.op === 'not')
        return (
          <div class="space-y-3 rounded border p-3">
            {selector}
            {renderExpression(
              expression.value,
              (value) => change({ op: 'not', value }),
              depth + 1,
            )}
          </div>
        );
      if ('value' in expression && !('op' in expression))
        return (
          <div class="flex items-center gap-3">
            {selector}
            <Switch
              checked={expression.value === true}
              onChange={(value) => change({ value: Boolean(value) })}
            />
          </div>
        );
      let path = '';
      if ('path' in expression) path = expression.path;
      if ('left' in expression && 'path' in expression.left)
        path = expression.left.path;
      const field = props.fields.find((item) => item.key === path);
      const numeric =
        mode === 'sum-compare' ||
        field?.type === 'number' ||
        field?.type === 'integer';
      let left: BpmnExpression = { path };
      if ('left' in expression) left = expression.left;
      let sumPaths: string[] = [];
      if ('op' in left && left.op === 'sum')
        sumPaths = left.values.flatMap((item) => {
          if ('path' in item) return [item.path];
          return [];
        });
      let operator = 'eq';
      let value: unknown = true;
      if ('left' in expression) {
        operator = expression.op;
        if ('value' in expression.right && !('op' in expression.right))
          value = expression.right.value;
      }
      const update = (next: boolean | null | number | string) =>
        change({
          op: operator as 'eq',
          left,
          right: { value: next },
        });
      const operators = [
        { label: '等于', value: 'eq' },
        { label: '不等于', value: 'ne' },
      ];
      if (numeric)
        operators.push(
          { label: '大于', value: 'gt' },
          { label: '大于等于', value: 'gte' },
          { label: '小于', value: 'lt' },
          { label: '小于等于', value: 'lte' },
        );
      let control = (
        <Input
          onChange={(event) => update(event.target.value ?? '')}
          value={String(value ?? '')}
        />
      );
      if (field?.type === 'boolean')
        control = (
          <Switch
            checked={value === true}
            onChange={(next) => update(Boolean(next))}
          />
        );
      if (numeric)
        control = (
          <InputNumber
            class="w-full"
            onChange={(next) => update(Number(next))}
            value={Number(value)}
          />
        );
      return (
        <div class="space-y-3">
          {selector}
          {mode === 'sum-compare' && (
            <Select
              aria-label="求和字段"
              class="w-full"
              maxCount={32}
              mode="multiple"
              onChange={(keys) => {
                left = {
                  op: 'sum',
                  values: (keys as string[]).map((key) => ({ path: key })),
                };
                update(value as number);
              }}
              options={numericFields.map((item) => ({
                value: item.key,
                label: item.label,
              }))}
              value={sumPaths}
            />
          )}
          {mode !== 'sum-compare' && (
            <Select
              class="w-full"
              onChange={(key) =>
                change(
                  bpmnComparison(props.fields.find((item) => item.key === key)),
                )
              }
              options={props.fields.map((item) => ({
                value: item.key,
                label: item.label,
              }))}
              placeholder="选择字段"
              value={path || undefined}
            />
          )}
          <Select
            class="w-full"
            onChange={(next) => {
              operator = String(next);
              update(value as boolean | null | number | string);
            }}
            options={operators}
            value={operator}
          />
          {control}
        </div>
      );
    };
    return () => {
      if (!isBpmnExpression(props.value))
        return (
          <Alert message="条件无法识别，请检查导入的表达式" type="error" />
        );
      return renderExpression(props.value, (value) => emit('change', value), 0);
    };
  },
});
