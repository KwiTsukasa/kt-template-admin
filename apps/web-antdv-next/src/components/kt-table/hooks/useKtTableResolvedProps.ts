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
 * @param value - 需要从 camelCase 转成 kebab-case 的 prop 名。
 * @returns 与 camelCase prop 对应的 kebab-case 名称。
 */
function toKebabCase(value: string) {
  return value.replaceAll(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * 合并 KtTable 默认配置、register 配置和显式 props。
 *
 * @param rawProps - KtTable 组件本次接收的原始 props。
 * @returns 最终生效的响应式 props，以及 register 配置的更新入口。
 */
export function useKtTableResolvedProps(rawProps: KtTableProps) {
  const instance = getCurrentInstance();
  const registeredProps = shallowRef<Partial<KtTableProps>>({});
  const props = shallowReactive({}) as KtTableResolvedProps;
  Object.assign(props, createDefaultTableProps());

  /**
   * 通过 vnode.props 同时检查 camelCase 与 kebab-case 名称，判断调用方是否显式传值。
   *
   * @param key - 要检查是否由调用方显式传入的 KtTable prop 名。
   * @returns vnode 上存在 camelCase 或 kebab-case 同名 prop 时为 true。
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
   * 从原始 props 中收集调用方显式提供的字段，避免默认值覆盖 register 配置。
   *
   * @returns 只包含组件调用方显式传入字段的 props 补丁。
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
   * 按默认值、注册配置和组件显式属性的优先级覆盖响应式 KtTable props。
   */
  function syncResolvedProps() {
    Object.assign(
      props,
      createDefaultTableProps(),
      registeredProps.value,
      getExplicitProps(),
    );
  }

  const setProps: KtTableSetProps = (nextProps) => {
    const patch = (() => {
      if (typeof nextProps === 'function') {
        return nextProps({ ...props });
      }
      return nextProps;
    })();

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
