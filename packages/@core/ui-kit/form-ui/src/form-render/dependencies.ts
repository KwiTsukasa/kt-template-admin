import type {
  FormItemDependencies,
  FormSchemaRuleType,
  MaybeComponentProps,
} from '../types';

import { computed, ref, watch } from 'vue';

import { get, isBoolean, isFunction } from '@vben-core/shared/utils';

import { useFormValues } from 'vee-validate';

import { injectRenderFormProps } from './context';

/**
 * 根据 Vben 字段路径读取嵌套表单值，并兼容方括号包裹的原始键名。
 *
 * @param values - 包含目标字段的完整表单值。
 * @param fieldName - Vben 表单 Schema 中的字段路径。
 * @returns 字段路径对应的表单值；路径不存在时为 undefined。
 */
function resolveValueByFieldName(
  values: Record<string, any>,
  fieldName: string,
) {
  // vee-validate：[] 表示禁用嵌套
  if (fieldName.startsWith('[') && fieldName.endsWith(']')) {
    const rawKey = fieldName.slice(1, -1);
    return values[rawKey];
  }

  return get(values, fieldName);
}

/**
 * 监听表单依赖字段并按 `if`、`show`、`disabled`、`required`、动态属性和规则的优先级更新字段状态。
 *
 * @param getDependencies - 根据字段值返回动态属性、规则或显隐状态的依赖计算函数。
 * @returns 字段当前的渲染、显隐、禁用、必填、动态属性与动态规则状态。
 * @throws 函数未在 VbenForm 上下文中调用、无法取得表单值时抛出。
 */
export default function useDependencies(
  getDependencies: () => FormItemDependencies | undefined,
) {
  const values = useFormValues();

  const formRenderProps = injectRenderFormProps();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const formApi = formRenderProps.form!;

  if (!values) {
    throw new Error('useDependencies should be used within <VbenForm>');
  }

  const isIf = ref(true);
  const isDisabled = ref(false);
  const isShow = ref(true);
  const isRequired = ref(false);
  const dynamicComponentProps = ref<MaybeComponentProps>({});
  const dynamicRules = ref<FormSchemaRuleType>();

  const triggerFieldValues = computed(() => {
    // 该字段可能会被多个字段触发
    const triggerFields = getDependencies()?.triggerFields ?? [];
    return triggerFields.map((dep) => {
      return resolveValueByFieldName(values.value, dep);
    });
  });

  const resetConditionState = () => {
    isDisabled.value = false;
    isIf.value = true;
    isShow.value = true;
    isRequired.value = false;
    dynamicRules.value = undefined;
    dynamicComponentProps.value = {};
  };

  watch(
    [triggerFieldValues, getDependencies],
    async ([_values, dependencies]) => {
      if (!dependencies || !dependencies?.triggerFields?.length) {
        return;
      }
      resetConditionState();
      const {
        componentProps,
        disabled,
        if: whenIf,
        required,
        rules,
        show,
        trigger,
      } = dependencies;

      // 1. 优先判断if，如果if为false，则不渲染dom，后续判断也不再执行
      const formValues = values.value;

      if (isFunction(whenIf)) {
        isIf.value = !!(await whenIf(formValues, formApi));
        // 不渲染
        if (!isIf.value) return;
      } else if (isBoolean(whenIf)) {
        isIf.value = whenIf;
        if (!isIf.value) return;
      }

      // 2. 判断show，如果show为false，则隐藏
      if (isFunction(show)) {
        isShow.value = !!(await show(formValues, formApi));
      } else if (isBoolean(show)) {
        isShow.value = show;
      }

      if (isFunction(componentProps)) {
        dynamicComponentProps.value = await componentProps(formValues, formApi);
      }

      if (isFunction(rules)) {
        dynamicRules.value = await rules(formValues, formApi);
      }

      if (isFunction(disabled)) {
        isDisabled.value = !!(await disabled(formValues, formApi));
      } else if (isBoolean(disabled)) {
        isDisabled.value = disabled;
      }

      if (isFunction(required)) {
        isRequired.value = !!(await required(formValues, formApi));
      }

      if (isFunction(trigger)) {
        await trigger(formValues, formApi);
      }
    },
    { deep: true, immediate: true },
  );

  return {
    dynamicComponentProps,
    dynamicRules,
    isDisabled,
    isIf,
    isRequired,
    isShow,
  };
}
