import type {
  KtTableProps,
  KtTableResolvedProps,
  KtTableSetProps,
} from '../types';

import {
  getCurrentInstance,
  shallowReactive,
  shallowRef,
  watchEffect,
} from 'vue';

import {
  createDefaultTableProps,
  KT_TABLE_PROP_KEYS,
} from '../config/ktTableProps';

/**
 * 将 camelCase prop 名转换成模板中常见的 kebab-case。
 *
 * @param value camelCase 格式的 prop 名。
 */
function toKebabCase(value: string) {
  return value.replaceAll(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * 合并 KtTable 默认配置、register 配置和显式 props。
 *
 * @param rawProps 组件当前收到的原始 props。
 */
export function useKtTableResolvedProps(rawProps: KtTableProps) {
  const instance = getCurrentInstance();
  const registeredProps = shallowRef<Partial<KtTableProps>>({});
  const props = shallowReactive({}) as KtTableResolvedProps;
  Object.assign(props, createDefaultTableProps());

  /**
   * 判断某个 prop 是否由组件调用方显式传入。
   *
   * @param key 需要判断的 KtTable prop 名。
   */
  function hasExplicitProp(key: keyof KtTableProps) {
    const vnodeProps = instance?.vnode.props || {};
    const propName = String(key);

    return (
      Object.hasOwn(vnodeProps, propName) ||
      Object.hasOwn(vnodeProps, toKebabCase(propName))
    );
  }

  /**
   * 收集所有显式传入的 props。
   */
  function getExplicitProps() {
    const result: Partial<KtTableProps> = {};
    for (const key of KT_TABLE_PROP_KEYS) {
      const value = rawProps[key];
      if (hasExplicitProp(key)) {
        (result as Record<string, unknown>)[key] = value;
      }
    }

    return result;
  }

  /**
   * 同步最终生效的 KtTable props。
   */
  function syncResolvedProps() {
    Object.assign(
      props,
      createDefaultTableProps(),
      registeredProps.value,
      getExplicitProps(),
    );
  }

  /**
   * 写入 register 模式下的动态 props，并同步最终 props。
   *
   * @param nextProps 需要合并的 props 补丁，或基于当前 props 返回补丁的函数。
   */
  const setProps: KtTableSetProps = (nextProps) => {
    const patch =
      typeof nextProps === 'function' ? nextProps({ ...props }) : nextProps;

    registeredProps.value = {
      ...registeredProps.value,
      ...patch,
    };
    syncResolvedProps();
  };

  watchEffect(syncResolvedProps);

  return {
    props,
    setProps,
  };
}
