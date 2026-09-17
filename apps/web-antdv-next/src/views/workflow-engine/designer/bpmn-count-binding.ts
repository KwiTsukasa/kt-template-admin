import type { ValueBinding, ValueReference } from '#/api/workflow-engine';

import { bpmnPath, readBpmnPath } from './bpmn-expression';

/**
 * 将数量表达式还原成公用字段映射，保留动态输入、节点结果与首个可用来源的顺序。
 * @param body - BPMN 多实例数量的固定数字或有限 JSON 表达式。
 * @returns 可由公用参数编辑器修改的数量映射；其他表达式保持未识别状态。
 */
export function readBpmnCountBinding(body: string): undefined | ValueBinding {
  const reference = (path: unknown): undefined | ValueReference => {
    if (typeof path !== 'string') return undefined;
    const parts = readBpmnPath(path, false);
    if (!parts) return undefined;
    if (parts[0] === 'input' && parts.length === 2)
      return { type: 'input', field: parts[1] ?? '' };
    if (parts[0] === 'outputs' && parts.length === 3)
      return { type: 'node', nodeId: parts[1] ?? '', field: parts[2] ?? '' };
    return undefined;
  };
  try {
    const expression = JSON.parse(body);
    if (Number.isSafeInteger(expression))
      return { type: 'literal', value: expression };
    if (!expression || typeof expression !== 'object') return undefined;
    if (Number.isSafeInteger(expression.value))
      return { type: 'literal', value: expression.value };
    if ('path' in expression) return reference(expression.path);
    if (expression.op === 'coalesce' && Array.isArray(expression.values)) {
      const sources: ValueReference[] = [];
      for (const value of expression.values) {
        const source = reference(value?.path);
        if (!source) return undefined;
        sources.push(source);
      }
      return { type: 'first', sources };
    }
  } catch {
    /* 不改写无法识别的已有标准表达式。 */
  }
  return undefined;
}

/**
 * 将数量字段映射写入标准 FormalExpression，编辑和运行仍使用 JSON 模型。
 * @param binding - 固定数量或从业务输入和已有活动结果选取的数量。
 * @returns 对应的有限表达式文本；未配置或当前循环序号不适用于实例数量。
 */
export function writeBpmnCountBinding(
  binding?: ValueBinding,
): string | undefined {
  if (!binding || binding.type === 'iteration') return undefined;
  const expression = (source: ValueReference) => {
    if (source.type === 'input')
      return { path: bpmnPath(['input', source.field]) };
    return { path: bpmnPath(['outputs', source.nodeId, source.field]) };
  };
  if (binding.type === 'literal')
    return JSON.stringify({ value: binding.value });
  if (binding.type === 'first')
    return JSON.stringify({
      op: 'coalesce',
      values: binding.sources.map((source) => expression(source)),
    });
  return JSON.stringify(expression(binding));
}
