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
  onBeforeUnmount,
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

type RowResizeState = {
  frame?: number;
  key: string;
  nextHeight: number;
  rowElement: HTMLTableRowElement;
  startHeight: number;
  startY: number;
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
    const rowHeights = reactive<Record<string, number>>({});
    let rowResizeGuideElement: HTMLDivElement | null = null;
    let rowResizeState: null | RowResizeState = null;

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
      tableViewportWidth,
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
      tableViewportWidth,
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
     * 解析行唯一标识，行高 resize 需要用它保存每一行的独立高度。
     *
     * @param record 当前行数据。
     */
    function resolveRecordKey(record: KtTableRecord) {
      const { rowKey } = props;

      if (typeof rowKey === 'function') {
        return rowKey(record);
      }

      return record[rowKey] ?? record.key ?? rows.value.indexOf(record);
    }

    /**
     * 将行高限制在配置区间内，避免拖拽到不可用高度。
     *
     * @param height 拖拽计算出的原始行高。
     */
    function clampRowHeight(height: number) {
      const minHeight = Math.max(24, props.rowResizeMinHeight);
      const maxHeight = Math.max(minHeight, props.rowResizeMaxHeight);

      return Math.min(maxHeight, Math.max(minHeight, Math.round(height)));
    }

    /**
     * 创建行高拖拽参考线，拖动期间只移动参考线并写当前行 DOM。
     *
     * @param rowElement 当前正在调整高度的表格行。
     */
    function createRowResizeGuide(rowElement: HTMLTableRowElement) {
      const tableBody = rowElement.closest('.kt-table__body');
      const bodyRect = tableBody?.getBoundingClientRect();
      if (!bodyRect) return;

      rowResizeGuideElement = document.createElement('div');
      rowResizeGuideElement.className = 'kt-table__row-resize-guide';
      rowResizeGuideElement.style.left = `${bodyRect.left}px`;
      rowResizeGuideElement.style.width = `${bodyRect.width}px`;
      document.body.append(rowResizeGuideElement);
    }

    /**
     * 按当前行和目标行高移动行高拖拽参考线。
     */
    function moveRowResizeGuide() {
      const state = rowResizeState;
      if (!state || !rowResizeGuideElement) return;

      const rowRect = state.rowElement.getBoundingClientRect();
      rowResizeGuideElement.style.transform = `translate3d(0, ${Math.round(
        rowRect.top + state.nextHeight,
      )}px, 0)`;
    }

    /**
     * 移除行高拖拽参考线。
     */
    function removeRowResizeGuide() {
      rowResizeGuideElement?.remove();
      rowResizeGuideElement = null;
    }

    /**
     * 判断鼠标是否命中序号列底部的行高拖拽区域。
     *
     * @param event 鼠标按下事件，用于读取当前坐标。
     * @param rowElement 当前鼠标所在表格行。
     */
    function isRowResizeHandleHit(
      event: MouseEvent,
      rowElement: HTMLTableRowElement,
    ) {
      const indexCell = rowElement.querySelector(
        '.kt-table__index-column',
      ) as HTMLElement | null;
      if (!indexCell) return false;

      const cellRect = indexCell.getBoundingClientRect();
      const rowRect = rowElement.getBoundingClientRect();
      const inIndexCell =
        event.clientX >= cellRect.left && event.clientX <= cellRect.right;
      const inBottomHandle =
        event.clientY >= rowRect.bottom - 8 && event.clientY <= rowRect.bottom;

      return inIndexCell && inBottomHandle;
    }

    /**
     * 拖拽行高时只直接写当前 tr 的内联高度，mouseup 后再写入响应式状态。
     * 这样可以避免拖拽过程中每一帧触发表格整体重算。
     */
    function applyDraggingRowHeight() {
      const state = rowResizeState;
      if (!state) return;

      state.frame = undefined;
      state.rowElement.style.height = `${state.nextHeight}px`;
      state.rowElement.style.setProperty(
        '--kt-table-row-height',
        `${state.nextHeight}px`,
      );
      moveRowResizeGuide();
    }

    /**
     * 响应行高拖拽移动。
     *
     * @param event 鼠标移动事件。
     */
    function handleRowResizeMove(event: MouseEvent) {
      const state = rowResizeState;
      if (!state) return;

      state.nextHeight = clampRowHeight(
        state.startHeight + event.clientY - state.startY,
      );
      if (state.frame) return;

      state.frame = window.requestAnimationFrame(applyDraggingRowHeight);
    }

    /**
     * 结束行高拖拽，并把最终高度写回行高状态表。
     */
    function stopRowResize() {
      const state = rowResizeState;
      if (!state) return;

      if (state.frame) {
        window.cancelAnimationFrame(state.frame);
        state.frame = undefined;
      }

      applyDraggingRowHeight();
      rowHeights[state.key] = state.nextHeight;
      removeRowResizeGuide();
      rowResizeState = null;
      document.removeEventListener('mousemove', handleRowResizeMove);
      document.removeEventListener('mouseup', stopRowResize);
      document.body.classList.remove('kt-table--row-resizing');
    }

    /**
     * 开始拖拽单行行高。
     *
     * @param event 行高拖拽手柄的鼠标按下事件。
     * @param record 当前行数据。
     */
    function startRowResize(event: MouseEvent, record: KtTableRecord) {
      if (!props.rowResizable) return;

      event.preventDefault();
      event.stopPropagation();

      const rowElement = (event.currentTarget as HTMLElement).closest(
        'tr',
      ) as HTMLTableRowElement | null;
      if (!rowElement) return;

      const key = String(resolveRecordKey(record));
      const currentHeight =
        rowHeights[key] || rowElement.getBoundingClientRect().height;
      const startHeight = clampRowHeight(currentHeight);

      rowResizeState = {
        key,
        nextHeight: startHeight,
        rowElement,
        startHeight,
        startY: event.clientY,
      };
      createRowResizeGuide(rowElement);
      applyDraggingRowHeight();
      document.body.classList.add('kt-table--row-resizing');
      document.addEventListener('mousemove', handleRowResizeMove);
      document.addEventListener('mouseup', stopRowResize);
    }

    /**
     * 处理行级鼠标按下事件，只在序号列底部命中区内启动行高拖拽。
     *
     * @param event 行级鼠标按下事件。
     * @param record 当前行数据。
     */
    function handleRowResizeMouseDown(
      event: MouseEvent,
      record: KtTableRecord,
    ) {
      if (!props.rowResizable) return;

      const rowElement = (event.currentTarget as HTMLElement).closest(
        'tr',
      ) as HTMLTableRowElement | null;
      if (!rowElement || !isRowResizeHandleHit(event, rowElement)) return;

      startRowResize(event, record);
    }

    /**
     * 为可调整行高的行追加 class 和高度 CSS 变量。
     *
     * @param record 当前行数据。
     */
    function resolveRowProps(record: KtTableRecord) {
      if (!props.rowResizable) return {};

      const height = rowHeights[String(resolveRecordKey(record))];

      return {
        class: 'kt-table__row--resizable',
        onMousedown: (event: MouseEvent) => {
          handleRowResizeMouseDown(event, record);
        },
        style: height
          ? {
              '--kt-table-row-height': `${height}px`,
              height: `${height}px`,
            }
          : undefined,
      };
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
        <ASpace class="kt-table__row-actions" size={0}>
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
      const visibleCount = resolveRowActionVisibleCount();

      if (actions.length <= visibleCount) {
        return {
          inlineActions: actions,
          overflowActions: [],
        };
      }

      return {
        inlineActions: actions.slice(0, visibleCount),
        overflowActions: actions.slice(visibleCount),
      };
    }

    /**
     * 解析行操作内联按钮数量，异常配置回退到默认两个。
     */
    function resolveRowActionVisibleCount() {
      const visibleCount = Number(props.rowActionVisibleCount);

      if (!Number.isFinite(visibleCount)) {
        return KT_TABLE_ROW_ACTION_VISIBLE_COUNT;
      }

      return Math.max(0, Math.floor(visibleCount));
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

    /**
     * 生成表格布局监听签名，只收集会影响容器高度、横向滚动和列宽的轻量信号。
     * 行内字段变化仍由 Vue/Antdv 正常渲染，不再触发布局重算，避免 deep watch 遍历整页数据。
     */
    function createLayoutWatchKey() {
      return columns.value
        .map((column) =>
          [
            column.key,
            Array.isArray(column.dataIndex)
              ? column.dataIndex.join('.')
              : column.dataIndex,
            column.width,
            column.fixed,
          ]
            .map((value) => String(value ?? ''))
            .join(':'),
        )
        .join('|');
    }

    expose(registerApi);

    onMounted(() => {
      mounted.value = true;
      autoLoadData();
    });

    onBeforeUnmount(() => {
      stopRowResize();
    });

    watch(api, () => {
      if (mounted.value) {
        autoLoadData();
      }
    });

    watch(
      () => [
        createLayoutWatchKey(),
        rows.value.length,
        searchVisible.value,
        fullscreen.value,
        tableSize.value,
        hasSummary.value,
      ],
      () => {
        scheduleTableLayout();
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
                  controls: () => slots.headerControls?.(context),
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
                onRow={resolveRowProps}
                pagination={false}
                rowKey={props.rowKey}
                rowSelection={rowSelection.value}
                scroll={{ x: tableScrollX.value, y: tableScrollY.value }}
                size={tableSize.value}
                v-slots={{
                  bodyCell: ({ column, index, record }: any): VNodeChild => {
                    if (column.key === KT_TABLE_INDEX_COLUMN_KEY) {
                      const rowIndex = resolveRecordIndex(record, index);

                      if (!props.rowResizable) return rowIndex;

                      return (
                        <div class="kt-table__index-cell">
                          <span>{rowIndex}</span>
                          <span
                            aria-label="调整行高"
                            class="kt-table__row-resize-handle"
                            onMousedown={(event: MouseEvent) => {
                              startRowResize(event, record);
                            }}
                            role="separator"
                          />
                        </div>
                      );
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
