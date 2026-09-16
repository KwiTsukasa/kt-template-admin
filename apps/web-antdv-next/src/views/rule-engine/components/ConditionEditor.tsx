import type { PropType, VNode } from 'vue';

import type { DataField } from '#/api/automation/definition';
import type { RuleCondition, RuleScalar } from '#/api/rule-engine';

import { defineComponent } from 'vue';

import { Button, Input, InputNumber, Select, Space, Switch } from 'antdv-next';

/**
 * 按事实字段类型创建可编辑的比较节点，避免数字字段初始得到文本值。
 * @param fields - 当前规则声明的事实目录。
 * @returns 引用首个事实的默认比较条件。
 */
export function newCondition(fields: DataField[]): RuleCondition {
  const field = fields[0];
  let value: RuleScalar = '';
  if (field?.type === 'boolean') value = false;
  if (field?.type === 'number' || field?.type === 'integer') value = 0;
  return { type: 'compare', path: field?.key || '', operator: 'eq', value };
}

export default defineComponent({
  name: 'AutomationConditionEditor',
  props: {
    value: { type: Object as PropType<RuleCondition>, required: true },
    fields: { type: Array as PropType<DataField[]>, required: true },
  },
  emits: { change: (_value: RuleCondition) => true },
  setup(props, { emit }) {
    /**
     * 递归显示条件组合和类型化比较控件，每次修改只替换当前子树。
     * @param rule - 当前层的条件树。
     * @param change - 将当前子树交还父节点的回调。
     * @param depth - 限制交互新增层级的当前深度。
     * @returns 当前条件及子条件的可视化编辑区域。
     */
    function renderRule(
      rule: RuleCondition,
      change: (next: RuleCondition) => void,
      depth: number,
    ): VNode {
      const switchType = (type: unknown) => {
        if (type === 'all' || type === 'any') change({ type, rules: [rule] });
        else if (type === 'not') change({ type: 'not', rule });
        else change(newCondition(props.fields));
      };
      const header = (
        <Select
          onChange={switchType}
          options={[
            { label: '全部满足 AND', value: 'all' },
            { label: '任一满足 OR', value: 'any' },
            { label: '取反 NOT', value: 'not' },
            { label: '字段比较', value: 'compare' },
          ]}
          style={{ width: '145px' }}
          value={rule.type}
        />
      );
      if (rule.type === 'all' || rule.type === 'any') {
        return (
          <div class="automation-condition-group space-y-3">
            <Space>
              {header}
              <Button
                disabled={depth >= 7 || rule.rules.length >= 32}
                onClick={() =>
                  change({
                    ...rule,
                    rules: [...rule.rules, newCondition(props.fields)],
                  })
                }
              >
                添加条件
              </Button>
            </Space>
            <div class="automation-condition-branches space-y-3">
              {rule.rules.map((child, index) => (
                <div class="flex items-start gap-2" key={index}>
                  <div class="min-w-0 flex-1">
                    {renderRule(
                      child,
                      (value) =>
                        change({
                          ...rule,
                          rules: rule.rules.map((item, key) => {
                            if (key === index) return value;
                            return item;
                          }),
                        }),
                      depth + 1,
                    )}
                  </div>
                  <Button
                    danger
                    disabled={rule.rules.length <= 1}
                    onClick={() =>
                      change({
                        ...rule,
                        rules: rule.rules.filter((_, key) => key !== index),
                      })
                    }
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      }
      if (rule.type === 'not')
        return (
          <div class="automation-condition-group space-y-3">
            {header}
            {renderRule(
              rule.rule,
              (value) => change({ type: 'not', rule: value }),
              depth + 1,
            )}
          </div>
        );
      if (rule.type !== 'compare') return <div />;
      const field = props.fields.find((item) => item.key === rule.path);
      const operators = [
        { label: '等于', value: 'eq' },
        { label: '不等于', value: 'ne' },
        { label: '存在', value: 'exists' },
        { label: '属于集合', value: 'in' },
      ];
      if (field?.type === 'number' || field?.type === 'integer')
        operators.push(
          { label: '大于', value: 'gt' },
          { label: '大于等于', value: 'gte' },
          { label: '小于', value: 'lt' },
          { label: '小于等于', value: 'lte' },
        );
      if (field?.type === 'string')
        operators.push({ label: '包含', value: 'contains' });
      let valueEditor: VNode;
      if (rule.operator === 'exists')
        valueEditor = (
          <Switch
            checked={rule.value === true}
            onChange={(value) => change({ ...rule, value: Boolean(value) })}
          />
        );
      else if (rule.operator === 'in')
        valueEditor = (
          <Select
            mode="tags"
            onChange={(values) =>
              change({
                ...rule,
                value: (values as string[]).map((value) => {
                  if (field?.type === 'number' || field?.type === 'integer')
                    return Number(value);
                  if (field?.type === 'boolean') return value === 'true';
                  return value;
                }),
              })
            }
            style={{ minWidth: '180px' }}
            value={(rule.value as RuleScalar[]).map(String)}
          />
        );
      else if (field?.type === 'boolean')
        valueEditor = (
          <Switch
            checked={rule.value === true}
            onChange={(value) => change({ ...rule, value: Boolean(value) })}
          />
        );
      else if (field?.options)
        valueEditor = (
          <Select
            onChange={(value) =>
              change({ ...rule, value: value as RuleScalar })
            }
            options={field.options.map((option) => {
              if (typeof option.value === 'number')
                return { label: option.label, value: option.value };
              return { label: option.label, value: String(option.value) };
            })}
            style={{ minWidth: '160px' }}
            value={rule.value as number | string}
          />
        );
      else if (field?.type === 'number' || field?.type === 'integer')
        valueEditor = (
          <InputNumber
            onChange={(value) => change({ ...rule, value: value as number })}
            value={rule.value as number}
          />
        );
      else
        valueEditor = (
          <Input
            onChange={(event) =>
              change({ ...rule, value: event.target.value || '' })
            }
            value={String(rule.value ?? '')}
          />
        );
      return (
        <div class="automation-condition-row">
          {header}
          <Select
            onChange={(key) => {
              change(
                newCondition(props.fields.filter((item) => item.key === key)),
              );
            }}
            options={props.fields.map((item) => ({
              label: item.label,
              value: item.key,
            }))}
            placeholder="选择事实字段"
            style={{ minWidth: '160px' }}
            value={rule.path}
          />
          <Select
            onChange={(value) => {
              let next: RuleScalar | RuleScalar[] = rule.value;
              if (value === 'exists') next = true;
              else if (value === 'in') next = [];
              else {
                const initial = newCondition(
                  props.fields.filter((item) => item.key === rule.path),
                );
                if (initial.type === 'compare') next = initial.value;
              }
              change({
                ...rule,
                operator: value as typeof rule.operator,
                value: next,
              });
            }}
            options={operators}
            style={{ width: '135px' }}
            value={rule.operator}
          />
          {valueEditor}
        </div>
      );
    }
    return () => (
      <div class="automation-condition-editor">
        {renderRule(props.value, (value) => emit('change', value), 0)}
      </div>
    );
  },
});
