import type { TableColumnType } from 'antdv-next';

import type {
  KtTableFormGridOptions,
  KtTableFormOptions,
  KtTableFormSchema,
  KtTablePageResult,
  KtTableRecord,
} from '../types';

import type { VbenFormProps } from '#/adapter/form';

import { KT_TABLE_DEFAULT_FORM_GRID } from '../config/constants';

/**
 * 统一分页接口和数组数据源的返回结构。
 *
 * @param result 接口返回的分页对象或静态数组数据源。
 */
export function normalizePageResult<Row extends KtTableRecord>(
  result: KtTablePageResult<Row> | Row[],
) {
  if (Array.isArray(result)) {
    return {
      list: result,
      total: result.length,
    };
  }

  const list = result.list || result.records || result.items || [];

  return {
    list,
    total: typeof result.total === 'number' ? result.total : list.length,
  };
}

/**
 * 合并主表格和模块注入的 Vben 表单配置。
 *
 * @param options 待合并的表单配置列表，undefined 项会被忽略。
 */
export function mergeFormOptions(
  options: Array<KtTableFormOptions | undefined>,
) {
  let labelInInput = true;
  const formGrid = resolveFormGridOptions(options);
  let mergedOptions: KtTableFormOptions = {
    commonConfig: {
      componentProps: {
        class: 'kt-table__form-control',
      },
      controlClass: 'kt-table__form-control',
      formItemClass: 'kt-table__form-item',
      hideLabel: true,
      labelWidth: 72,
    },
    compact: true,
    collapsed: false,
    collapsedRows: 1,
    collapseReserveAction: false,
    layout: 'horizontal',
    schema: [],
    showCollapseButton: true,
    submitOnEnter: true,
    // 对齐 ShyTable 的 24 栅格分栏：18 份表单区域 + 6 份操作区域。
    wrapperClass: 'kt-table__form-grid',
  };

  for (const item of options) {
    if (!item) continue;
    labelInInput = item.labelInInput ?? labelInInput;

    mergedOptions = {
      ...mergedOptions,
      ...item,
      arrayToStringFields: [
        ...(mergedOptions.arrayToStringFields || []),
        ...(item.arrayToStringFields || []),
      ],
      commonConfig: {
        ...mergedOptions.commonConfig,
        ...item.commonConfig,
      },
      fieldMappingTime: [
        ...(mergedOptions.fieldMappingTime || []),
        ...(item.fieldMappingTime || []),
      ],
      schema: [...(mergedOptions.schema || []), ...(item.schema || [])],
    };
  }

  mergedOptions = {
    ...mergedOptions,
    commonConfig: labelInInput
      ? {
          ...mergedOptions.commonConfig,
          hideLabel: true,
        }
      : mergedOptions.commonConfig,
    schema: withKtTableFormLayout(
      mergedOptions.schema || [],
      mergedOptions.collapsedRows || 1,
      formGrid,
      labelInInput,
    ),
  };

  const {
    formGrid: _formGrid,
    labelInInput: _labelInInput,
    ...formProps
  } = mergedOptions;

  // 表格统一接管查询、重置按钮，表单只负责字段渲染和值管理。
  return {
    ...formProps,
    showDefaultActions: false,
  } as VbenFormProps;
}

/**
 * 合并并规范化 KtTable 搜索区的 24 栅格分栏配置。
 *
 * @param options 待合并的表单配置列表，后面的配置会覆盖前面的同名分栏参数。
 */
export function resolveFormGridOptions(
  options: Array<KtTableFormOptions | undefined>,
): KtTableFormGridOptions {
  const formGrid: KtTableFormGridOptions = { ...KT_TABLE_DEFAULT_FORM_GRID };

  for (const item of options) {
    if (item?.formGrid) {
      Object.assign(formGrid, item.formGrid);
    }
  }

  const totalSpan = Math.max(
    toPositiveInteger(formGrid.totalSpan, KT_TABLE_DEFAULT_FORM_GRID.totalSpan),
    2,
  );
  const actionSpan = Math.min(
    toPositiveInteger(
      formGrid.actionSpan,
      KT_TABLE_DEFAULT_FORM_GRID.actionSpan,
    ),
    totalSpan - 1,
  );
  const contentSpan = Math.min(
    toPositiveInteger(
      formGrid.contentSpan,
      Math.max(totalSpan - actionSpan, 1),
    ),
    totalSpan,
  );

  return {
    actionMinWidth: toPositiveInteger(
      formGrid.actionMinWidth,
      KT_TABLE_DEFAULT_FORM_GRID.actionMinWidth,
    ),
    actionSpan,
    contentSpan,
    fieldSpan: Math.min(
      toPositiveInteger(
        formGrid.fieldSpan,
        KT_TABLE_DEFAULT_FORM_GRID.fieldSpan,
      ),
      contentSpan,
    ),
    rangeSpan: Math.min(
      toPositiveInteger(
        formGrid.rangeSpan,
        KT_TABLE_DEFAULT_FORM_GRID.rangeSpan,
      ),
      contentSpan,
    ),
    tabletColumns: toPositiveInteger(
      formGrid.tabletColumns,
      KT_TABLE_DEFAULT_FORM_GRID.tabletColumns,
    ),
    totalSpan,
  };
}

