export type BpmnExpression =
  | {
      left: BpmnExpression;
      op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ne';
      right: BpmnExpression;
    }
  | { op: 'and' | 'or' | 'sum'; values: BpmnExpression[] }
  | { op: 'not'; value: BpmnExpression }
  | { path: string }
  | { value: boolean | null | number | string };

/**
 * 校验条件树是否可由当前可视化编辑器展示，拒绝深度超限和缺少操作数的导入表达式。
 * @param value - 从流程定义读取的待检查条件。
 * @param depth - 当前嵌套层级，与服务端条件树的深度限制一致。
 * @returns 是否为当前编辑器支持的完整条件树，不修改原始值。
 */
export function isBpmnExpression(
  value: unknown,
  depth = 0,
): value is BpmnExpression {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 32)
    return false;
  const expression = value as Record<string, unknown>;
  if ('op' in expression) {
    if (typeof expression.op !== 'string') return false;
    if (expression.op === 'not')
      return isBpmnExpression(expression.value, depth + 1);
    if (['and', 'or', 'sum'].includes(expression.op)) {
      return (
        Array.isArray(expression.values) &&
        expression.values.length > 0 &&
        expression.values.length <= 32 &&
        expression.values.every((child) => isBpmnExpression(child, depth + 1))
      );
    }
    if (['eq', 'gt', 'gte', 'lt', 'lte', 'ne'].includes(expression.op)) {
      return (
        isBpmnExpression(expression.left, depth + 1) &&
        isBpmnExpression(expression.right, depth + 1)
      );
    }
    return false;
  }
  if ('path' in expression) return typeof expression.path === 'string';
  const literal = expression.value;
  if (typeof literal === 'number') return Number.isFinite(literal);
  return (
    literal === null ||
    typeof literal === 'boolean' ||
    typeof literal === 'string'
  );
}

/**
 * 安全读取草稿条件，未知语言或损坏的条件保持未识别状态，避免渲染时抛出异常。
 * @param body - 标准 FormalExpression 内的条件文本。
 * @returns 当前可编辑的条件树；不可识别时为空，由调用界面提示原数据问题。
 */
export function readBpmnExpression(body: string): BpmnExpression | undefined {
  try {
    const value: unknown = JSON.parse(body);
    if (isBpmnExpression(value)) return value;
  } catch {
    /* 原文由模型保存，不自动改写用户输入。 */
  }
  return undefined;
}
