import type {
  KtTableProps,
  KtTableRecord,
  KtTableRegisterApi,
  KtTableRegisterFn,
  KtTableSetProps,
} from '../types';

/**
 * 当组件尚未执行 register 时创建包含调用约束的统一错误。
 *
 * @returns 说明 KtTable 尚未注册的 Error 实例。
 */
function createUnregisteredError() {
  return new Error('[KtTable]: table is not registered yet.');
}

/**
 * 通过 register 回调绑定组件实例，并返回可命令式调用的 KtTable API。
 *
 * @param options - 注册阶段提供的 KtTable 初始配置；组件显式 props 会覆盖同名字段；未传入时使用 `{}`。
 * @returns 只读元组：组件 register 函数与代理已注册实例的命令式 API。
 */
export function useKtTable<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
>(options: Partial<KtTableProps<Row, SearchValues>> = {}) {
  let tableApi: KtTableRegisterApi<Row, SearchValues> | null = null;
  let pendingProps: Partial<KtTableProps<Row, SearchValues>> = { ...options };

  /**
   * 仅在组件完成 `register` 后，向命令式操作返回同一张表格的 API 实例。
   *
   * @returns 已经由组件 register 的 KtTable API。
   * @throws 组件尚未调用 register、表格 API 不可用时抛出。
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

    const patch = (() => {
      if (typeof nextProps === 'function') {
        return nextProps(pendingProps as never);
      }
      return nextProps;
    })();
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
    /**
     * 暴露当前表格关联的表单 API；未启用搜索表单时返回 undefined。
     *
     * @returns 当前表格关联的表单 API；搜索表单关闭时返回 undefined。
     */
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
