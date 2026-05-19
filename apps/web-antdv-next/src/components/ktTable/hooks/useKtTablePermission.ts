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
 * @param context KtTable 运行时上下文，供函数式 visible/disabled 判断读取状态。
 */
export function useKtTablePermission(context: KtTableContext) {
  const { hasAccessByCodes } = useAccess();

  type ContextBoolean =
    | ((context: KtTableContext) => boolean)
    | boolean
    | undefined;

  /**
   * 判断当前用户是否拥有指定权限码。
   *
   * @param permissionCodes 按钮或操作配置上的权限码列表。
   */
  function canAccess(permissionCodes?: string[]) {
    return !permissionCodes || hasAccessByCodes(permissionCodes);
  }

  /**
   * 解析 boolean 或函数式 boolean 配置。
   *
   * @param value 需要解析的布尔值或根据上下文计算布尔值的函数。
   * @param fallback value 未配置时使用的默认值。
   */
  function resolveBoolean(value: ContextBoolean, fallback: boolean) {
    if (typeof value === 'function') return value(context);
    if (typeof value === 'boolean') return value;
    return fallback;
  }

  /**
   * 过滤当前用户可见的普通按钮。
   *
   * @param items 待过滤的按钮配置列表。
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
   * @param items 待过滤的行操作配置列表。
   */
  function filterVisibleActions(items: KtTableRowAction[]) {
    return items.filter(
      (item) =>
        canAccess(item.permissionCodes) && resolveBoolean(item.visible, true),
    );
  }

  /**
   * 获取可参与批量操作的行数据。
   *
   * @param rows 当前选中的行数据列表。
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
