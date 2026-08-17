import type { DictApi } from '#/api/core';

import { computed, readonly, ref, shallowRef } from 'vue';

import { getDictByKey } from '#/api/core';

export interface DictOption<TValue = number | string> {
  label: string;
  raw?: DictApi.Option;
  value: TValue;
}

export interface LoadDictOptions<TValue = number | string> {
  fallbackOptions?: Array<DictOption<TValue>>;
  refresh?: boolean;
}

export interface UseDictOptions<
  TValue = number | string,
> extends LoadDictOptions<TValue> {
  immediate?: boolean;
}

const DICT_CACHE = new Map<string, Array<DictOption>>();
const DICT_PENDING = new Map<string, Promise<Array<DictOption>>>();

/**
 * 按字典键复用缓存或进行中的请求；强制刷新时重新拉取，空响应及请求失败按兜底选项处理。
 *
 * @param dictKey - 后端字典分组的唯一键。
 * @param options - 是否绕过缓存以及接口无数据或失败时使用的兜底选项；未传入时使用 `{}`。
 * @returns 加载并规范化后的字典选项；请求失败且有兜底项时返回兜底项。
 */
export async function loadDictOptions<TValue = number | string>(
  dictKey: string,
  options: LoadDictOptions<TValue> = {},
): Promise<Array<DictOption<TValue>>> {
  if (!dictKey) {
    return normalizeFallbackOptions(options.fallbackOptions);
  }

  if (!options.refresh && DICT_CACHE.has(dictKey)) {
    return DICT_CACHE.get(dictKey) as Array<DictOption<TValue>>;
  }

  if (!options.refresh && DICT_PENDING.has(dictKey)) {
    return DICT_PENDING.get(dictKey) as Promise<Array<DictOption<TValue>>>;
  }

  const pending = getDictByKey(dictKey)
    .then((list) => {
      const normalized = normalizeDictOptions<TValue>(list);
      const nextOptions = (() => {
        if (normalized.length > 0) {
          return normalized;
        }
        return normalizeFallbackOptions(options.fallbackOptions);
      })();
      DICT_CACHE.set(dictKey, nextOptions as Array<DictOption>);
      return nextOptions;
    })
    .catch((error) => {
      const fallback = normalizeFallbackOptions(options.fallbackOptions);
      if (fallback.length > 0) {
        DICT_CACHE.set(dictKey, fallback as Array<DictOption>);
        return fallback;
      }
      throw error;
    })
    .finally(() => {
      DICT_PENDING.delete(dictKey);
    });

  DICT_PENDING.set(dictKey, pending as Promise<Array<DictOption>>);
  return pending;
}

/**
 * 读取指定字典键的内存缓存，尚未加载时返回空选项数组。
 *
 * @param dictKey - 后端字典分组的唯一键。
 * @returns 缓存中的字典选项；尚未加载时为空数组。
 */
export function getCachedDictOptions<TValue = number | string>(
  dictKey: string,
) {
  return (DICT_CACHE.get(dictKey) || []) as Array<DictOption<TValue>>;
}

/**
 * 按可选字典键同时失效缓存和进行中请求；缺少键时重置全部字典内存状态。
 *
 * @param dictKey - 要清除的字典分组键；省略时清除所有字典缓存与进行中请求。
 */
export function clearDictCache(dictKey?: string) {
  if (dictKey) {
    DICT_CACHE.delete(dictKey);
    DICT_PENDING.delete(dictKey);
    return;
  }
  DICT_CACHE.clear();
  DICT_PENDING.clear();
}

/**
 * 按稳定字符串值查找字典标签，未匹配时依次回退到指定文本和原值文本。
 *
 * @param options - 用于按值查找展示标签的字典选项。
 * @param value - 需要在字典选项中查找标签的业务值。
 * @param fallback - 字典中找不到目标值时显示的文本。
 * @returns 匹配值的字典标签；无匹配项时返回 fallback，未提供 fallback 时返回原值文本。
 */
