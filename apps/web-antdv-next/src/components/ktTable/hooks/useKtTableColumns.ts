import type { TableColumnType } from 'antdv-next';

import type { ComputedRef } from 'vue';

import type {
  KtTableRecord,
  KtTableResolvedProps,
  KtTableRowAction,
} from '../types';

import { computed, reactive, ref, watch } from 'vue';

import {
  KT_TABLE_ACTION_COLUMN_KEY,
  KT_TABLE_INDEX_COLUMN_KEY,
  KT_TABLE_ROW_ACTION_OVERFLOW_LIMIT,
} from '../config/constants';
import { getColumnKey } from '../utils/index';

interface UseKtTableColumnsOptions {
  props: KtTableResolvedProps;
  rowActions: ComputedRef<KtTableRowAction[]>;
  scheduleTableLayout: () => void;
}

/**
 * 管理 KtTable 的列顺序、列显隐、列宽拖拽和横向滚动宽度。
 *
 * @param options KtTable 列系统初始化参数。
 * @param options.props 表格最终合并后的配置。
 * @param options.rowActions 当前行操作按钮列表，用于决定是否追加操作列。
 * @param options.scheduleTableLayout 表格布局重算函数，用于列宽变更后同步滚动高度。
 */
export function useKtTableColumns(options: UseKtTableColumnsOptions) {
  const { props, rowActions, scheduleTableLayout } = options;
  // 列系统集中处理可见列、拖拽宽度和横向滚动宽度，避免主组件继续堆列计算细节。
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
  const visibleColumns = computed(() =>
    orderedSourceColumns.value
      .filter((column) =>
        visibleColumnKeys.value.includes(getColumnKey(column)),
      )
      .map((column) => normalizeColumnWidth(column)),
  );
  const indexColumn = computed<null | TableColumnType<KtTableRecord>>(() => {
    if (!props.showIndex) return null;

    return normalizeColumnWidth({
      className: 'kt-table__index-column',
      align: 'center',
      fixed: 'left',
      key: KT_TABLE_INDEX_COLUMN_KEY,
      minWidth: 40,
      title: '序号',
      width: 48,
    } as TableColumnType<KtTableRecord>);
  });
  const actionColumn = computed<null | TableColumnType<KtTableRecord>>(() => {
    if (rowActions.value.length === 0) return null;
    const actionColumnWidth = resolveActionColumnWidth(rowActions.value.length);

    return normalizeColumnWidth({
      className: 'kt-table__action-column',
      fixed: 'right',
      key: KT_TABLE_ACTION_COLUMN_KEY,
      minWidth: actionColumnWidth,
      title: '操作',
      width: actionColumnWidth,
    } as TableColumnType<KtTableRecord>);
  });
  const columns = computed(
    () =>
      [indexColumn.value, ...visibleColumns.value, actionColumn.value].filter(
        Boolean,
      ) as Array<TableColumnType<KtTableRecord>>,
  );
  const tableScrollX = computed(() =>
    Math.max(
      columns.value.reduce(
        (total, column) => total + readColumnWidth(column.width, 140),
        props.showSelection ? 48 : 0,
      ),
      720,
    ),
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
   * 重置列顺序和可见列到源码配置的初始状态。
   */
  function resetColumns() {
    const sourceKeys = sourceColumns.value
      .map((column) => getColumnKey(column))
      .filter(Boolean);
    columnOrderKeys.value = [...sourceKeys];
    visibleColumnKeys.value = [...sourceKeys];
  }

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
      return Number.isFinite(minWidth) ? Math.max(minWidth, 40) : 40;
    }
    if (getColumnKey(column) === KT_TABLE_ACTION_COLUMN_KEY) {
      return Number.isFinite(minWidth) ? Math.max(minWidth, 96) : 112;
    }

    return Number.isFinite(minWidth) ? Math.max(minWidth, 80) : 96;
  }

  /**
   * 根据行操作按钮数量计算操作列默认宽度。
   *
   * @param actionCount 当前可见行操作按钮数量。
   */
  function resolveActionColumnWidth(actionCount: number) {
    if (actionCount > KT_TABLE_ROW_ACTION_OVERFLOW_LIMIT) return 112;
    if (actionCount === KT_TABLE_ROW_ACTION_OVERFLOW_LIMIT) return 112;
    if (actionCount === 2) return 96;

    return 80;
  }

  /**
   * 为列注入可拖拽列宽配置并补齐默认 ellipsis。
   *
   * @param column 当前需要渲染的表格列配置。
   */
  function normalizeColumnWidth(column: TableColumnType<KtTableRecord>) {
    const key = getColumnKey(column);
    const width =
      key && columnWidths[key]
        ? columnWidths[key]
        : readColumnWidth(column.width, 160);
    const originalHeaderCell = column.onHeaderCell;
    const originalCell = column.onCell;
    const minWidth = getColumnMinWidth(column);
    const nextWidth = Math.max(width, minWidth);

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

        return {
          ...originalProps,
          /**
           * 响应表头拖拽列宽事件。
           *
           * @param event 鼠标拖拽事件。
           * @param info 拖拽组件返回的新尺寸信息。
           * @param info.size 拖拽后的尺寸对象。
           * @param info.size.width 拖拽后的列宽。
           */
          onResize: (event: MouseEvent, info: { size: { width: number } }) => {
            originalProps.onResize?.(event, info);
            resizeColumnWidth(column, info.size.width);
          },
          style: {
            ...(originalProps.style as Record<string, unknown>),
            minWidth: `${minWidth}px`,
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
