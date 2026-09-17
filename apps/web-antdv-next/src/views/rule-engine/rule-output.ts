import type { DataSchema } from '#/api/automation/definition';
import type { RuleDefinition } from '#/api/rule-engine';

/**
 * 从固定规则的统一分支类型派生可绑定结果，空值决策不伪装成布尔字段。
 * @param definition - 已发布且分支类型一致的规则。
 * @returns 与服务端消费契约一致的结果字段。
 */
export function ruleOutputSchema(definition: RuleDefinition): DataSchema {
  let type = 'boolean';
  if (definition.mode === 'decision-table')
    type = typeof definition.defaultResult;
  if (type !== 'boolean' && type !== 'number' && type !== 'string')
    return { fields: [] };
  return {
    fields: [{ key: 'result', label: '规则结果', type, required: true }],
  };
}