/**
 * 将用户传入的栅格数值规整成正整数。
 *
 * @param value 待规整的数值。
 * @param fallback 当前值无效时使用的兜底数值。
 */
function toPositiveInteger(value: number | undefined, fallback: number) {
  const normalized = Number(value);

  return Number.isFinite(normalized) && normalized > 0
    ? Math.round(normalized)
    : fallback;
}

/**
 * 从表单 label 中读取可用于 placeholder 的文本。
 *
 * @param label 表单项 label，只有字符串 label 会参与 placeholder 生成。
 */
function getTextLabel(label: unknown) {
  return typeof label === 'string' ? label : '';
}

/**
 * 根据组件类型和字段文案生成默认 placeholder。
 *
 * @param component 表单组件名，用于判断输入、选择、日期选择等类型。
 * @param label 表单字段文案，用于拼接用户可读的 placeholder。
 */
function createPlaceholder(component: unknown, label: string) {
  if (!label || typeof component !== 'string') return undefined;

  if (component.includes('Picker')) {
    return component === 'RangePicker'
      ? [`开始${label}`, `结束${label}`]
      : `请选择${label}`;
  }

  if (component.includes('Select') || component.includes('Cascader')) {
    return `请选择${label}`;
  }

  if (component.includes('Input')) {
    return `请输入${label}`;
  }

  return label;
}

/**
 * 合并表单项原有 componentProps 和自动生成的 placeholder。
 *
 * @param schema 当前表单项配置，用于读取组件类型、label 和字段信息。
 * @param componentProps 当前表单组件属性，已有 placeholder 时不会覆盖。
 */
function mergePlaceholder(
  schema: NonNullable<KtTableFormOptions['schema']>[number],
  componentProps: Record<string, any>,
) {
  const label = getTextLabel(schema.label);
  const placeholder = createPlaceholder(schema.component, label);

  if (!placeholder || componentProps.placeholder) return componentProps;

  return {
    ...componentProps,
    placeholder,
  };
}

/**
 * 补齐 KtTable 表单布局 class，并在需要时将字段 label 收进输入框 placeholder。
 *
 * @param schema 表单 schema 列表。
 * @param collapsedRows 表单收起时保留展示的行数。
 * @param formGrid 当前表格搜索区的栅格分栏配置。
 * @param labelInInput 是否将字段 label 转换成表单控件 placeholder。
 */
function withKtTableFormLayout(
  schema: NonNullable<KtTableFormOptions['schema']>,
  collapsedRows: number,
  formGrid: KtTableFormGridOptions,
  labelInInput: boolean,
) {
  const collapsedVisibleFields = getCollapsedVisibleFields(
    schema,
    collapsedRows,
    formGrid,
  );

  return schema.map((item) => {
    const span = getTableFormSpan(item, formGrid);
    const componentProps = item.componentProps;
    const formItemClass = mergeFormItemClass(
      getTableFormItemClass(
        item.component,
        collapsedVisibleFields.has(item.fieldName),
      ),
      item.formItemClass,
    );

    if (typeof componentProps === 'function') {
      const resolveComponentProps = componentProps as (
        ...args: any[]
      ) => Record<string, any>;

      return {
        ...item,
        componentProps: (...args: any[]) =>
          labelInInput
            ? mergePlaceholder(item, resolveComponentProps(...args) || {})
            : resolveComponentProps(...args),
        formItemClass,
        style: mergeFormItemStyle(item, span),
      };
    }

    return {
      ...item,
      componentProps: labelInInput
        ? mergePlaceholder(item, item.componentProps || {})
        : item.componentProps,
      formItemClass,
      style: mergeFormItemStyle(item, span),
    };
  });
}

