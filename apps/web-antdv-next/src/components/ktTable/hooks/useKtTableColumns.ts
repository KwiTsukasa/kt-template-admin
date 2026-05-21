import type { TableColumnType } from 'antdv-next';

import type { ComputedRef, Ref } from 'vue';

import type {
  KtTableRecord,
  KtTableResolvedProps,
  KtTableRowAction,
} from '../types';

import { computed, reactive, ref, watch } from 'vue';

import {
  KT_TABLE_ACTION_COLUMN_KEY,
  KT_TABLE_ACTION_COLUMN_WIDTH,
  KT_TABLE_INDEX_COLUMN_KEY,
  KT_TABLE_INDEX_COLUMN_WIDTH,
} from '../config/constants';
import { getColumnKey } from '../utils/index';

interface UseKtTableColumnsOptions {
  props: KtTableResolvedProps;
  rowActions: ComputedRef<KtTableRowAction[]>;
  scheduleTableLayout: () => void;
  tableViewportWidth: Ref<number>;
}

type ColumnResizeHandler = (
  event: MouseEvent,
  info: {
    size: {
      width: number;
    };
  },
) => void;

/**
 * 管理 KtTable 的列顺序、列显隐、列宽拖拽和横向滚动宽度。
 *
 * @param options KtTable 列系统初始化参数。
 * @param options.props 表格最终合并后的配置。
 * @param options.rowActions 当前行操作按钮列表，用于决定是否追加操作列。
 * @param options.scheduleTableLayout 表格布局重算函数，用于列宽变更后同步滚动高度。
 * @param options.tableViewportWidth 当前表格容器可视宽度，用于把宽屏剩余宽度分配给业务列。
 */
