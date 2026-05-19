import type { TableColumnType } from 'antdv-next';

import type { VNodeChild } from 'vue';

import type { KtTableContext, KtTableRecord, KtTableStatistic } from '../types';

import { TableSummary, TableSummaryCell, TableSummaryRow } from 'antdv-next';

import {
  KT_TABLE_ACTION_COLUMN_KEY,
  KT_TABLE_INDEX_COLUMN_KEY,
} from '../config/constants';
import { getColumnKey } from '../utils/index';

const ATableSummary = TableSummary as any;
const ATableSummaryCell = TableSummaryCell as any;
const ATableSummaryRow = TableSummaryRow as any;

type RenderKtTableSummaryOptions = {
  columns: Array<TableColumnType<KtTableRecord>>;
  context: KtTableContext;
  customSummary?: VNodeChild;
  showSelection: boolean;
  statistics: KtTableStatistic[];
};

/**
 * 渲染单个统计项内容。
 *
 * @param item 当前统计项配置。
 * @param context KtTable 运行时上下文，用于统计项读取行数据、搜索值和选择状态。
 */
function renderStatisticValue(item: KtTableStatistic, context: KtTableContext) {
  const value =
    item.render?.(context) ??
    (typeof item.value === 'function' ? item.value(context) : item.value);

  return (
    <span class="kt-table__summary-value">
      {item.label ? (
        <span class="kt-table__summary-label">{item.label}:</span>
      ) : null}
      <span>{value}</span>
    </span>
  );
}

/**
 * 渲染 summary 单元格内容。
 *
 * @param context KtTable 运行时上下文。
 * @param statistic 当前列匹配到的统计项配置。
 * @param showDefaultLabel 当前单元格是否需要显示默认“本页统计”文案。
 */
function renderCellContent(
  context: KtTableContext,
  statistic: KtTableStatistic | undefined,
  showDefaultLabel: boolean,
): VNodeChild {
  if (statistic) return renderStatisticValue(statistic, context);
  if (showDefaultLabel) {
    return <span class="kt-table__summary-title">本页统计</span>;
  }

  return null;
}

/**
 * 渲染 KtTable 底部固定 summary 行。
 *
 * @param options summary 渲染参数。
 * @param options.columns 当前最终展示的表格列。
 * @param options.context KtTable 运行时上下文。
 * @param options.customSummary 业务侧传入的自定义 summary 插槽。
 * @param options.showSelection 当前表格是否启用选择列。
 * @param options.statistics 当前表格和模块提供的统计项列表。
 */
export function renderKtTableSummary(options: RenderKtTableSummaryOptions) {
  const { columns, context, customSummary, showSelection, statistics } =
    options;
  if (statistics.length === 0) return customSummary;

  // summary slot 必须直接返回 TableSummary，Antdv 才会启用 fixed="bottom" 固定层。
  const statisticMap = new Map(
    statistics
      .filter((item) => !!item.columnKey)
      .map((item) => [item.columnKey, item]),
  );
  const selectionOffset = showSelection ? 1 : 0;
  const defaultLabelColumnKey = columns
    .map((column) => getColumnKey(column))
    .find(
      (key) =>
        key &&
        key !== KT_TABLE_INDEX_COLUMN_KEY &&
        key !== KT_TABLE_ACTION_COLUMN_KEY,
    );

  return (
    <ATableSummary fixed="bottom">
      <ATableSummaryRow>
        {showSelection ? <ATableSummaryCell index={0} /> : null}
        {columns.map((column, index) => {
          const columnKey = getColumnKey(column);
          const statistic = statisticMap.get(columnKey);
          const showDefaultLabel =
            columnKey === defaultLabelColumnKey && !statistic;

          return (
            <ATableSummaryCell
              index={index + selectionOffset}
              key={columnKey || index}
            >
              {renderCellContent(context, statistic, showDefaultLabel)}
            </ATableSummaryCell>
          );
        })}
      </ATableSummaryRow>
    </ATableSummary>
  );
}
