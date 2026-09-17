import type { PublishedReference } from '#/api/automation/definition';

import { onBeforeUnmount, shallowReactive } from 'vue';

/**
 * 按资源及发布版本复用已加载的契约，并合并并发请求；卸载后不再写入页面状态。
 * @param loader - 读取不可变发布版本的接口。
 * @param onFailure - 当前页面展示加载错误的回调。
 * @returns 精确版本读取及去重加载函数。
 */
export function usePublishedAsset<T>(
  loader: (reference: PublishedReference) => Promise<T>,
  onFailure: () => void,
) {
  const values = shallowReactive(new Map<string, T>());
  const pending = new Map<string, Promise<void>>();
  let disposed = false;
  const keyOf = (reference: PublishedReference) =>
    `${reference.id}:${reference.version}`;
  const get = (reference: PublishedReference) => values.get(keyOf(reference));
  const set = (reference: PublishedReference, value: T) => {
    if (!disposed) values.set(keyOf(reference), value);
  };
  const load = async (reference: PublishedReference): Promise<void> => {
    const key = keyOf(reference);
    if (disposed || values.has(key)) return;
    const existing = pending.get(key);
    if (existing) return existing;
    const request = loader(reference)
      .then((value) => {
        if (!disposed) values.set(key, value);
      })
      .catch(() => {
        if (!disposed) onFailure();
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, request);
    return request;
  };
  onBeforeUnmount(() => {
    disposed = true;
  });
  return { get, set, load };
}
