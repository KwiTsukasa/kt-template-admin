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
type ColumnWidthEntry = {
  column: TableColumnType<KtTableRecord>;
  key: string;
  width: number;
};

/**
 * 通过响应式列状态统一管理顺序、显隐、拖拽宽度与横向滚动宽度。
 *
 * @param options - 源码列、容器宽度、显隐状态和布局刷新依赖。
 * @returns 解析后的列、横向滚动宽度及列顺序、显隐和 resize 方法。
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
    const selectionWidth = (() => {
      if (props.showSelection) {
        return 48;
      }
      return 0;
    })();
    const indexWidth = (() => {
      if (props.showIndex) {
        return KT_TABLE_INDEX_COLUMN_WIDTH;
      }
      return 0;
    })();
    const actionWidth = (() => {
      if (rowActions.value.length > 0) {
        return KT_TABLE_ACTION_COLUMN_WIDTH;
      }
      return 0;
    })();
    const businessWidth = visibleSourceColumns.value.reduce(
      (total, column) => total + getColumnRenderWidth(column),
      0,
    );

    return selectionWidth + indexWidth + businessWidth + actionWidth;
  });
  const tableRenderWidth = computed(() => {
    const hasFlexibleColumns = visibleSourceColumns.value.length > 0;
    const viewportWidth = tableViewportWidth.value;

    if (!hasFlexibleColumns) {
      return rawTableWidth.value;
    }

    return Math.max(rawTableWidth.value, Math.max(viewportWidth, 0));
  });
  const tableScrollX = computed(() => {
    const viewportWidth = tableViewportWidth.value;

    if (viewportWidth <= 0) return rawTableWidth.value;

    if (rawTableWidth.value > viewportWidth + 1) {
      return rawTableWidth.value;
    }
    return undefined;
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
   * @param sourceKeys - 用户已保存的列顺序键；源码新增列会追加到它之后。
   * @returns 保留已有顺序并追加源码新列后的完整列键数组。
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
   * @param keys - 列设置面板拖拽完成后的完整列键顺序。
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
   * 将所有业务列拖拽宽度，让列宽回到源码默认配置。
   */
  function resetColumnWidths() {
    Object.keys(columnWidths).forEach((key) => {
      Reflect.deleteProperty(columnWidths, key);
    });
  }

  /**
   * 将列顺序、显隐与拖拽宽度同时恢复为源码初始配置。
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
   * @param width - 列配置值或拖拽得到的目标列宽像素数。
   * @param fallback - 列宽缺失或无法解析时采用的像素值；未传入时使用 `160`。
   * @returns 可用的数值列宽；非数字配置回退为 fallback。
   */
  function readColumnWidth(
    width: TableColumnType<KtTableRecord>['width'],
    fallback = 160,
  ) {
    if (typeof width === 'number') return width;
    if (typeof width === 'string') {
      const parsed = Number.parseInt(width, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
      return fallback;
    }

    return fallback;
  }

  /**
   * 根据列声明与系统列类型计算拖拽下限，索引列、操作列和业务列分别受各自最小宽度约束。
   *
   * @param column - 要读取最小宽度声明并应用系统列下限的列配置。
   * @returns 不小于对应系统下限的列宽；声明无效时索引列、操作列与业务列分别回退到预设宽度。
   */
  function getColumnMinWidth(column: TableColumnType<KtTableRecord>) {
    const minWidth = Number((column as any).minWidth || 96);
    if (getColumnKey(column) === KT_TABLE_INDEX_COLUMN_KEY) {
      if (Number.isFinite(minWidth)) {
        return Math.max(minWidth, KT_TABLE_INDEX_COLUMN_WIDTH);
      }
      return KT_TABLE_INDEX_COLUMN_WIDTH;
    }
    if (getColumnKey(column) === KT_TABLE_ACTION_COLUMN_KEY) {
      if (Number.isFinite(minWidth)) {
        return Math.max(minWidth, KT_TABLE_ACTION_COLUMN_WIDTH);
      }
      return KT_TABLE_ACTION_COLUMN_WIDTH;
    }

    if (Number.isFinite(minWidth)) {
      return Math.max(minWidth, 80);
    }
    return 96;
  }

  /**
   * 读取列当前渲染宽度，业务列会叠加宽屏剩余宽度，系统列保持固定宽度。
   *
   * @param column - 要结合拖拽状态、源码宽度与弹性余量计算渲染宽度的列配置。
   * @param extraWidth - 宽屏剩余空间分配给该业务列的附加像素数；未传入时使用 `0`。
   * @returns 拖拽宽度或源码宽度加弹性剩余量后的渲染宽度。
   */
  function getColumnRenderWidth(
    column: TableColumnType<KtTableRecord>,
    extraWidth = 0,
  ) {
    const key = getColumnKey(column);
    const width = (() => {
      if (key && columnWidths[key]) {
        return columnWidths[key];
      }
      return readColumnWidth(column.width, 160);
    })();
    const minWidth = getColumnMinWidth(column);

    return Math.max(width + extraWidth, minWidth);
  }

  /**
   * 把宽屏下 Antdv 可能平均分配的剩余宽度提前分摊给业务列，避免系统列被撑大。 这里的剩余宽度只影响业务列渲染，不直接开启 scroll.x，避免宽屏下常驻横向滚动条。
   *
   * @param sourceColumns - 需要分配宽屏剩余宽度的可见 KtTable 列。
   * @param surplusWidth - 宽屏容器相对列总宽度多出的像素数。
   * @returns 以列键为键的宽屏附加宽度映射；无剩余空间时为空 Map。
   */
  function createFlexibleSurplusMap(
    sourceColumns: Array<TableColumnType<KtTableRecord>>,
    surplusWidth: number,
  ) {
    const map = new Map<string, number>();
    if (surplusWidth <= 0) return map;

    const dataColumnEntries: ColumnWidthEntry[] = [];
    for (const column of sourceColumns) {
      const key = getColumnKey(column);
      if (!key || isFixedSystemColumn(key)) continue;

      dataColumnEntries.push({
        column,
        key,
        width: getColumnRenderWidth(column),
      });
    }
    const flexibleEntries = dataColumnEntries.filter(
      (entry) => !hasExplicitColumnWidth(entry.column),
    );
    const entries = (() => {
      if (flexibleEntries.length > 0) {
        return flexibleEntries;
      }
      return dataColumnEntries;
    })();
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
   * @param key - 待判断的列键；空值按非系统列处理。
   * @returns 列属于序号、选择或操作系统列时为 true。
   */
  function isFixedSystemColumn(key?: string) {
    return (
      key === KT_TABLE_INDEX_COLUMN_KEY || key === KT_TABLE_ACTION_COLUMN_KEY
    );
  }

  /**
   * 判断业务列是否显式声明了宽度。显式宽度代表业务侧希望该列保持稳定， 宽屏剩余空间优先留给未声明宽度的弹性列。
   *
   * @param column - 要检查是否声明有效 width 的业务列配置。
   * @returns 业务列显式声明有效宽度时为 true，否则为 false。
   */
  function hasExplicitColumnWidth(column: TableColumnType<KtTableRecord>) {
    const { width } = column;

    return width !== undefined && width !== null && width !== '';
  }

  /**
   * 为业务列创建保存宽度并转发原回调的处理器；系统列返回 undefined。
   *
   * @param column - 要保存拖拽宽度的业务列；系统列不会创建处理器。
   * @param originalResize - 业务列原有的 resize 回调；成功保存列宽后继续调用。
   * @returns 保存新宽度并转发原回调的处理器；系统列为 undefined。
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
   * @param column - 要补齐渲染宽度、最小宽度、省略与 resize 回调的列配置。
   * @param extraWidth - 宽屏剩余空间分配给该业务列的附加像素数；未传入时使用 `0`。
   * @returns 补齐渲染宽度、最小宽度、ellipsis 与 resize 回调的列配置。
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
    const fixedWidthStyle = (() => {
      if (isSystemColumn) {
        return {
          maxWidth: `${nextWidth}px`,
          minWidth: `${nextWidth}px`,
          width: `${nextWidth}px`,
        };
      }
      return undefined;
    })();

    return {
      ...column,
      ellipsis: column.ellipsis ?? true,
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
   * 将拖拽后的业务列宽写入状态，并触发表格布局重算。
   *
   * @param column - 要写入最新拖拽宽度的业务列配置。
   * @param width - 列配置值或拖拽得到的目标列宽像素数。
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
