import type {
  KtTableButton,
  KtTableContext,
  KtTableRecord,
  KtTableRowAction,
} from '../types';

import { useAccess } from '@vben/access';

/**
 * 初始化 KtTable 按钮和行操作权限解析工具。
 *
 * @param context - 传给函数式 visible 等条件配置求值的 KtTable 上下文。
 * @returns 权限判断、条件求值及按钮、行操作和批量行筛选方法。
 */
export function useKtTablePermission(context: KtTableContext) {
  const { hasAccessByCodes } = useAccess();

  type ContextBoolean =
    | ((context: KtTableContext) => boolean)
    | boolean
    | undefined;

  /**
   * 根据当前访问码与按钮要求的权限码判断操作是否可用。
   *
   * @param permissionCodes - 操作要求的权限码集合；未配置时按无需额外权限处理。
   * @returns 未要求权限或至少命中一个权限码时为 true，否则为 false。
   */
  function canAccess(permissionCodes?: string[]) {
    return !permissionCodes || hasAccessByCodes(permissionCodes);
  }

  /**
   * 解析静态或函数式布尔配置；缺少配置时返回调用方提供的兜底值。
   *
   * @param value - 布尔值或根据 KtTable 上下文求值的函数。
   * @param fallback - 配置既不是布尔值也不是函数时采用的布尔值。
   * @returns 布尔配置本身或条件函数执行结果；异常空值使用 fallback。
   */
  function resolveBoolean(value: ContextBoolean, fallback: boolean) {
    if (typeof value === 'function') return value(context);
    if (typeof value === 'boolean') return value;
    return fallback;
  }

  /**
   * 过滤当前用户可见的普通按钮。
   *
   * @param items - 需要按权限和 visible 条件筛选的普通按钮。
   * @returns 权限和 visible 条件均允许的普通按钮数组。
   */
  function filterVisibleButtons(items: KtTableButton[]) {
    return items.filter(
      (item) =>
        canAccess(item.permissionCodes) && resolveBoolean(item.visible, true),
    );
  }

  /**
   * 过滤当前用户可见的行操作按钮。
   *
   * @param items - 需要按权限和 visible 条件筛选的行操作。
   * @returns 权限和 visible 条件均允许的行操作数组。
   */
  function filterVisibleActions(items: KtTableRowAction[]) {
    return items.filter(
      (item) =>
        canAccess(item.permissionCodes) && resolveBoolean(item.visible, true),
    );
  }

  /**
   * 从选中行数组中移除空记录，保留可交给批量操作的有效行对象。
   *
   * @param rows - 可能包含空值的当前选中行集合。
   * @returns 移除空值后的选中行集合。
   */
  function getEnabledRows(rows: KtTableRecord[]) {
    return rows.filter(Boolean);
  }

  return {
    filterVisibleActions,
    filterVisibleButtons,
    getEnabledRows,
    resolveBoolean,
  };
}
