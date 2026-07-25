import type {
  KtTableProps,
  KtTableRecord,
  KtTableRegisterApi,
  KtTableRegisterFn,
  KtTableSetProps,
} from '../types';

/**
 * 创建表格未注册时抛出的统一错误。
 */
function createUnregisteredError() {
  return new Error('[KtTable]: table is not registered yet.');
}

/**
 * 创建 KtTable register 函数和可命令式调用的表格 API。
 *
 * @param options 初始化时预先写入的表格配置。
 */
export function useKtTable<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
>(options: Partial<KtTableProps<Row, SearchValues>> = {}) {
  let tableApi: KtTableRegisterApi<Row, SearchValues> | null = null;
  let pendingProps: Partial<KtTableProps<Row, SearchValues>> = { ...options };

  /**
   * 获取已注册的表格 API，未注册时抛出明确错误。
   */
  function getTableApi() {
    if (!tableApi) {
      throw createUnregisteredError();
    }

    return tableApi;
  }

  const setProps: KtTableSetProps<Row, SearchValues> = (nextProps) => {
    if (tableApi) {
      tableApi.setProps(nextProps);
      return;
    }

    const patch =
      typeof nextProps === 'function'
        ? nextProps(pendingProps as never)
        : nextProps;
    pendingProps = {
      ...pendingProps,
      ...patch,
    };
  };

  const register: KtTableRegisterFn<Row, SearchValues> = (api) => {
    tableApi = api;
    api.setProps(pendingProps);
  };

  const api = {
    get formApi() {
      return getTableApi().formApi;
    },
    getProps: () => getTableApi().getProps(),
    getRows: () => getTableApi().getRows(),
    getSearchValues: () => getTableApi().getSearchValues(),
    registerHook: (...args) => getTableApi().registerHook(...args),
    reload: () => getTableApi().reload(),
    reset: () => getTableApi().reset(),
    search: () => getTableApi().search(),
    selectedRowKeys: () => getTableApi().selectedRowKeys(),
    selectedRows: () => getTableApi().selectedRows(),
    setProps,
    setSearchValues: (...args) => getTableApi().setSearchValues(...args),
    unregisterHook: (...args) => getTableApi().unregisterHook(...args),
  } as KtTableRegisterApi<Row, SearchValues>;

  return [register, api] as const;
}