/**
 * 计算表单收起后仍然可见的字段集合。
 *
 * @param schema 表单 schema 列表。
 * @param collapsedRows 表单收起后允许显示的行数。
 * @param formGrid 当前表格搜索区的栅格分栏配置。
 */
function getCollapsedVisibleFields(
  schema: NonNullable<KtTableFormOptions['schema']>,
  collapsedRows: number,
  formGrid: KtTableFormGridOptions,
) {
  const visibleFields = new Set<string>();
  let currentRowSpan = 0;
  let row = 1;

  for (const item of schema) {
    const span = getTableFormSpan(item, formGrid);

    if (currentRowSpan + span > formGrid.contentSpan) {
      row += 1;
      currentRowSpan = 0;
    }

    if (row > collapsedRows) break;

    visibleFields.add(item.fieldName);
    currentRowSpan += span;
  }

  return visibleFields;
}

/**
 * 根据组件类型和收起可见状态生成表单项 class。
 *
 * @param component 表单组件名，用于区分普通字段和区间字段宽度。
 * @param keepCollapsedVisible 当前字段在收起态是否仍需要保留显示。
 */
function getTableFormItemClass(
  component: unknown,
  keepCollapsedVisible: boolean,
) {
  const baseClass =
    component === 'RangePicker'
      ? 'kt-table__form-item--range'
      : 'kt-table__form-item--field';

  // KtTable 的操作按钮在表单外部，桌面端收起时需要保留完整左侧 18 栅格行。
  return keepCollapsedVisible
    ? `${baseClass} kt-table__form-item--collapsed-visible`
    : baseClass;
}

/**
 * 获取字段在表单内容区栅格布局中占用的列宽。
 *
 * @param schema 当前表单项配置，支持业务侧通过 formGridSpan 或 colProps.span 覆盖宽度。
 * @param formGrid 当前表格搜索区的栅格分栏配置。
 */
function getTableFormSpan(
  schema: KtTableFormSchema,
  formGrid: KtTableFormGridOptions,
) {
  const customSpan = schema.formGridSpan ?? schema.colProps?.span;
  const defaultSpan =
    schema.component === 'RangePicker'
      ? formGrid.rangeSpan
      : formGrid.fieldSpan;
  const span = typeof customSpan === 'number' ? customSpan : defaultSpan;

  return Math.min(
    toPositiveInteger(span, formGrid.fieldSpan),
    formGrid.contentSpan,
  );
}

/**
 * 合并业务侧表单项 style 和 KtTable 根据栅格计算出的 span 变量。
 *
 * @param schema 当前表单项配置，用于读取业务侧可能传入的 style。
 * @param span 当前字段在表单内容区内占用的栅格数量。
 */
function mergeFormItemStyle(schema: KtTableFormSchema, span: number) {
  const gridStyle = {
    '--kt-table-form-item-span': String(span),
  };
  const style = (schema as any).style;

  if (Array.isArray(style)) return [...style, gridStyle];
  if (style && typeof style === 'object') return { ...style, ...gridStyle };
  if (typeof style === 'string') return [style, gridStyle];

  return gridStyle;
}

/**
 * 合并多个 class 字符串并过滤空值。
 *
 * @param classes 待合并的 class 字符串列表。
 */
function mergeClass(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/**
 * 合并 KtTable 默认表单项 class 和业务侧自定义 class。
 *
 * @param baseClass KtTable 根据布局计算出的基础 class。
 * @param customClass 业务侧传入的静态 class 或动态 class 函数。
 */
function mergeFormItemClass(
  baseClass: string,
  customClass: (() => string) | string | undefined,
) {
  if (typeof customClass === 'function') {
    return () => mergeClass(baseClass, customClass());
  }

  return mergeClass(baseClass, customClass);
}

/**
 * 从 Antdv 列配置中读取稳定的列唯一标识。
 *
 * @param column 当前表格列配置，优先使用 key，其次使用 dataIndex。
 */
export function getColumnKey(column: TableColumnType<KtTableRecord>) {
  const dataIndex = Array.isArray(column.dataIndex)
    ? column.dataIndex.join('.')
    : column.dataIndex;

  return String(column.key || dataIndex || '');
}
