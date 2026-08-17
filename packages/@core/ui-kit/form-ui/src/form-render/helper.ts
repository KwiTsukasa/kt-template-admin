import type {
  AnyZodObject,
  ZodDefault,
  ZodEffects,
  ZodNumber,
  ZodString,
  ZodTypeAny,
} from 'zod';

import { isObject, isString } from '@vben-core/shared/utils';

/**
 * 递归剥离 Zod 包装层并返回底层字段规则，字符串规则或空 Schema 返回 null。
 *
 * @param schema - 可能包裹在 effect 或 innerType 中的 Zod Schema；字符串和空值视为无规则。
 * @returns 剥离包装层后的 Zod 基础规则；输入为空或字符串规则时返回 null。
 */
export function getBaseRules<
  ChildType extends AnyZodObject | ZodTypeAny = ZodTypeAny,
>(schema: ChildType | ZodEffects<ChildType>): ChildType | null {
  if (!schema || isString(schema)) return null;
  if ('innerType' in schema._def)
    return getBaseRules(schema._def.innerType as ChildType);

  if ('schema' in schema._def)
    return getBaseRules(schema._def.schema as ChildType);

  return schema as ChildType;
}

/**
 * 从目标节点沿 Zod 包装类型向内查找默认值，遇到默认节点时执行其取值函数。
 *
 * @param schema - 可能嵌套包装器的 Zod Schema，用于向内查找首个默认值节点。
 * @returns 最内层 Zod 默认节点计算出的值；没有默认节点时返回 undefined。
 */
export function getDefaultValueInZodStack(schema: ZodTypeAny): any {
  if (!schema || isString(schema)) {
    return;
  }
  const typedSchema = schema as unknown as ZodDefault<ZodNumber | ZodString>;

  if (typedSchema._def.typeName === 'ZodDefault')
    return typedSchema._def.defaultValue();

  if ('innerType' in typedSchema._def) {
    return getDefaultValueInZodStack(
      typedSchema._def.innerType as unknown as ZodTypeAny,
    );
  }
  if ('schema' in typedSchema._def) {
    return getDefaultValueInZodStack(
      (typedSchema._def as any).schema as ZodTypeAny,
    );
  }

  return undefined;
}

/**
 * 通过检查输入是否包含事件对象必需的 target 或 currentTarget 结构。
 *
 * @param obj - 要检查 target 与 stopPropagation 事件成员的候选对象。
 * @returns 输入包含 target 或 currentTarget 事件字段时返回 true，否则返回 false。
 */
export function isEventObjectLike(obj: any) {
  if (!obj || !isObject(obj)) {
    return false;
  }
  return Reflect.has(obj, 'target') && Reflect.has(obj, 'stopPropagation');
}
