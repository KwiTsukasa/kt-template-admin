import type { KtTableHook, KtTableModule, KtTableRecord } from '../types';

/**
 * 定义 KtTable hook，帮助业务侧保留泛型类型推导。
 *
 * @param hook - 需要保留行与搜索值泛型推导的 KtTable hook 定义。
 * @returns 原样返回的 hook，并保留调用点的行与搜索值泛型。
 */
export function defineKtTableHook<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
>(hook: KtTableHook<Row, SearchValues>) {
  return hook;
}

/**
 * 定义 KtTable 可插拔模块，帮助业务侧保留泛型类型推导。
 *
 * @param module - 业务侧定义的 KtTable 模块及其 hook、列和表单扩展。
 * @returns 原样返回的模块，并保留调用点的行与搜索值泛型。
 */
export function defineKtTableModule<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
>(module: KtTableModule<Row, SearchValues>) {
  return module;
}