export function getDictLabel(
  options: Array<DictOption>,
  value: unknown,
  fallback?: string,
) {
  const valueKey = getDictValueKey(value);
  const matched = options.find(
    (item) => getDictValueKey(item.value) === valueKey,
  );
  return matched?.label ?? fallback ?? valueKey;
}

/**
 * 创建字典选项的响应式加载状态、值到标签索引与刷新操作，并可在初始化时立即加载。
 *
 * @param dictKey - 后端字典分组的唯一键。
 * @param options - 初始兜底选项、缓存刷新策略和是否立即加载的配置；未传入时使用 `{}`。
 * @returns 字典选项、加载状态、错误状态、刷新方法与标签查找方法。
 */
export function useDict<TValue = number | string>(
  dictKey: string,
  options: UseDictOptions<TValue> = {},
) {
  const dictOptions = shallowRef<Array<DictOption<TValue>>>(
    normalizeFallbackOptions(options.fallbackOptions),
  );
  const error = ref<unknown>();
  const loading = ref(false);
  const optionMap = computed(() => {
    const map: Record<string, DictOption<TValue>> = {};
    for (const item of dictOptions.value) {
      map[getDictValueKey(item.value)] = item;
    }
    return map;
  });

  /**
   * 加载指定字典选项并维护加载与错误状态；请求失败时使用调用方提供的兜底选项。
   *
   * @param refresh - 是否绕过本地字典缓存并强制重新请求；未传入时使用 `false`。
   * @returns 本次加载到的字典选项；请求失败时为规范化后的兜底选项。
   */
  async function reload(refresh = false) {
    loading.value = true;
    error.value = undefined;
    try {
      dictOptions.value = await loadDictOptions<TValue>(dictKey, {
        fallbackOptions: options.fallbackOptions,
        refresh,
      });
      return dictOptions.value;
    } catch (currentError) {
      error.value = currentError;
      dictOptions.value = normalizeFallbackOptions(options.fallbackOptions);
      return dictOptions.value;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 从选项集合中查找目标值的展示文本，未匹配时回退为原始值。
   *
   * @param value - 要在当前字典选项中查找展示标签的值。
   * @param fallback - 找不到选项时返回的展示文本；缺省时使用原始值。
   * @returns 匹配选项的展示文本；找不到选项时返回原始值。
   */
  function labelOf(value: unknown, fallback?: string) {
    const valueKey = getDictValueKey(value);
    return optionMap.value[valueKey]?.label ?? fallback ?? valueKey;
  }

  if (options.immediate !== false) {
    void reload();
  }

  return {
    error: readonly(error),
    labelOf,
    loading: readonly(loading),
    options: dictOptions,
    reload,
  };
}

/**
 * 丢弃缺少标签或值的接口记录，并转换成保留原记录引用的字典选项。
 *
 * @param list - 后端返回的字典记录；未传入时使用空数组。
 * @returns 仅包含有效标签和值、同时保留原始记录的字典选项。
 */
function normalizeDictOptions<TValue = number | string>(
  list: DictApi.Option[] = [],
): Array<DictOption<TValue>> {
  return list
    .filter((item) => item && item.label && item.value !== undefined)
    .map((item) => ({
      label: item.label,
      raw: item,
      value: item.value as TValue,
    }));
}

/**
 * 浅拷贝调用方提供的兜底选项，避免字典状态直接复用外部对象。
 *
 * @param options - 要复制为内部字典状态的兜底选项；未传入时使用空数组。
 * @returns 保留值类型和原始记录、逐项浅拷贝后的兜底选项。
 */
function normalizeFallbackOptions<TValue = number | string>(
  options: Array<DictOption<TValue>> = [],
) {
  return options.map((item) => ({ ...item }));
}

/**
 * 把字典值转换为可比较的字符串键，并将 null 或 undefined 归一为空字符串。
 *
 * @param value - 需要规范化为稳定缓存键的字典值。
 * @returns 字典值的稳定字符串缓存键；null 或 undefined 为空字符串。
 */
function getDictValueKey(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}
