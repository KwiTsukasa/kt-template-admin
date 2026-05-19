import type { KtTableHook, KtTableModule, KtTableRecord } from '../types';

/**
 * 定义 KtTable hook，帮助业务侧保留泛型类型推导。
 *
 * @param hook 业务侧提供的 KtTable hook 配置。
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
 * @param module 业务侧提供的 KtTable 模块配置。
 */
export function defineKtTableModule<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
>(module: KtTableModule<Row, SearchValues>) {
  return module;
}
