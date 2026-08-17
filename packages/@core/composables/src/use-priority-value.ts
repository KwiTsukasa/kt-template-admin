import type { ComputedRef, Ref } from 'vue';

import { computed, getCurrentInstance, unref, useAttrs, useSlots } from 'vue';

import {
  getFirstNonNullOrUndefined,
  kebabToCamelCase,
} from '@vben-core/shared/utils';

/**
 * 按插槽、attrs、调用方显式 props 和外部 state 的顺序，为指定字段建立响应式优先级取值。
 *
 * @param key - 依次从插槽、attrs、props 和 state 读取的字段名。
 * @param props - 组件声明的属性值；只有调用方显式传入的字段才参与优先级选择。
 * @param state - 优先级取值链中的外部响应式状态；缺失时继续读取低优先级来源。
 * @returns 按 slots、attrs、props、state 优先级解析的 computed 引用。
 */
export function usePriorityValue<
  T extends Record<string, any>,
  S extends Record<string, any>,
  K extends keyof T = keyof T,
>(key: K, props: T, state: Readonly<Ref<NoInfer<S>>> | undefined) {
  const instance = getCurrentInstance();
  const slots = useSlots();
  const attrs = useAttrs() as T;

  const value = computed((): T[K] => {
    // props不管有没有传，都会有默认值，会影响这里的顺序，
    // 通过判断原始props是否有值来判断是否传入
    const rawProps = (instance?.vnode?.props || {}) as T;

    const standardRawProps = {} as T;

    for (const [key, value] of Object.entries(rawProps)) {
      standardRawProps[kebabToCamelCase(key) as K] = value;
    }
    const propsKey = (() => {
      if (standardRawProps?.[key] === undefined) {
        return undefined;
      }
      return props[key];
    })();

    // slot可以关闭
    return getFirstNonNullOrUndefined(
      slots[key as string],
      attrs[key],
      propsKey,
      state?.value?.[key as keyof S],
    ) as T[K];
  });

  return value;
}

/**
 * 按字段批量建立从 slots、attrs、props 到 state 的优先级响应式值。
 *
 * @param props - 要逐字段建立优先级值的组件属性对象。
 * @param state - 优先级取值链中的外部响应式状态；缺失时继续读取低优先级来源。
 * @returns 每个字段分别对应优先级 computed 引用的对象。
 */
export function usePriorityValues<
  T extends Record<string, any>,
  S extends Ref<Record<string, any>> = Readonly<Ref<NoInfer<T>, NoInfer<T>>>,
>(props: T, state: S | undefined) {
  const result: { [K in keyof T]: ComputedRef<T[K]> } = {} as never;

  (Object.keys(props) as (keyof T)[]).forEach((key) => {
    result[key] = usePriorityValue(key as keyof typeof props, props, state);
  });

  return result;
}

/**
 * 将每个字段的优先级响应式值集中解包到单个 computed，供组件整体透传。
 *
 * @param props - 要逐字段解析并集中解包的组件属性对象。
 * @param state - 优先级取值链中的外部响应式状态；缺失时继续读取低优先级来源。
 * @returns 包含全部字段最终优先值的单个 computed 引用。
 */
export function useForwardPriorityValues<
  T extends Record<string, any>,
  S extends Ref<Record<string, any>> = Readonly<Ref<NoInfer<T>, NoInfer<T>>>,
>(props: T, state: S | undefined) {
  const computedResult: { [K in keyof T]: ComputedRef<T[K]> } = {} as never;

  (Object.keys(props) as (keyof T)[]).forEach((key) => {
    computedResult[key] = usePriorityValue(
      key as keyof typeof props,
      props,
      state,
    );
  });

  return computed(() => {
    const unwrapResult: Record<string, any> = {};
    Object.keys(props).forEach((key) => {
      unwrapResult[key] = unref(computedResult[key]);
    });
    return unwrapResult as { [K in keyof T]: T[K] };
  });
}
