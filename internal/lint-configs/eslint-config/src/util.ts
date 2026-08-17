export type Awaitable<T> = Promise<T> | T;

/**
 * 同时兼容 ESM 默认导出与直接导出，返回调用方可统一使用的模块值。
 *
 * @param m - 正则替换回调接收到的完整匹配文本。
 * @returns 模块的默认导出；没有默认导出时返回模块本身。
 */
export async function interopDefault<T>(
  m: Awaitable<T>,
): Promise<T extends { default: infer U } ? U : T> {
  const resolved = await m;
  return (resolved as any).default || resolved;
}
