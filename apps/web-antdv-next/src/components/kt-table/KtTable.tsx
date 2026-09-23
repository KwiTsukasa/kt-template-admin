import type { VNodeChild } from 'vue';

import type {
  KtTableContext,
  KtTableProps,
  KtTableRecord,
  KtTableRegisterApi,
  KtTableScrollConfig,
  KtTableSize,
} from './types';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { ChevronDown } from '@vben/icons';

import { Alert, Button, Space, Table } from 'antdv-next';

import KtActionGroup from '../kt-action-group/KtActionGroup';
import KtTableFooter from './components/KtTableFooter';
import KtTableHeader from './components/KtTableHeader';
import KtTableResizableTitle from './components/KtTableResizableTitle';
import KtTableSearch from './components/KtTableSearch';
import KtTableSettings from './components/KtTableSettings';
import { renderKtTableSummary } from './components/KtTableSummary';
import {
  KT_TABLE_ACTION_COLUMN_KEY,
  KT_TABLE_ACTION_COLUMN_WIDTH,
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
import { isKtTableRowActionEvent, normalizePageResult } from './utils/index';

import './style.scss';

const AButton = Button as any;
const AAlert = Alert as any;
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
  resetForm?: boolean;
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
    const requestPagination = reactive({
      current: 1,
      pageSize: props.pageSize,
    });
    const loadError = ref('');
    const hasLoaded = ref(false);
    let requestGeneration = 0;
    let disposed = false;
    const fullscreen = ref(false);
    const searchCollapsed = ref(false);
    const searchVisible = ref(true);
    const tableSize = ref<KtTableSize>(props.size);
    const mounted = ref(false);
    const autoLoaded = ref(false);
    const rowHeights = reactive<Record<string, number>>({});
    const nativeTableRef = shallowRef<InstanceType<typeof Table> | null>(null);
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
      scrollTo,
      setProps,
    };

    /**
     * 将显式行定位交给已挂载的 Antdv Table，未挂载时忽略命令。
     * @param config - 原生表格支持的行键、序号或顶部位置配置。
     */
    function scrollTo(config: KtTableScrollConfig) {
      nativeTableRef.value?.scrollTo(config);
    }

    emit('register', registerApi);

    const permissions = useKtTablePermission(context);
    const {
      formButtons,
      getVisibleRowActions,
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
      tableVirtualScrollX,
      visibleColumnKeys,
    } = useKtTableColumns({
      props,
      rowActions,
      scheduleTableLayout,
      tableViewportWidth,
    });
    const nativeTableScroll = computed(() => {
      const y = tableScrollY.value;
      if (!props.virtual) {
        return { x: tableScrollX.value, y };
      }
      return { x: tableVirtualScrollX.value, y };
    });
    const tableEmptyText = computed(() => {
      if (loadError.value && !hasLoaded.value) return '加载失败，请重试';
      return '暂无数据';
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
        requestPagination.pageSize = pageSize;
        if (!hasLoaded.value || !api.value?.list)
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
     * @param index - 目标行或文件映射在当前数组中的零基索引。
     * @returns 跨分页连续计算的一基展示序号。
     */
    function resolveRowIndex(index: number) {
      if (!props.showPagination) return index + 1;

      return (pagination.current - 1) * pagination.pageSize + index + 1;
    }

    /**
     * 从 Antdv bodyCell 参数中解析当前行序号，兼容 slot 未透出 index 的情况。
     *
     * @param record - 未提供插槽索引时用于在当前页数据中定位位置的表格记录。
     * @param index - Antdv 插槽直接提供的当前页零基索引；省略时从记录定位。
     * @returns 按分页换算的一基展示序号；记录无法定位时按本页首行计算。
     */
    function resolveRecordIndex(record: KtTableRecord, index?: number) {
      const rowIndex = (() => {
        if (typeof index === 'number') {
          return index;
        }
        return rows.value.indexOf(record);
      })();

      return resolveRowIndex(Math.max(rowIndex, 0));
    }

    /**
     * 通过解析行唯一标识，行高 resize 需要用它保存每一行的独立高度。
     *
     * @param record - 要按 rowKey 配置解析稳定行键的表格记录。
     * @returns rowKey 解析出的稳定字符串；缺失时回退为记录序号。
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
     * @param height - 拖拽得到、尚未限制上下界的行高像素值。
     * @returns 限制在最小与最大配置之间的整数行高。
     */
    function clampRowHeight(height: number) {
      const minHeight = Math.max(24, props.rowResizeMinHeight);
      const maxHeight = Math.max(minHeight, props.rowResizeMaxHeight);

      return Math.min(maxHeight, Math.max(minHeight, Math.round(height)));
    }

    /**
     * 创建行高拖拽参考线，拖动期间只移动参考线并写当前行 DOM。
     *
     * @param rowElement - 鼠标所在的表格行元素，用于测量边界和放置拖拽参考线。
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
     * 从页面移除行高拖拽参考线，并清空保存的节点引用。
     */
    function removeRowResizeGuide() {
      rowResizeGuideElement?.remove();
      rowResizeGuideElement = null;
    }

    /**
     * 通过鼠标纵坐标与行底边距离判断是否命中行高拖拽热区。
     *
     * @param event - 用来判断鼠标是否落在序号列底部热区的事件坐标。
     * @param rowElement - 鼠标所在的表格行元素，用于测量边界和放置拖拽参考线。
     * @returns 鼠标位于序号列底部拖拽热区时为 true，否则为 false。
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
     * 拖拽行高时只直接写当前 tr 的内联高度，mouseup 后再写入响应式状态。 这样可以避免拖拽过程中每一帧触发表格整体重算。
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
     * 当行高拖拽移动时计算目标高度，并同步参考线与当前行内联样式。
     *
     * @param event - 拖动过程中提供最新纵坐标的全局鼠标事件。
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
     * 在命中行高热区后记录起点、目标行键与初始高度，并绑定全局拖拽事件。
     *
     * @param event - 命中行高拖拽热区的鼠标按下事件。
     * @param record - 要记录独立拖拽高度的目标表格行数据。
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
     * @param event - 表格行业务区域收到的鼠标按下事件。
     * @param record - 鼠标命中热区时传给行高拖拽流程的表格行数据。
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
     * 把业务行属性与选中状态、行高拖拽事件合并为 Antdv 行配置。
     *
     * @param record - 要合并业务属性、选中态、行高与点击事件的表格记录。
     * @returns 合并业务属性、选中 class 与行高拖拽事件的 Antdv 行属性。
     */
    function resolveRowProps(record: KtTableRecord) {
      const recordKey = String(resolveRecordKey(record));
      const classNames = [
        (() => {
          if (props.rowResizable) {
            return 'kt-table__row--resizable';
          }
          return '';
        })(),
        (() => {
          if (props.onRowClick) {
            return 'kt-table__row--clickable';
          }
          return '';
        })(),
        (() => {
          if (
            props.activeRowKey !== undefined &&
            String(props.activeRowKey) === recordKey
          ) {
            return 'kt-table__row--active';
          }
          return '';
        })(),
        resolveCustomRowClassName(record),
      ].filter(Boolean);
      const height = rowHeights[recordKey];
      const rowProps: KtTableRecord = {};

      if (classNames.length > 0) {
        rowProps.class = classNames.join(' ');
      }

      if (props.rowResizable) {
        rowProps.onMousedown = (event: MouseEvent) => {
          handleRowResizeMouseDown(event, record);
        };
        if (height) {
          rowProps.style = {
            '--kt-table-row-height': `${height}px`,
            height: `${height}px`,
          };
        } else {
          rowProps.style = undefined;
        }
      }

      if (props.onRowClick) {
        rowProps.onClick = (event: MouseEvent) => {
          if (isKtTableRowActionEvent(event)) return;
          props.onRowClick?.(record, context);
        };
      }

      return rowProps;
    }

    /**
     * 解析业务侧配置的静态或函数式行 class，未配置或函数返回空值时使用空字符串。
     *
     * @param record - 传给函数式行 class 配置的当前表格记录。
     * @returns 业务配置解析出的行 class；未配置时为空字符串。
     */
    function resolveCustomRowClassName(record: KtTableRecord) {
      if (!props.rowClassName) return '';
      if (typeof props.rowClassName === 'function') {
        return props.rowClassName(record, context) || '';
      }

      return props.rowClassName;
    }

    /**
     * 从参数准备起固定读取身份，成功时一起提交行、总量与展示分页。
     *
     * @param options - 控制本次读取是否重置或校验搜索表单；未传入时使用 `{}`。
     * @throws 当前请求失败时先运行 onFetchError 再传播错误；过期请求错误直接传播。
     */
    async function loadData(options: LoadOptions = {}) {
      if (disposed) return;
      const request = ++requestGeneration;
      const requestedPage = requestPagination.current;
      const requestedSize = requestPagination.pageSize;
      const requestedSortField = sortState.field;
      const requestedSortOrder = sortState.order;
      loadError.value = '';
      if (!api.value?.list) {
        const list = props.dataSource || [];
        rows.value = list;
        pagination.total = list.length;
        pagination.current = requestedPage;
        pagination.pageSize = requestedSize;
        hasLoaded.value = true;
        loading.value = false;
        return;
      }

      loading.value = true;
      try {
        if (options.resetForm) {
          await resetForm();
          if (request !== requestGeneration || disposed) return;
        }
        if (options.validateForm) {
          const { valid } = await formApi.validate();
          if (request !== requestGeneration || disposed) return;
          if (!valid) return;
        }
        const searchValues = await getSearchValues();
        if (request !== requestGeneration || disposed) return;
        let pageNo: number | undefined;
        let pageSize: number | undefined;
        if (props.showPagination) {
          pageNo = requestedPage;
          pageSize = requestedSize;
        }
        const rawParams = {
          ...searchValues,
          pageNo,
          pageSize,
          sortField: requestedSortField,
          sortOrder: requestedSortOrder,
        };
        const params =
          ((await props.beforeFetch?.(rawParams, context)) as KtTableRecord) ||
          rawParams;
        if (request !== requestGeneration || disposed) return;
        await runHook('onBeforeFetch', params, context);
        if (request !== requestGeneration || disposed) return;
        const result = await api.value.list(params, context);
        if (request !== requestGeneration || disposed) return;
        const afterResult =
          (await props.afterFetch?.(result, context)) || result;
        if (request !== requestGeneration || disposed) return;
        const normalized = normalizePageResult(afterResult);
        rows.value = normalized.list;
        pagination.total = normalized.total;
        pagination.current = requestedPage;
        pagination.pageSize = requestedSize;
        hasLoaded.value = true;
        clearSelection();
        if (request !== requestGeneration || disposed) return;
        await runHook('onAfterFetch', afterResult, context);
      } catch (error) {
        if (request === requestGeneration && !disposed) {
          loadError.value = '列表加载失败，请重试。';
          await runHook('onFetchError', error, context);
        }
        throw error;
      } finally {
        if (request === requestGeneration && !disposed) loading.value = false;
      }
    }

    /**
     * 在已注册接口且启用自动加载时只发起一次首次读取。
     */
    async function autoLoadData() {
      if (!props.immediate || autoLoaded.value || !api.value?.list) return;

      // register 模式下 api 可能晚于 mounted 合并，首次自动加载要等 api 真正可用。
      autoLoaded.value = true;
      await loadData();
    }

    /**
     * 将请求目标设为第一页并先校验表单，成功后才更新展示页。
     */
    async function search() {
      requestPagination.current = 1;
      await loadData({ validateForm: true });
    }

    /**
     * 重置查询表单并重新加载第一页数据。
     */
    async function reset() {
      requestPagination.current = 1;
      await loadData({ resetForm: true });
    }

    /**
     * 按最近一次请求意图重新加载，失败目标可由此重试。
     */
    async function reload() {
      await loadData();
    }

    /**
     * 在表格内部按钮事件边界消费加载拒绝，保留公开命令的原始 Promise 契约。
     */
    function retryLoad() {
      void reload().catch(() => undefined);
    }

    /**
     * 显示当前读取的失败状态与重试入口。
     * @returns 最近一次读取失败时的提示节点；无错误时返回空节点。
     */
    function renderLoadError() {
      if (!loadError.value) return null;
      return (
        <div class="kt-table__load-error">
          <AAlert
            action={<AButton onClick={retryLoad}>重试</AButton>}
            showIcon
            title={loadError.value}
            type="warning"
          />
        </div>
      );
    }

    /**
     * 从 Antdv Table 排序参数中读取当前排序字段和排序方向。
     *
     * @param sorter - Antdv Table 提供的单列或多列排序状态。
     */
    function readSorter(sorter: KtTableRecord | KtTableRecord[]) {
      const currentSorter = (() => {
        if (Array.isArray(sorter)) {
          return sorter[0];
        }
        return sorter;
      })();

      sortState.field = currentSorter?.field || currentSorter?.columnKey;
      sortState.order = currentSorter?.order;
    }

    /**
     * 当 Antdv Table 排序变化时请求第一页，成功后才更新展示页。
     *
     * @param _tablePagination - Antdv 传入的分页快照；KtTable 使用底部分页器维护页码，因此当前实现不读取它。
     * @param _filters - Antdv 传入的列筛选快照；KtTable 的筛选由搜索表单管理，因此当前实现不读取它。
     * @param sorter - Antdv Table 提供的单列或多列排序状态。
     */
    function handleTableChange(
      _tablePagination: KtTableRecord,
      _filters: KtTableRecord,
      sorter: KtTableRecord | KtTableRecord[],
    ) {
      requestPagination.current = 1;
      readSorter(sorter);
      void loadData().catch(() => undefined);
    }

    /**
     * 保存底部分页的请求目标，成功后再同步展示页码与页大小。
     *
     * @param pageInfo - 底部分页器提供的页码与每页数量。
     */
    function handlePageChange(pageInfo: KtTableRecord) {
      requestPagination.current = pageInfo.current || 1;
      requestPagination.pageSize = pageInfo.pageSize || props.pageSize;
      void loadData().catch(() => undefined);
    }

    const renderSearchArea = () => {
      const hasSearch = (formOptions.value.schema?.length || 0) > 0;
      const hasFormButtons = formButtons.value.length > 0;
      const hasCollapse =
        hasSearch && (formOptions.value.schema?.length || 0) > 4;
      if (!hasSearch) return null;

      return (
        <KtTableSearch
          collapsed={searchCollapsed.value}
          formGrid={formGrid.value}
          onTransitionEnd={handleSearchTransitionEnd}
          onTransitionStart={handleSearchTransitionStart}
          visible={searchVisible.value}
        >
          {{
            actions: () => {
              if (hasFormButtons || hasCollapse) {
                return (
                  <div class="kt-table__search-action-stack">
                    {formButtons.value.map((button) => renderButton(button))}
                    {(() => {
                      if (hasCollapse) {
                        return (
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
                                (() => {
                                  if (searchCollapsed.value) {
                                    return '';
                                  }
                                  return 'kt-table__search-toggle-icon--expanded';
                                })(),
                              ]}
                            />
                            {(() => {
                              if (searchCollapsed.value) {
                                return '展开';
                              }
                              return '收起';
                            })()}
                          </AButton>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              }
              return null;
            },
            form: () => <SearchForm />,
          }}
        </KtTableSearch>
      );
    };

    const renderActionCell = (record: KtTableRecord) => {
      const actions = getVisibleRowActions(record).map((action) => ({
        content: renderRowAction(action, record),
        key: action.key,
      }));

      return (
        <KtActionGroup
          class="kt-table__row-actions"
          items={actions}
          layout="compact"
          moreLabel="更多操作"
          visibleCount={resolveRowActionVisibleCount()}
        />
      );
    };

    /**
     * 将行操作直显数限制为非负整数，无效配置回退到共享默认值。
     *
     * @returns 行内直接展示的操作数；配置无效时使用共享默认值。
     */
    function resolveRowActionVisibleCount() {
      const visibleCount = Number(props.rowActionVisibleCount);

      if (!Number.isFinite(visibleCount)) {
        return KT_TABLE_ROW_ACTION_VISIBLE_COUNT;
      }

      return Math.max(0, Math.floor(visibleCount));
    }

    const renderHeaderButtons = () => {
      const toolbar = slots.toolbar?.(context);
      const buttons = headerButtons.value.map((button) => renderButton(button));

      if (!toolbar && buttons.length === 0) return null;

      return (
        <ASpace wrap>
          {{
            default: () => (
              <>
                {buttons}
                {toolbar}
              </>
            ),
          }}
        </ASpace>
      );
    };

    const renderHeaderSettings = () => {
      if (!props.showTableSetting) return null;
      const setting = { ...tableSetting.value };
      if ((formOptions.value.schema?.length || 0) === 0) {
        setting.showSearch = false;
      }

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
          onReload={retryLoad}
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
          setting={setting}
          size={tableSize.value}
          visibleColumnKeys={visibleColumnKeys.value}
        />
      );
    };

    /**
     * 生成表格布局监听签名，只收集会影响容器高度、横向滚动和列宽的轻量信号。 行内字段变化仍由 Vue/Antdv 正常渲染，不再触发布局重算，避免 deep watch 遍历整页数据。
     *
     * @returns 仅由容器尺寸、横向滚动和列宽信号组成的稳定监听字符串。
     */
    function createLayoutWatchKey() {
      return columns.value
        .map((column) =>
          [
            column.key,
            (() => {
              if (Array.isArray(column.dataIndex)) {
                return column.dataIndex.join('.');
              }
              return column.dataIndex;
            })(),
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
      void autoLoadData().catch(() => undefined);
    });

    onBeforeUnmount(() => {
      disposed = true;
      requestGeneration += 1;
      stopRowResize();
    });

    watch(api, () => {
      if (mounted.value) {
        void autoLoadData().catch(() => undefined);
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
      <div
        class={[
          'kt-table',
          (() => {
            if (fullscreen.value) {
              return 'kt-table--fullscreen';
            }
            return '';
          })(),
        ]}
        style={{
          '--kt-table-action-column-width': `${KT_TABLE_ACTION_COLUMN_WIDTH}px`,
        }}
      >
        <div class="kt-table__main">
          {renderSearchArea()}

          <div class="kt-table__main-content">
            {(() => {
              if (props.showHeader) {
                return (
                  <KtTableHeader title={props.tableTitle}>
                    {{
                      controls: () => slots.headerControls?.(context),
                      settings: renderHeaderSettings,
                      title: () => slots.title?.(),
                      toolbar: renderHeaderButtons,
                    }}
                  </KtTableHeader>
                );
              }
              return null;
            })()}

            {renderLoadError()}
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
                locale={{ emptyText: tableEmptyText.value }}
                onChange={handleTableChange}
                onRow={resolveRowProps}
                pagination={false}
                ref={nativeTableRef}
                rowKey={props.rowKey}
                rowSelection={rowSelection.value}
                scroll={nativeTableScroll.value}
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
                  summary: (): VNodeChild => {
                    if (hasSummary.value) {
                      return renderKtTableSummary({
                        columns: columns.value,
                        context,
                        customSummary: slots.summary?.({
                          columns: columns.value,
                          context,
                          rows: rows.value,
                        }),
                        showSelection: props.showSelection,
                        statistics: statistics.value,
                      });
                    }
                    return null;
                  },
                }}
                virtual={props.virtual}
              />
            </div>

            {(() => {
              if (props.showFooter) {
                return (
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
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    );
  },
});
