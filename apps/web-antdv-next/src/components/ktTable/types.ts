import type { TableColumnType } from 'antdv-next';

import type { VNodeChild } from 'vue';

import type {
  ExtendedFormApi,
  VbenFormProps,
  VbenFormSchema,
} from '@vben/common-ui';

export type KtTableRecord = Record<string, any>;

export type KtTableSize = 'large' | 'middle' | 'small';

export interface KtTableSetting {
  column?: boolean;
  density?: boolean;
  fullscreen?: boolean;
  reload?: boolean;
  showSearch?: boolean;
}

export type KtTableOperation = 'custom' | 'reload' | 'reset' | 'search';

export type KtTablePermissionChecker = (codes: string[]) => boolean;

export interface KtTableFormOptions extends Omit<
  VbenFormProps,
  'schema' | 'showDefaultActions'
> {
  formGrid?: Partial<KtTableFormGridOptions>;
  labelInInput?: boolean;
  schema?: KtTableFormSchema[];
}

export interface KtTableFormGridOptions {
  actionMinWidth: number;
  actionSpan: number;
  contentSpan: number;
  fieldSpan: number;
  rangeSpan: number;
  tabletColumns: number;
  totalSpan: number;
}

export type KtTableFormSchema = VbenFormSchema & {
  colProps?: {
    span?: number;
  };
  formGridSpan?: number;
};

export interface KtTablePageResult<Row extends KtTableRecord = KtTableRecord> {
  items?: Row[];
  list?: Row[];
  records?: Row[];
  total?: number;
}

export interface KtTableApi<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> {
  list: (
    params: KtTableRecord & SearchValues,
    context: KtTableContext<Row, SearchValues>,
  ) => Promise<KtTablePageResult<Row> | Row[]>;
}

export interface KtTableButton<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> {
  danger?: boolean;
  disabled?:
    | ((context: KtTableContext<Row, SearchValues>) => boolean)
    | boolean;
  icon?:
    | ((context: KtTableContext<Row, SearchValues>) => VNodeChild)
    | VNodeChild;
  key: string;
  label: string;
  loading?: boolean;
  onClick?: (
    context: KtTableContext<Row, SearchValues>,
  ) => Promise<void> | void;
  operation?: KtTableOperation;
  permissionCodes?: string[];
  placement?: 'form' | 'header';
  type?: 'dashed' | 'default' | 'link' | 'primary' | 'text';
  visible?: ((context: KtTableContext<Row, SearchValues>) => boolean) | boolean;
}

export interface KtTableRowAction<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> extends Omit<KtTableButton<Row, SearchValues>, 'disabled' | 'onClick'> {
  confirm?: ((row: Row) => string) | boolean;
  disabled?:
    | ((row: Row, context: KtTableContext<Row, SearchValues>) => boolean)
    | boolean;
  onClick?: (
    row: Row,
    context: KtTableContext<Row, SearchValues>,
  ) => Promise<void> | void;
}

export interface KtTableStatistic<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> {
  columnKey?: string;
  key: string;
  label?: string;
  render?: (context: KtTableContext<Row, SearchValues>) => VNodeChild;
  value?:
    | ((
        context: KtTableContext<Row, SearchValues>,
      ) => number | string | VNodeChild)
    | number
    | string;
}

export interface KtTableHook<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> {
  name: string;
  onAfterAction?: (
    action:
      | KtTableButton<Row, SearchValues>
      | KtTableRowAction<Row, SearchValues>,
    result: unknown,
    context: KtTableContext<Row, SearchValues>,
  ) => Promise<void> | void;
  onAfterFetch?: (
    result: KtTablePageResult<Row> | Row[],
    context: KtTableContext<Row, SearchValues>,
  ) => Promise<void> | void;
  onBeforeAction?: (
    action:
      | KtTableButton<Row, SearchValues>
      | KtTableRowAction<Row, SearchValues>,
    context: KtTableContext<Row, SearchValues>,
  ) => Promise<void> | void;
  onBeforeFetch?: (
    params: KtTableRecord,
    context: KtTableContext<Row, SearchValues>,
  ) => Promise<void> | void;
  onFetchError?: (
    error: unknown,
    context: KtTableContext<Row, SearchValues>,
  ) => Promise<void> | void;
}

