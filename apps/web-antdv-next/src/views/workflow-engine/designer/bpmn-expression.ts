import {
  WORKFLOW_EXPRESSION_CONTEXTS,
  WORKFLOW_EXPRESSION_LIMITS,
  WORKFLOW_EXPRESSION_RESERVED_KEYS,
  WORKFLOW_EXPRESSION_SEGMENT,
} from '#/constants/automation/workflow';

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
 * @param complete - 是否要求引用路径已填写完整，编辑中的空路径仍可被编辑器保留。
 * @returns 是否为当前编辑器支持的完整条件树，不修改原始值。
 */
export function isBpmnExpression(
  value: unknown,
  depth = 0,
  complete = false,
): value is BpmnExpression {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    depth > WORKFLOW_EXPRESSION_LIMITS.depth
  )
    return false;
  const expression = value as Record<string, unknown>;
  if ('op' in expression) {
    if (typeof expression.op !== 'string') return false;
    if (expression.op === 'not')
      return isBpmnExpression(expression.value, depth + 1, complete);
    if (['and', 'or', 'sum'].includes(expression.op)) {
      return (
        Array.isArray(expression.values) &&
        expression.values.length > 0 &&
        expression.values.length <= WORKFLOW_EXPRESSION_LIMITS.operands &&
        expression.values.every((child) =>
          isBpmnExpression(child, depth + 1, complete),
        )
      );
    }
    if (['eq', 'gt', 'gte', 'lt', 'lte', 'ne'].includes(expression.op)) {
      return (
        isBpmnExpression(expression.left, depth + 1, complete) &&
        isBpmnExpression(expression.right, depth + 1, complete)
      );
    }
    return false;
  }
  if ('path' in expression) {
    if (typeof expression.path !== 'string') return false;
    if (!complete) return true;
    return Boolean(readBpmnPath(expression.path));
  }
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
 * @param complete - 是否仅接受已经完整填写的字段路径。
 * @returns 当前可编辑的条件树；不可识别时为空，由调用界面提示原数据问题。
 */
export function readBpmnExpression(
  body: string,
  complete = false,
): BpmnExpression | undefined {
  try {
    const value: unknown = JSON.parse(body);
    if (isBpmnExpression(value, 0, complete)) return value;
  } catch {
    /* 原文由模型保存，不自动改写用户输入。 */
  }
  return undefined;
}

/**
 * 普通字段保持原有点分路径，含点号或 Unicode 的节点用 JSON Pointer 编码，避免选择后引用其他节点。
 * @param parts - 已分开的上下文、节点和字段身份。
 * @returns 可无损写入表达式的路径。
 */
export function bpmnPath(parts: readonly string[]): string {
  if (parts.every((part) => WORKFLOW_EXPRESSION_SEGMENT.test(part)))
    return parts.join('.');
  return `/${parts
    .map((part) => part.replaceAll('~', '~0').replaceAll('/', '~1'))
    .join('/')}`;
}

/**
 * 还原两种路径编码并拒绝原型引用，数量编辑时可以保留尚未选定的空字段。
 * @param path - 表达式中的原始路径。
 * @param complete - 是否要求每段都已填写完整。
 * @returns 安全路径片段；损坏或超出上下文时为空。
 */
export function readBpmnPath(
  path: string,
  complete = true,
): string[] | undefined {
  let parts = path.split('.');
  if (path.startsWith('/')) {
    if (/~(?![01])/.test(path)) return undefined;
    parts = path
      .slice(1)
      .split('/')
      .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
  } else if (
    parts.some((part) => part && !WORKFLOW_EXPRESSION_SEGMENT.test(part))
  )
    return undefined;
  if (
    !WORKFLOW_EXPRESSION_CONTEXTS.has(parts[0] ?? '') ||
    (complete && parts.some((part) => !part)) ||
    parts.some((part) => WORKFLOW_EXPRESSION_RESERVED_KEYS.has(part))
  )
    return undefined;
  return parts;
}