export function useKtTableColumns(options: UseKtTableColumnsOptions) {
  const { props, rowActions, scheduleTableLayout, tableViewportWidth } =
    options;
  // 列系统集中处理可见列、拖拽宽度和横向滚动启停，避免主组件继续堆列计算细节。
  const columnWidths = reactive<Record<string, number>>({});
  const columnOrderKeys = ref<string[]>([]);
  const visibleColumnKeys = ref<string[]>([]);

  const moduleColumns = computed(() =>
    props.modules.flatMap((module) => module.columns || []),
  );
  const sourceColumns = computed(() => [
    ...props.columns,
    ...moduleColumns.value,
  ]);
  const orderedSourceColumns = computed(() => {
    const columnMap = new Map(
      sourceColumns.value.map((column) => [getColumnKey(column), column]),
    );
    const orderedKeys = columnOrderKeys.value.filter((key) =>
      columnMap.has(key),
    );
    const restKeys = sourceColumns.value
      .map((column) => getColumnKey(column))
      .filter((key) => key && !orderedKeys.includes(key));

    return [...orderedKeys, ...restKeys]
      .map((key) => columnMap.get(key))
      .filter(Boolean) as Array<TableColumnType<KtTableRecord>>;
  });
  const visibleSourceColumns = computed(() =>
    orderedSourceColumns.value.filter((column) =>
      visibleColumnKeys.value.includes(getColumnKey(column)),
    ),
  );
  const rawTableWidth = computed(() => {
    const selectionWidth = props.showSelection ? 48 : 0;
    const indexWidth = props.showIndex ? KT_TABLE_INDEX_COLUMN_WIDTH : 0;
    const actionWidth =
      rowActions.value.length > 0 ? KT_TABLE_ACTION_COLUMN_WIDTH : 0;
    const businessWidth = visibleSourceColumns.value.reduce(
      (total, column) => total + getColumnRenderWidth(column),
      0,
    );

    return selectionWidth + indexWidth + businessWidth + actionWidth;
  });
  const tableRenderWidth = computed(() => {
    const hasFlexibleColumns = visibleSourceColumns.value.length > 0;

    if (!hasFlexibleColumns) {
      return rawTableWidth.value;
    }

    return Math.max(rawTableWidth.value, tableViewportWidth.value, 720);
  });
  const tableScrollX = computed(() => {
    const viewportWidth = tableViewportWidth.value;

    if (viewportWidth <= 0) return rawTableWidth.value;

    return rawTableWidth.value > viewportWidth + 1
      ? rawTableWidth.value
      : undefined;
  });
  const surplusWidthMap = computed(() =>
    createFlexibleSurplusMap(
      visibleSourceColumns.value,
      Math.max(0, tableRenderWidth.value - rawTableWidth.value),
    ),
  );
  const visibleColumns = computed(() =>
    visibleSourceColumns.value.map((column) =>
      normalizeColumnWidth(
        column,
        surplusWidthMap.value.get(getColumnKey(column)) || 0,
      ),
    ),
  );
  const indexColumn = computed<null | TableColumnType<KtTableRecord>>(() => {
    if (!props.showIndex) return null;

    return normalizeColumnWidth({
      className: 'kt-table__index-column',
      align: 'center',
      fixed: 'left',
      key: KT_TABLE_INDEX_COLUMN_KEY,
      minWidth: KT_TABLE_INDEX_COLUMN_WIDTH,
      title: '序号',
      width: KT_TABLE_INDEX_COLUMN_WIDTH,
    } as TableColumnType<KtTableRecord>);
  });
  const actionColumn = computed<null | TableColumnType<KtTableRecord>>(() => {
    if (rowActions.value.length === 0) return null;

    return normalizeColumnWidth({
      className: 'kt-table__action-column',
      fixed: 'right',
      key: KT_TABLE_ACTION_COLUMN_KEY,
      minWidth: KT_TABLE_ACTION_COLUMN_WIDTH,
      title: '操作',
      width: KT_TABLE_ACTION_COLUMN_WIDTH,
    } as TableColumnType<KtTableRecord>);
  });
  const columns = computed(
    () =>
      [indexColumn.value, ...visibleColumns.value, actionColumn.value].filter(
        Boolean,
      ) as Array<TableColumnType<KtTableRecord>>,
  );
  watch(
    sourceColumns,
    (nextColumns) => {
      const nextKeys = nextColumns
        .map((column) => getColumnKey(column))
        .filter(Boolean);
      const current = visibleColumnKeys.value.filter((key) =>
        nextKeys.includes(key),
      );
      const merged = [...new Set([...current, ...nextKeys])];
      visibleColumnKeys.value = merged;
      columnOrderKeys.value = mergeColumnOrderKeys(nextKeys);
    },
    {
      immediate: true,
    },
  );

  /**
   * 将现有列顺序和最新源码列 key 合并，保留用户排序并追加新增列。
   *
   * @param sourceKeys 当前源码列配置中的全部列 key。
   */
  function mergeColumnOrderKeys(sourceKeys: string[]) {
    const current = columnOrderKeys.value.filter((key) =>
      sourceKeys.includes(key),
    );

    return [...current, ...sourceKeys.filter((key) => !current.includes(key))];
  }

  /**
   * 根据列设置面板拖拽后的 key 顺序更新表格列顺序。
   *
   * @param keys 列设置面板传入的新列 key 顺序。
   */
  function reorderColumns(keys: string[]) {
    const sourceKeys = sourceColumns.value
      .map((column) => getColumnKey(column))
      .filter(Boolean);
    const nextKeys = keys.filter((key) => sourceKeys.includes(key));

    columnOrderKeys.value = [
      ...nextKeys,
      ...sourceKeys.filter((key) => !nextKeys.includes(key)),
    ];
  }

  /**
   * 清空所有业务列拖拽宽度，让列宽回到源码默认配置。
   */
  function resetColumnWidths() {
    Object.keys(columnWidths).forEach((key) => {
      Reflect.deleteProperty(columnWidths, key);
    });
  }

  /**
   * 重置列顺序、可见列和拖拽列宽到源码配置的初始状态。
   */
  function resetColumns() {
    const sourceKeys = sourceColumns.value
      .map((column) => getColumnKey(column))
      .filter(Boolean);
    columnOrderKeys.value = [...sourceKeys];
    visibleColumnKeys.value = [...sourceKeys];
    resetColumnWidths();
    scheduleTableLayout();
  }

  /**
   * 将列宽配置解析成数字宽度。
   *
   * @param width Antdv 列配置中的 width，可能是数字、字符串或空值。
   * @param fallback 无法解析 width 时使用的默认宽度。
   */
  function readColumnWidth(
    width: TableColumnType<KtTableRecord>['width'],
    fallback = 160,
  ) {
    if (typeof width === 'number') return width;
    if (typeof width === 'string') {
      const parsed = Number.parseInt(width, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
  }

  /**
   * 读取列最小宽度，保证拖拽后不会小于可用显示宽度。
   *
   * @param column 当前表格列配置。
   */
  function getColumnMinWidth(column: TableColumnType<KtTableRecord>) {
    const minWidth = Number((column as any).minWidth || 96);
    if (getColumnKey(column) === KT_TABLE_INDEX_COLUMN_KEY) {
      return Number.isFinite(minWidth)
        ? Math.max(minWidth, KT_TABLE_INDEX_COLUMN_WIDTH)
        : KT_TABLE_INDEX_COLUMN_WIDTH;
    }
    if (getColumnKey(column) === KT_TABLE_ACTION_COLUMN_KEY) {
      return Number.isFinite(minWidth)
        ? Math.max(minWidth, KT_TABLE_ACTION_COLUMN_WIDTH)
        : KT_TABLE_ACTION_COLUMN_WIDTH;
    }

    return Number.isFinite(minWidth) ? Math.max(minWidth, 80) : 96;
  }

  /**
   * 读取列当前渲染宽度，业务列会叠加宽屏剩余宽度，系统列保持固定宽度。
   *
   * @param column 当前表格列配置。
   * @param extraWidth 宽屏下分配给当前业务列的额外宽度。
   */
  function getColumnRenderWidth(
    column: TableColumnType<KtTableRecord>,
    extraWidth = 0,
  ) {
    const key = getColumnKey(column);
    const width =
      key && columnWidths[key]
        ? columnWidths[key]
        : readColumnWidth(column.width, 160);
    const minWidth = getColumnMinWidth(column);

    return Math.max(width + extraWidth, minWidth);
  }

  /**
   * 把宽屏下 Antdv 可能平均分配的剩余宽度提前分摊给业务列，避免系统列被撑大。
   * 这里的剩余宽度只影响业务列渲染，不直接开启 scroll.x，避免宽屏下常驻横向滚动条。
   *
   * @param sourceColumns 当前可见业务列。
   * @param surplusWidth 表格容器剩余宽度。
   */
  function createFlexibleSurplusMap(
    sourceColumns: Array<TableColumnType<KtTableRecord>>,
    surplusWidth: number,
  ) {
    const map = new Map<string, number>();
    if (surplusWidth <= 0) return map;

    const entries = sourceColumns
      .map((column) => ({
        key: getColumnKey(column),
        width: getColumnRenderWidth(column),
      }))
      .filter(
        (entry): entry is { key: string; width: number } =>
          !!entry.key && !isFixedSystemColumn(entry.key),
      );
    const totalWidth = entries.reduce((total, entry) => total + entry.width, 0);
    if (totalWidth <= 0) return map;

    entries.forEach((entry) => {
      map.set(entry.key, (surplusWidth * entry.width) / totalWidth);
    });

    return map;
  }

  /**
   * 判断当前列是否为 KtTable 内置系统列。
   *
   * @param key 当前列的唯一 key。
   */
  function isFixedSystemColumn(key?: string) {
    return (
      key === KT_TABLE_INDEX_COLUMN_KEY || key === KT_TABLE_ACTION_COLUMN_KEY
    );
  }

  /**
   * 创建业务列列宽拖拽处理器，系统列固定宽度所以不返回处理器。
   *
   * @param column 当前需要绑定拖拽行为的列配置。
   * @param originalResize 业务侧原始表头 resize 回调。
   */
  function createColumnResizeHandler(
    column: TableColumnType<KtTableRecord>,
    originalResize?: ColumnResizeHandler,
  ) {
    if (isFixedSystemColumn(getColumnKey(column))) return undefined;

    return (event: MouseEvent, info: Parameters<ColumnResizeHandler>[1]) => {
      originalResize?.(event, info);
      resizeColumnWidth(column, info.size.width);
    };
  }

  /**
   * 为列注入可拖拽列宽配置并补齐默认 ellipsis。
   *
   * @param column 当前需要渲染的表格列配置。
   * @param extraWidth 宽屏下分配给当前业务列的额外宽度。
   */
  function normalizeColumnWidth(
    column: TableColumnType<KtTableRecord>,
    extraWidth = 0,
  ) {
    const key = getColumnKey(column);
    const originalHeaderCell = column.onHeaderCell;
    const originalCell = column.onCell;
    const minWidth = getColumnMinWidth(column);
    const nextWidth = getColumnRenderWidth(column, extraWidth);
    const isSystemColumn = isFixedSystemColumn(key);
    const fixedWidthStyle = isSystemColumn
      ? {
          maxWidth: `${nextWidth}px`,
          minWidth: `${nextWidth}px`,
          width: `${nextWidth}px`,
        }
      : undefined;

    return {
      ...column,
      ellipsis: column.ellipsis ?? true,
      /**
       * 合并业务侧 header cell 配置和 KtTable 列宽拖拽配置。
       *
       * @param targetColumn Antdv 传入的当前表头列配置。
       */
      onHeaderCell: (targetColumn: TableColumnType<KtTableRecord>) => {
        const originalProps = (originalHeaderCell?.(targetColumn) ||
          {}) as Record<string, any>;
        const resizeHandler = createColumnResizeHandler(
          column,
          originalProps.onResize,
        );

        return {
          ...originalProps,
          onResize: resizeHandler,
          style: {
            ...(originalProps.style as Record<string, unknown>),
            minWidth: `${minWidth}px`,
            ...fixedWidthStyle,
          },
          width: nextWidth,
        };
      },
      /**
       * 合并业务侧 body cell 配置和 KtTable 列最小宽度配置。
       *
       * @param record 当前行数据。
       * @param index 当前行在本页的下标。
       */
      onCell: (record: KtTableRecord, index?: number) => {
        const originalProps = (originalCell?.(record, index) || {}) as Record<
          string,
          any
        >;

        return {
          ...originalProps,
          style: {
            ...(originalProps.style as Record<string, unknown>),
            minWidth: `${minWidth}px`,
            ...fixedWidthStyle,
          },
        };
      },
      width: nextWidth,
    } as TableColumnType<KtTableRecord>;
  }

  /**
   * 保存列拖拽后的宽度并触发表格布局重算。
   *
   * @param column 当前被拖拽调整宽度的列配置。
   * @param width 拖拽后计算出的目标宽度。
   */
  function resizeColumnWidth(
    column: TableColumnType<KtTableRecord>,
    width: number,
  ) {
    const key = getColumnKey(column);
    if (
      !key ||
      key === KT_TABLE_ACTION_COLUMN_KEY ||
      key === KT_TABLE_INDEX_COLUMN_KEY
    ) {
      return;
    }

    const minWidth = getColumnMinWidth(column);
    columnWidths[key] = Math.max(minWidth, Math.round(width));
    scheduleTableLayout();
  }

  return {
    columnOrderKeys,
    columns,
    reorderColumns,
    resetColumns,
    sourceColumns,
    tableScrollX,
    visibleColumnKeys,
  };
}
