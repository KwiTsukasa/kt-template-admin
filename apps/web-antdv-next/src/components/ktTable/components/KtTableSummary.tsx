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

const renderStatisticValue = (
  item: KtTableStatistic,
  context: KtTableContext,
) => {
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
};

const renderCellContent = (
  context: KtTableContext,
  statistic: KtTableStatistic | undefined,
  showDefaultLabel: boolean,
): VNodeChild => {
  if (statistic) return renderStatisticValue(statistic, context);
  if (showDefaultLabel) {
    return <span class="kt-table__summary-title">本页统计</span>;
  }

  return null;
};

export const renderKtTableSummary = (options: RenderKtTableSummaryOptions) => {
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
};
