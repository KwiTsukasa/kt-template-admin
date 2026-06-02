import type { KtTableFormGridOptions } from '../types';

export const KT_TABLE_ACTION_COLUMN_KEY = '__kt_table_actions__';

export const KT_TABLE_ACTION_COLUMN_WIDTH = 112;

export const KT_TABLE_INDEX_COLUMN_KEY = '__kt_table_index__';

export const KT_TABLE_INDEX_COLUMN_WIDTH = 40;

export const KT_TABLE_DEFAULT_ROW_RESIZE_MAX_HEIGHT = 140;

export const KT_TABLE_DEFAULT_ROW_RESIZE_MIN_HEIGHT = 40;

export const KT_TABLE_ROW_ACTION_VISIBLE_COUNT = 1;

export const KT_TABLE_DEFAULT_PAGE_SIZE = 10;

export const KT_TABLE_DEFAULT_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

export const KT_TABLE_DEFAULT_FORM_GRID: KtTableFormGridOptions = {
  actionMinWidth: 180,
  actionSpan: 6,
  contentSpan: 18,
  fieldSpan: 4,
  rangeSpan: 6,
  tabletColumns: 2,
  totalSpan: 24,
};
