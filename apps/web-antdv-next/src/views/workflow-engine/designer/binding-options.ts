import type { DataField, DataSchema } from '#/api/automation/definition';
import type { ValueReference } from '#/api/workflow-engine';

type BindingOption = { label: string; value: string };
export type BindingOptions = {
  first: BindingOption[];
  input: BindingOption[];
  node: BindingOption[];
};

/**
 * 为字段引用生成与对象键顺序无关的选项身份，节点名包含点号时仍能完整还原。
 * @param reference - 流程输入或节点结果引用。
 * @returns 具有固定字段顺序的引用 JSON。
 */
export function bindingReferenceKey(reference: ValueReference): string {
  if (reference.type === 'input')
    return JSON.stringify({ type: 'input', field: reference.field });
  return JSON.stringify({
    type: 'node',
    nodeId: reference.nodeId,
    field: reference.field,
  });
}

/**
 * 按目标标量类型和日期格式分组，保持前后端字段兼容规则一致。
 * @param field - 目标字段或来源字段的类型与格式。
 * @returns 对应可复用选项组的身份。
 */
export function bindingFieldType(
  field: Pick<DataField, 'format' | 'type'>,
): string {
  return `${field.type}:${field.format ?? ''}`;
}

/**
 * 一次索引流程输入和全部节点字段，整数额外进入数值组，目标字段渲染时不再重扫来源。
 * @param input - 流程输入契约。
 * @param outputs - 当前可引用节点及其输出契约。
 * @returns 按类型与格式分组的输入、节点和优先来源选项。
 */
export function indexBindingOptions(
  input: DataSchema,
  outputs: readonly { name: string; nodeId: string; schema: DataSchema }[],
): Map<string, BindingOptions> {
  const groups = new Map<string, BindingOptions>();
  const append = (
    field: DataField,
    reference: ValueReference,
    label: string,
  ) => {
    const types = [field.type];
    if (field.type === 'integer') types.push('number');
    const value = bindingReferenceKey(reference);
    for (const type of types) {
      const key = bindingFieldType({ type, format: field.format });
      const options = groups.get(key) ?? { input: [], node: [], first: [] };
      groups.set(key, options);
      let firstLabel = label;
      if (reference.type === 'input') {
        options.input.push({ label, value: field.key });
        firstLabel = `流程输入 · ${label}`;
      } else options.node.push({ label, value });
      options.first.push({ label: firstLabel, value });
    }
  };
  for (const field of input.fields)
    append(field, { type: 'input', field: field.key }, field.label);
  for (const source of outputs) {
    for (const field of source.schema.fields)
      append(
        field,
        { type: 'node', nodeId: source.nodeId, field: field.key },
        `${source.name} · ${field.label}`,
      );
  }
  return groups;
}
