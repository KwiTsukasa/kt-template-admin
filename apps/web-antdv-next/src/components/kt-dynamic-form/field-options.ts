import type { DataField } from '#/api/automation/definition';

/**
 * 一次收集已用字段名，再寻找可用序号，删除或更名后仍不会生成重复标识。
 * @param fields - 当前字段列表。
 * @param prefix - 编辑器的字段名前缀。
 * @returns 不与当前字段冲突的新标识。
 */
export function nextFieldKey(
  fields: readonly DataField[],
  prefix: string,
): string {
  const keys = new Set(fields.map((field) => field.key));
  let number = fields.length + 1;
  while (keys.has(`${prefix}_${number}`)) number++;
  return `${prefix}_${number}`;
}

/**
 * 将目标类型、日期格式及来源必填要求编码为兼容选项组，不包含字段名称。
 * @param field - 消费方目标字段。
 * @param requireSource - 是否要求必填目标只能引用必填来源。
 * @returns 可直接查询共享选项数组的键。
 */
export function fieldOptionsKey(
  field: Pick<DataField, 'format' | 'required' | 'type'>,
  requireSource = false,
): string {
  let required = false;
  if (requireSource) required = field.required;
  return `${field.type}:${field.format ?? ''}:${required}`;
}

/**
 * 一次建立类型、日期及必填兼容索引，整数也能供应数值目标，未限制日期的目标可取全部同类型来源。
 * @param fields - 已发布的来源字段。
 * @param exactFormat - 是否要求来源和目标日期格式完全相同，流程映射使用严格模式。
 * @returns 保持来源顺序、供多行选择框共享的选项索引。
 */
export function indexFieldOptions(
  fields: readonly DataField[],
  exactFormat = false,
): Map<string, { label: string; value: string }[]> {
  const groups = new Map<string, { label: string; value: string }[]>();
  for (const field of fields) {
    const types = [field.type];
    if (field.type === 'integer') types.push('number');
    const formats: DataField['format'][] = [field.format];
    if (!exactFormat && field.format) formats.push(undefined);
    const requirements = [false];
    if (field.required) requirements.push(true);
    const option = { label: field.label, value: field.key };
    for (const type of types) {
      for (const format of formats) {
        for (const required of requirements) {
          const key = fieldOptionsKey({ type, format, required }, true);
          const options = groups.get(key) ?? [];
          options.push(option);
          groups.set(key, options);
        }
      }
    }
  }
  return groups;
}
