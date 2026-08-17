import type { ZodRawShape } from 'zod';

import type { ComputedRef } from 'vue';

import type { ExtendedFormApi, FormActions, VbenFormProps } from './types';

import { computed, unref, useSlots } from 'vue';

import { createContext } from '@vben-core/shadcn-ui';
import { isString, mergeWithArrayOverride, set } from '@vben-core/shared/utils';

import { useForm } from 'vee-validate';
import { object, ZodIntersection, ZodNumber, ZodObject, ZodString } from 'zod';
import { getDefaultsForSchema } from 'zod-defaults';

type ExtendFormProps = VbenFormProps & { formApi?: ExtendedFormApi };

export const [injectFormProps, provideFormProps] =
  createContext<[ComputedRef<ExtendFormProps> | ExtendFormProps, FormActions]>(
    'VbenFormProps',
  );

export const [injectComponentRefMap, provideComponentRefMap] =
  createContext<Map<string, unknown>>('ComponentRefMap');

/**
 * 从字段 Schema 推导初值，创建表单实例，并收集非默认插槽供表单渲染。
 *
 * @param props - 包含字段 Schema 和显式默认值的表单配置或其响应式引用。
 * @returns 表单实例、推导初值及非默认插槽等表单初始化上下文。
 */
export function useFormInitial(
  props: ComputedRef<VbenFormProps> | VbenFormProps,
) {
  const slots = useSlots();
  const initialValues = generateInitialValues();

  const form = useForm({
    ...(() => {
      if (Object.keys(initialValues)?.length) {
        return { initialValues };
      }
      return {};
    })(),
  });

  const delegatedSlots = computed(() => {
    const resultSlots: string[] = [];

    for (const key of Object.keys(slots)) {
      if (key !== 'default') {
        resultSlots.push(key);
      }
    }
    return resultSlots;
  });

  /**
   * 合并字段显式默认值、Zod 自定义默认值与 Schema 默认值，数组以新值整体覆盖。
   *
   * @returns 合并显式、Zod 自定义及 Schema 默认值后的表单初始值对象。
   */
  function generateInitialValues() {
    const initialValues: Record<string, any> = {};

    const zodObject: ZodRawShape = {};
    (unref(props).schema || []).forEach((item) => {
      if (Reflect.has(item, 'defaultValue')) {
        set(initialValues, item.fieldName, item.defaultValue);
      } else if (item.rules && !isString(item.rules)) {
        // 检查规则是否适合提取默认值
        const customDefaultValue = getCustomDefaultValue(item.rules);
        zodObject[item.fieldName] = item.rules;
        if (customDefaultValue !== undefined) {
          initialValues[item.fieldName] = customDefaultValue;
        }
      }
    });

    const schemaInitialValues = getDefaultsForSchema(object(zodObject));

    const zodDefaults: Record<string, any> = {};
    for (const key in schemaInitialValues) {
      set(zodDefaults, key, schemaInitialValues[key]);
    }
    return mergeWithArrayOverride(initialValues, zodDefaults);
  }
  // 自定义默认值提取逻辑
  /**
   * 通过递归展开 Zod 字符串、数字、对象与交集推导表单默认值，不支持的规则返回 undefined。
   *
   * @param rule - 需要派生初值的 Zod 规则；字符串、数字、对象和交集采用不同回退。
   * @returns 规则可推导的默认值；不支持的规则返回 undefined。
   */
  function getCustomDefaultValue(rule: any): any {
    if (rule instanceof ZodString) {
      return ''; // 默认为空字符串
    } else if (rule instanceof ZodNumber) {
      return null; // 默认为 null（避免显示 0）
    } else if (rule instanceof ZodObject) {
      // 递归提取嵌套对象的默认值
      const defaultValues: Record<string, any> = {};
      for (const [key, valueSchema] of Object.entries(rule.shape)) {
        defaultValues[key] = getCustomDefaultValue(valueSchema);
      }
      return defaultValues;
    } else if (rule instanceof ZodIntersection) {
      // 对于交集类型，从schema 提取默认值
      const leftDefaultValue = getCustomDefaultValue(rule._def.left);
      const rightDefaultValue = getCustomDefaultValue(rule._def.right);

      // 如果左右两边都能提取默认值，合并它们
      if (
        typeof leftDefaultValue === 'object' &&
        typeof rightDefaultValue === 'object'
      ) {
        return { ...leftDefaultValue, ...rightDefaultValue };
      }

      // 否则优先使用左边的默认值
      return leftDefaultValue ?? rightDefaultValue;
    } else {
      return undefined; // 其他类型不提供默认值
    }
  }

  return {
    delegatedSlots,
    form,
  };
}
