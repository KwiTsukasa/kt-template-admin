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
 * @param dictKey 字典编码，对应后端 admin_dict.dict_code。
 * @param options 字典加载配置；refresh 为 true 时跳过缓存重新请求。
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
      const nextOptions =
        normalized.length > 0
          ? normalized
          : normalizeFallbackOptions(options.fallbackOptions);
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
 * @param dictKey 字典编码，对应后端 admin_dict.dict_code。
 */
export function getCachedDictOptions<TValue = number | string>(
  dictKey: string,
) {
  return (DICT_CACHE.get(dictKey) || []) as Array<DictOption<TValue>>;
}

/**
 * @param dictKey 可选字典编码；不传时清空全部前端字典缓存。
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
 * @param options 字典选项列表。
 * @param value 需要翻译的字典值。
 * @param fallback 未命中字典时展示的兜底文案；默认返回原值字符串。
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
 * @param dictKey 字典编码，对应后端 admin_dict.dict_code。
 * @param options 组合式字典配置；immediate 默认为 true。
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
 * @param list 后端字典接口返回的原始列表。
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
 * @param options 业务传入的兜底字典项。
 */
function normalizeFallbackOptions<TValue = number | string>(
  options: Array<DictOption<TValue>> = [],
) {
  return options.map((item) => ({ ...item }));
}

/**
 * @param value 字典值；统一转字符串后比较，兼容后端数字/字符串混合返回。
 */
function getDictValueKey(value: unknown) {
  return value === undefined || value === null ? '' : String(value);
}
