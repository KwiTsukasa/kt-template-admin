import type { VNodeChild } from 'vue';

import type {
  KtTableContext,
  KtTableProps,
  KtTableRecord,
  KtTableRegisterApi,
  KtTableRowAction,
  KtTableSize,
} from './types';

import {
  computed,
  defineComponent,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { ChevronDown } from '@vben/icons';

import { EllipsisOutlined } from '@antdv-next/icons';
import { Button, Popover, Space, Table } from 'antdv-next';

import KtTableFooter from './components/KtTableFooter';
import KtTableHeader from './components/KtTableHeader';
import KtTableResizableTitle from './components/KtTableResizableTitle';
import KtTableSearch from './components/KtTableSearch';
import KtTableSettings from './components/KtTableSettings';
import { renderKtTableSummary } from './components/KtTableSummary';
import {
  KT_TABLE_ACTION_COLUMN_KEY,
  KT_TABLE_INDEX_COLUMN_KEY,
  KT_TABLE_ROW_ACTION_OVERFLOW_LIMIT,
  KT_TABLE_ROW_ACTION_VISIBLE_COUNT,
} from './config/constants';
import { DEFAULT_TABLE_SETTING, ktTableProps } from './config/ktTableProps';
import { useKtTableActions } from './hooks/useKtTableActions';
import { useKtTableColumns } from './hooks/useKtTableColumns';
import { useKtTableForm } from './hooks/useKtTableForm';
import { useKtTableRuntimeHooks } from './hooks/useKtTableHooks';
import { useKtTableLayout } from './hooks/useKtTableLayout';
import { useKtTablePermission } from './hooks/useKtTablePermission';
import { useKtTableResolvedProps } from './hooks/useKtTableResolvedProps';
import { useKtTableSelection } from './hooks/useKtTableSelection';
import { normalizePageResult } from './utils/index';

import './style.scss';

const AButton = Button as any;
const APopover = Popover as any;
const ASpace = Space as any;
const ATable = Table as any;

const tableComponents = {
  header: {
    cell: KtTableResizableTitle,
  },
};

type SortState = {
  field?: string;
  order?: string;
};

type LoadOptions = {
  validateForm?: boolean;
};

export default defineComponent({
  name: 'KtTable',
  props: ktTableProps,
  emits: ['register'],
  /**
   * 初始化 KtTable 主组件，组装表单、按钮、列、分页、选择和注册式 API。
   *
   * @param rawProps 组件显式传入的 props，后续会和 register 配置合并。
   * @param emit Vue setup context。
   * @param emit.emit Vue 事件发送器，用于向业务侧暴露 register API。
   * @param emit.expose Vue 暴露实例方法的函数，用于模板 ref 直接访问表格 API。
   * @param emit.slots 业务侧传入的 title、toolbar、bodyCell、summary、footer 等插槽。
   */
  setup(rawProps, { emit, expose, slots }) {
    const { props, setProps } = useKtTableResolvedProps(
      rawProps as KtTableProps,
    );

    const loading = ref(false);
    const rows = ref<KtTableRecord[]>([]);
    const sortState = reactive<SortState>({});
    const pagination = reactive({
      current: 1,
      pageSize: props.pageSize,
      total: 0,
    });
    const fullscreen = ref(false);
    const searchCollapsed = ref(false);
    const searchVisible = ref(true);
    const tableSize = ref<KtTableSize>(props.size);
    const mounted = ref(false);
    const autoLoaded = ref(false);

    const {
      formApi,
      formGrid,
      formOptions,
      getSearchValues,
      resetForm,
      SearchForm,
      setSearchValues,
    } = useKtTableForm(props);
    const { registerHook, runHook, unregisterHook } =
      useKtTableRuntimeHooks(props);
    const { clearSelection, rowSelection, selectedRowKeys, selectedRows } =
      useKtTableSelection(props);

    const api = computed(
      () =>
        props.api || props.modules.find((module) => !!module.api)?.api || null,
    );
    const tableSetting = computed(() => ({
      ...DEFAULT_TABLE_SETTING,
      ...props.tableSettings,
    }));
    const statistics = computed(() => [
      ...props.statistics,
      ...props.modules.flatMap((module) => module.statistics || []),
    ]);
    const hasSummary = computed(
      () => statistics.value.length > 0 || !!slots.summary,
    );
    const {
      handleSearchTransitionEnd,
      handleSearchTransitionStart,
      scheduleTableLayout,
      tableBodyRef,
      tableScrollY,
    } = useKtTableLayout({ hasSummary });

    const context: KtTableContext = {
      formApi,
      getRows: () => rows.value,
      getSearchValues,
      registerHook,
      reload,
      reset,
      search,
      selectedRowKeys: () => selectedRowKeys.value,
      selectedRows: () => selectedRows.value,
      setSearchValues,
      unregisterHook,
    };
    const registerApi: KtTableRegisterApi = {
      ...context,
      getProps: () => ({ ...props }),
      setProps,
    };

    emit('register', registerApi);

    const permissions = useKtTablePermission(context);
    const {
      formButtons,
      headerButtons,
      renderButton,
      renderRowAction,
      rowActions,
    } = useKtTableActions({
      context,
      permissions,
      props,
      reload,
      reset,
      runHook,
      search,
    });
    const {
      columnOrderKeys,
      columns,
      reorderColumns,
      resetColumns,
      sourceColumns,
      tableScrollX,
      visibleColumnKeys,
    } = useKtTableColumns({
      props,
      rowActions,
      scheduleTableLayout,
    });

    watch(
      () => props.size,
      (size) => {
        tableSize.value = size;
      },
      {
        immediate: true,
      },
    );
    watch(
      () => props.pageSize,
      (pageSize) => {
        pagination.pageSize = pageSize;
      },
      {
        immediate: true,
      },
    );
    watch(
      () => props.dataSource,
      (dataSource) => {
        if (!api.value?.list && Array.isArray(dataSource)) {
          rows.value = dataSource;
          pagination.total = dataSource.length;
        }
      },
      {
        immediate: true,
      },
    );
    watch(
      [searchCollapsed, formOptions],
      ([collapsed]) => {
        formApi.setState({ collapsed, showCollapseButton: true });
      },
      {
        immediate: true,
      },
    );

    /**
     * 根据当前分页状态和当前页行下标计算序号列展示值。
     *
     * @param index Antdv Table 当前页内的行下标，从 0 开始。
     */
    function resolveRowIndex(index: number) {
      if (!props.showPagination) return index + 1;

      return (pagination.current - 1) * pagination.pageSize + index + 1;
    }

    /**
     * 从 Antdv bodyCell 参数中解析当前行序号，兼容 slot 未透出 index 的情况。
     *
     * @param record 当前行数据。
     * @param index Antdv Table 当前页内的行下标；部分版本可能不传。
     */
    function resolveRecordIndex(record: KtTableRecord, index?: number) {
      const rowIndex =
        typeof index === 'number' ? index : rows.value.indexOf(record);

      return resolveRowIndex(Math.max(rowIndex, 0));
    }

    /**
     * 读取查询参数，并按需触发表单校验。
     *
     * @param options 加载参数选项，控制是否在读取参数前校验表单。
     */
    async function getFetchParams(options: LoadOptions = {}) {
      if (options.validateForm) {
        const { valid } = await formApi.validate();
        if (!valid) return null;
      }

      return {
        ...(await getSearchValues()),
        pageNo: props.showPagination ? pagination.current : undefined,
        pageSize: props.showPagination ? pagination.pageSize : undefined,
        sortField: sortState.field,
        sortOrder: sortState.order,
      };
    }

    /**
     * 加载表格数据，兼容接口数据源和静态 dataSource。
     *
     * @param options 加载参数选项，透传给查询参数构建逻辑。
     */
    async function loadData(options: LoadOptions = {}) {
      if (!api.value?.list) {
        const list = props.dataSource || [];
        rows.value = list;
        pagination.total = list.length;
        return;
      }

      const rawParams = await getFetchParams(options);
      if (!rawParams) return;

      const params =
        ((await props.beforeFetch?.(rawParams, context)) as KtTableRecord) ||
        rawParams;

      loading.value = true;

      try {
        await runHook('onBeforeFetch', params, context);
        const result = await api.value.list(params, context);
        const afterResult =
          (await props.afterFetch?.(result, context)) || result;
        const normalized = normalizePageResult(afterResult);
        rows.value = normalized.list;
        pagination.total = normalized.total;
        clearSelection();
        await runHook('onAfterFetch', afterResult, context);
      } catch (error) {
        await runHook('onFetchError', error, context);
        throw error;
      } finally {
        loading.value = false;
      }
    }

    /**
     * 执行首次自动加载，register 模式下会等待 api 准备完成。
     */
    async function autoLoadData() {
      if (!props.immediate || autoLoaded.value || !api.value?.list) return;

      // register 模式下 api 可能晚于 mounted 合并，首次自动加载要等 api 真正可用。
      autoLoaded.value = true;
      await loadData();
    }

    /**
     * 执行查询操作，重置到第一页并要求表单校验通过。
     */
    async function search() {
      pagination.current = 1;
      await loadData({ validateForm: true });
    }

    /**
     * 重置查询表单并重新加载第一页数据。
     */
    async function reset() {
      await resetForm();
      pagination.current = 1;
      await loadData();
    }

    /**
     * 按当前分页、排序和搜索条件重新加载数据。
     */
    async function reload() {
      await loadData();
    }

    /**
     * 从 Antdv Table 排序参数中读取当前排序字段和排序方向。
     *
     * @param sorter Antdv Table 传入的排序对象或多排序对象数组。
     */
    function readSorter(sorter: KtTableRecord | KtTableRecord[]) {
      const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;

      sortState.field = currentSorter?.field || currentSorter?.columnKey;
      sortState.order = currentSorter?.order;
    }

    /**
     * 响应 Antdv Table 的排序/过滤/分页变化。
     *
     * @param _tablePagination Antdv Table 内部分页参数，KtTable 使用自定义分页所以当前不消费。
     * @param _filters Antdv Table 过滤参数，当前预留给未来列过滤扩展。
     * @param sorter Antdv Table 排序参数，用于更新 KtTable 排序状态。
     */
    function handleTableChange(
      _tablePagination: KtTableRecord,
      _filters: KtTableRecord,
      sorter: KtTableRecord | KtTableRecord[],
    ) {
      pagination.current = 1;
      readSorter(sorter);
      loadData();
    }

    /**
     * 响应底部分页变化并重新加载数据。
     *
     * @param pageInfo 分页组件传回的页码和每页条数。
     */
    function handlePageChange(pageInfo: KtTableRecord) {
      pagination.current = pageInfo.current || 1;
      pagination.pageSize = pageInfo.pageSize || props.pageSize;
      loadData();
    }

    /**
     * 渲染搜索表单区域和表单按钮。
     */
    function renderSearchArea() {
      const hasSearch = (formOptions.value.schema?.length || 0) > 0;
      const hasFormButtons = formButtons.value.length > 0;
      const hasCollapse =
        hasSearch && (formOptions.value.schema?.length || 0) > 4;
      const visible = hasSearch && searchVisible.value;

      if (!visible) return null;

      return (
        <KtTableSearch
          collapsed={searchCollapsed.value}
          formGrid={formGrid.value}
          onTransitionEnd={handleSearchTransitionEnd}
          onTransitionStart={handleSearchTransitionStart}
          visible
        >
          {{
            actions: () =>
              hasFormButtons || hasCollapse ? (
                <div class="kt-table__search-action-stack">
                  {formButtons.value.map((button) => renderButton(button))}
                  {hasCollapse ? (
                    <AButton
                      class="kt-table__search-toggle"
                      onClick={() => {
                        searchCollapsed.value = !searchCollapsed.value;
                      }}
                      type="link"
                    >
                      <ChevronDown
                        class={[
                          'kt-table__search-toggle-icon',
                          searchCollapsed.value
                            ? ''
                            : 'kt-table__search-toggle-icon--expanded',
                        ]}
                      />
                      {searchCollapsed.value ? '展开' : '收起'}
                    </AButton>
                  ) : null}
                </div>
              ) : null,
            form: () => <SearchForm />,
          }}
        </KtTableSearch>
      );
    }

    /**
     * 渲染操作列里的行操作按钮。
     *
     * @param record 当前行数据。
     */
    function renderActionCell(record: KtTableRecord) {
      const { inlineActions, overflowActions } = splitRowActions(
        rowActions.value,
      );

      return (
        <ASpace class="kt-table__row-actions" size={1}>
          {inlineActions.map((action) => renderRowAction(action, record))}
          {overflowActions.length > 0 ? (
            <APopover
              overlayClassName="kt-table__row-action-popover"
              placement="bottomRight"
              trigger="click"
            >
              {{
                content: () => (
                  <div class="kt-table__row-action-popover-content">
                    {overflowActions.map((action) =>
                      renderRowAction(action, record),
                    )}
                  </div>
                ),
                default: () => (
                  <AButton
                    aria-label="更多操作"
                    class="kt-table__row-action-more"
                    type="link"
                  >
                    <EllipsisOutlined class="kt-table__row-action-more-icon" />
                  </AButton>
                ),
              }}
            </APopover>
          ) : null}
        </ASpace>
      );
    }

    /**
     * 将行操作按内联展示和弹层展示拆分。
     *
     * @param actions 当前行可见操作按钮列表。
     */
    function splitRowActions(actions: KtTableRowAction[]) {
      if (actions.length <= KT_TABLE_ROW_ACTION_OVERFLOW_LIMIT) {
        return {
          inlineActions: actions,
          overflowActions: [],
        };
      }

      return {
        inlineActions: actions.slice(0, KT_TABLE_ROW_ACTION_VISIBLE_COUNT),
        overflowActions: actions.slice(KT_TABLE_ROW_ACTION_VISIBLE_COUNT),
      };
    }

    /**
     * 渲染表格头部左侧业务按钮和 toolbar 插槽。
     */
    function renderHeaderButtons() {
      const toolbar = slots.toolbar?.(context);
      const buttons = headerButtons.value.map((button) => renderButton(button));

      if (!toolbar && buttons.length === 0) return null;

      return (
        <ASpace wrap>
          {buttons}
          {toolbar}
        </ASpace>
      );
    }

    /**
     * 渲染表格头部右侧设置按钮组。
     */
    function renderHeaderSettings() {
      if (!props.showTableSetting) return null;

      return (
        <KtTableSettings
          columnOrderKeys={columnOrderKeys.value}
          columns={sourceColumns.value}
          fullscreen={fullscreen.value}
          onColumnOrderKeysChange={(keys: string[]) => {
            reorderColumns(keys);
          }}
          onFullscreenChange={(value: boolean) => {
            fullscreen.value = value;
          }}
          onReload={reload}
          onResetColumns={resetColumns}
          onSearchVisibleChange={(value: boolean) => {
            searchVisible.value = value;
          }}
          onSizeChange={(value: KtTableSize) => {
            tableSize.value = value;
          }}
          onVisibleColumnKeysChange={(keys: string[]) => {
            visibleColumnKeys.value = keys;
          }}
          searchVisible={searchVisible.value}
          setting={tableSetting.value}
          size={tableSize.value}
          visibleColumnKeys={visibleColumnKeys.value}
        />
      );
    }

    expose(registerApi);

    onMounted(() => {
      mounted.value = true;
      autoLoadData();
    });

    watch(api, () => {
      if (mounted.value) {
        autoLoadData();
      }
    });

    watch(
      [columns, rows, searchVisible, fullscreen, tableSize],
      () => {
        scheduleTableLayout();
      },
      {
        deep: true,
      },
    );

    return () => (
      <div class={['kt-table', fullscreen.value ? 'kt-table--fullscreen' : '']}>
        <div class="kt-table__main">
          {renderSearchArea()}

          <div class="kt-table__main-content">
            {props.showHeader ? (
              <KtTableHeader title={props.tableTitle}>
                {{
                  settings: renderHeaderSettings,
                  title: () => slots.title?.(),
                  toolbar: renderHeaderButtons,
                }}
              </KtTableHeader>
            ) : null}

            <div
              class="kt-table__body"
              ref={tableBodyRef}
              style={{
                '--kt-table-scroll-y': `${tableScrollY.value}px`,
              }}
            >
              <ATable
                class="kt-table__ant"
                columns={columns.value}
                components={tableComponents}
                dataSource={rows.value}
                loading={loading.value}
                onChange={handleTableChange}
                pagination={false}
                rowKey={props.rowKey}
                rowSelection={rowSelection.value}
                scroll={{ x: tableScrollX.value, y: tableScrollY.value }}
                size={tableSize.value}
                v-slots={{
                  bodyCell: ({ column, index, record }: any): VNodeChild => {
                    if (column.key === KT_TABLE_INDEX_COLUMN_KEY) {
                      return resolveRecordIndex(record, index);
                    }

                    if (column.key === KT_TABLE_ACTION_COLUMN_KEY) {
                      return renderActionCell(record);
                    }

                    return slots.bodyCell?.({ column, record });
                  },
                  summary: (): VNodeChild =>
                    hasSummary.value
                      ? renderKtTableSummary({
                          columns: columns.value,
                          context,
                          customSummary: slots.summary?.({
                            columns: columns.value,
                            context,
                            rows: rows.value,
                          }),
                          showSelection: props.showSelection,
                          statistics: statistics.value,
                        })
                      : null,
                }}
              />
            </div>

            {props.showFooter ? (
              <KtTableFooter
                current={pagination.current}
                onPageChange={handlePageChange}
                pageSize={pagination.pageSize}
                pageSizeOptions={props.pageSizeOptions}
                selectedCount={selectedRowKeys.value.length}
                showPagination={props.showPagination}
                showSelection={props.showSelection}
                total={pagination.total}
              >
                {{
                  default: () =>
                    slots.footer?.({
                      context,
                      selectedRowKeys: selectedRowKeys.value,
                      selectedRows: selectedRows.value,
                    }),
                }}
              </KtTableFooter>
            ) : null}
          </div>
        </div>
      </div>
    );
  },
});