export interface KtTableModule<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> {
  api?: KtTableApi<Row, SearchValues>;
  buttons?: Array<KtTableButton<Row, SearchValues>>;
  columns?: Array<TableColumnType<Row>>;
  formOptions?: KtTableFormOptions;
  hooks?: Array<KtTableHook<Row, SearchValues>>;
  name: string;
  rowActions?: Array<KtTableRowAction<Row, SearchValues>>;
  statistics?: Array<KtTableStatistic<Row, SearchValues>>;
}

export interface KtTableContext<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> {
  formApi: ExtendedFormApi;
  getRows: () => Row[];
  getSearchValues: () => Promise<SearchValues>;
  registerHook: (hook: KtTableHook<Row, SearchValues>) => () => void;
  reload: () => Promise<void>;
  reset: () => Promise<void>;
  search: () => Promise<void>;
  selectedRowKeys: () => Array<number | string>;
  selectedRows: () => Row[];
  setSearchValues: (values: Partial<SearchValues>) => Promise<void>;
  unregisterHook: (name: string) => void;
}

export type KtTableSetProps<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> = (
  props:
    | ((
        currentProps: KtTableResolvedProps<Row, SearchValues>,
      ) => Partial<KtTableProps<Row, SearchValues>>)
    | Partial<KtTableProps<Row, SearchValues>>,
) => void;

export interface KtTableRegisterApi<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> extends KtTableContext<Row, SearchValues> {
  getProps: () => KtTableResolvedProps<Row, SearchValues>;
  setProps: KtTableSetProps<Row, SearchValues>;
}

export type KtTableRegisterFn<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> = (api: KtTableRegisterApi<Row, SearchValues>) => void;

export interface KtTableProps<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> {
  api?: KtTableApi<Row, SearchValues>;
  afterFetch?: (
    result: KtTablePageResult<Row> | Row[],
    context: KtTableContext<Row, SearchValues>,
  ) => KtTablePageResult<Row> | Promise<KtTablePageResult<Row> | Row[]> | Row[];
  beforeFetch?: (
    params: KtTableRecord & SearchValues,
    context: KtTableContext<Row, SearchValues>,
  ) =>
    | (KtTableRecord & SearchValues)
    | Promise<KtTableRecord & SearchValues>
    | undefined;
  buttons?: Array<KtTableButton<Row, SearchValues>>;
  columns?: Array<TableColumnType<Row>>;
  dataSource?: Row[];
  formOptions?: KtTableFormOptions;
  hooks?: Array<KtTableHook<Row, SearchValues>>;
  immediate?: boolean;
  modules?: Array<KtTableModule<Row, SearchValues>>;
  pageSize?: number;
  pageSizeOptions?: string[];
  rowActions?: Array<KtTableRowAction<Row, SearchValues>>;
  rowActionVisibleCount?: number;
  rowResizeMaxHeight?: number;
  rowResizeMinHeight?: number;
  rowResizable?: boolean;
  rowKey?: ((row: Row) => string) | keyof Row | string;
  showDefaultButtons?: boolean;
  showFooter?: boolean;
  showHeader?: boolean;
  showIndex?: boolean;
  showPagination?: boolean;
  showSelection?: boolean;
  showTableSetting?: boolean;
  size?: KtTableSize;
  statistics?: Array<KtTableStatistic<Row, SearchValues>>;
  tableSettings?: KtTableSetting;
  tableTitle?: string;
}

export type KtTableResolvedProps<
  Row extends KtTableRecord = KtTableRecord,
  SearchValues extends KtTableRecord = KtTableRecord,
> = KtTableProps<Row, SearchValues> & {
  buttons: Array<KtTableButton<Row, SearchValues>>;
  columns: Array<TableColumnType<Row>>;
  hooks: Array<KtTableHook<Row, SearchValues>>;
  immediate: boolean;
  modules: Array<KtTableModule<Row, SearchValues>>;
  pageSize: number;
  pageSizeOptions: string[];
  rowActions: Array<KtTableRowAction<Row, SearchValues>>;
  rowActionVisibleCount: number;
  rowKey: ((row: Row) => string) | keyof Row | string;
  rowResizable: boolean;
  rowResizeMaxHeight: number;
  rowResizeMinHeight: number;
  showDefaultButtons: boolean;
  showFooter: boolean;
  showHeader: boolean;
  showIndex: boolean;
  showPagination: boolean;
  showSelection: boolean;
  showTableSetting: boolean;
  size: KtTableSize;
  statistics: Array<KtTableStatistic<Row, SearchValues>>;
  tableSettings: KtTableSetting;
};
