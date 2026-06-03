import type { TableColumnType } from 'antdv-next';

import type { PropType } from 'vue';

import type {
  KtTableButton,
  KtTableFormOptions,
  KtTableHook,
  KtTableModule,
  KtTableProps,
  KtTableRecord,
  KtTableResolvedProps,
  KtTableRowAction,
  KtTableSetting,
  KtTableSize,
  KtTableStatistic,
} from '../types';

import {
  KT_TABLE_DEFAULT_PAGE_SIZE,
  KT_TABLE_DEFAULT_PAGE_SIZE_OPTIONS,
  KT_TABLE_DEFAULT_ROW_RESIZE_MAX_HEIGHT,
  KT_TABLE_DEFAULT_ROW_RESIZE_MIN_HEIGHT,
  KT_TABLE_ROW_ACTION_VISIBLE_COUNT,
} from './constants';

export const DEFAULT_TABLE_SETTING: Required<KtTableSetting> = {
  column: true,
  density: true,
  fullscreen: true,
  reload: true,
  showSearch: true,
};

export const KT_TABLE_PROP_KEYS = [
  'afterFetch',
  'api',
  'activeRowKey',
  'beforeFetch',
  'buttons',
  'columns',
  'dataSource',
  'formOptions',
  'hooks',
  'immediate',
  'modules',
  'onRowClick',
  'pageSize',
  'pageSizeOptions',
  'rowActions',
  'rowActionVisibleCount',
  'rowClassName',
  'rowResizeMaxHeight',
  'rowResizeMinHeight',
  'rowResizable',
  'rowKey',
  'showDefaultButtons',
  'showFooter',
  'showHeader',
  'showIndex',
  'showPagination',
  'showSelection',
  'showTableSetting',
  'size',
  'statistics',
  'tableSettings',
  'tableTitle',
] as const satisfies ReadonlyArray<keyof KtTableProps>;

/**
 * 创建 KtTable 默认 props，供组件初始化和 register 配置合并时复用。
 */
export function createDefaultTableProps(): KtTableResolvedProps<
  KtTableRecord,
  KtTableRecord
> {
  return {
    afterFetch: undefined,
    api: undefined,
    activeRowKey: undefined,
    beforeFetch: undefined,
    buttons: [],
    columns: [],
    dataSource: undefined,
    formOptions: undefined,
    hooks: [],
    immediate: true,
    modules: [],
    onRowClick: undefined,
    pageSize: KT_TABLE_DEFAULT_PAGE_SIZE,
    pageSizeOptions: KT_TABLE_DEFAULT_PAGE_SIZE_OPTIONS,
    rowActions: [],
    rowActionVisibleCount: KT_TABLE_ROW_ACTION_VISIBLE_COUNT,
    rowClassName: undefined,
    rowResizeMaxHeight: KT_TABLE_DEFAULT_ROW_RESIZE_MAX_HEIGHT,
    rowResizeMinHeight: KT_TABLE_DEFAULT_ROW_RESIZE_MIN_HEIGHT,
    rowResizable: false,
    rowKey: 'id',
    showDefaultButtons: true,
    showFooter: true,
    showHeader: true,
    showIndex: true,
    showPagination: true,
    showSelection: false,
    showTableSetting: true,
    size: 'small',
    statistics: [],
    tableSettings: {},
    tableTitle: undefined,
  };
}

export const ktTableProps = {
  afterFetch: {
    default: undefined,
    type: Function as PropType<KtTableProps['afterFetch']>,
  },
  activeRowKey: {
    default: undefined,
    type: [Number, String] as PropType<KtTableProps['activeRowKey']>,
  },
  api: {
    default: undefined,
    type: Object as PropType<KtTableModule['api']>,
  },
  beforeFetch: {
    default: undefined,
    type: Function as PropType<KtTableProps['beforeFetch']>,
  },
  buttons: {
    default: () => [],
    type: Array as PropType<KtTableButton[]>,
  },
  columns: {
    default: () => [],
    type: Array as PropType<Array<TableColumnType<KtTableRecord>>>,
  },
  dataSource: {
    default: undefined,
    type: Array as PropType<KtTableRecord[]>,
  },
  formOptions: {
    default: undefined,
    type: Object as PropType<KtTableFormOptions>,
  },
  hooks: {
    default: () => [],
    type: Array as PropType<KtTableHook[]>,
  },
  immediate: {
    default: true,
    type: Boolean,
  },
  modules: {
    default: () => [],
    type: Array as PropType<KtTableModule[]>,
  },
  onRowClick: {
    default: undefined,
    type: Function as PropType<KtTableProps['onRowClick']>,
  },
  pageSize: {
    default: KT_TABLE_DEFAULT_PAGE_SIZE,
    type: Number,
  },
  pageSizeOptions: {
    default: () => KT_TABLE_DEFAULT_PAGE_SIZE_OPTIONS,
    type: Array as PropType<string[]>,
  },
  rowActions: {
    default: () => [],
    type: Array as PropType<KtTableRowAction[]>,
  },
  rowActionVisibleCount: {
    default: KT_TABLE_ROW_ACTION_VISIBLE_COUNT,
    type: Number,
  },
  rowClassName: {
    default: undefined,
    type: [Function, String] as PropType<KtTableProps['rowClassName']>,
  },
  rowResizeMaxHeight: {
    default: KT_TABLE_DEFAULT_ROW_RESIZE_MAX_HEIGHT,
    type: Number,
  },
  rowResizeMinHeight: {
    default: KT_TABLE_DEFAULT_ROW_RESIZE_MIN_HEIGHT,
    type: Number,
  },
  rowResizable: {
    default: false,
    type: Boolean,
  },
  rowKey: {
    default: 'id',
    type: [String, Function] as PropType<
      ((row: KtTableRecord) => string) | string
    >,
  },
  showDefaultButtons: {
    default: true,
    type: Boolean,
  },
  showFooter: {
    default: true,
    type: Boolean,
  },
  showHeader: {
    default: true,
    type: Boolean,
  },
  showIndex: {
    default: true,
    type: Boolean,
  },
  showPagination: {
    default: true,
    type: Boolean,
  },
  showSelection: {
    default: false,
    type: Boolean,
  },
  showTableSetting: {
    default: true,
    type: Boolean,
  },
  size: {
    default: 'small',
    type: String as PropType<KtTableSize>,
  },
  statistics: {
    default: () => [],
    type: Array as PropType<KtTableStatistic[]>,
  },
  tableSettings: {
    default: () => ({}),
    type: Object as PropType<KtTableSetting>,
  },
  tableTitle: {
    default: undefined,
    type: String,
  },
};
