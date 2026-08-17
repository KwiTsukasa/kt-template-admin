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
 * 将数组或分页对象统一转换为 KtTable 的 items 与 total 结构。
 *
 * @param result - 分页接口对象或静态行数组形式的 KtTable 数据源结果。
 * @returns 统一的 items 与 total；数组数据源的 total 等于数组长度。
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
    total: (() => {
      if (typeof result.total === 'number') {
        return result.total;
      }
      return list.length;
    })(),
  };
}

/**
 * 合并主表格和模块注入的 Vben 表单配置。
 *
 * @param options - 主表格与模块按优先级提供的表单配置集合。
 * @returns 按模块到主配置优先级合并后的 Vben 表单配置。
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
    commonConfig: (() => {
      if (labelInInput) {
        return {
          ...mergedOptions.commonConfig,
          hideLabel: true,
        };
      }
      return mergedOptions.commonConfig;
    })(),
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
 * @param options - 主表格与模块按优先级提供的表单配置集合。
 * @returns 补齐各断点 span 与 gutter 的 KtTable 栅格配置。
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
 * @param value - 需要规整为正整数的可选数值。
 * @param fallback - 输入缺失或小于 1 时采用的正整数。
 * @returns 大于零的取整值；输入无效时使用 fallback。
 */
function toPositiveInteger(value: number | undefined, fallback: number) {
  const normalized = Number(value);

  if (Number.isFinite(normalized) && normalized > 0) {
    return Math.round(normalized);
  }
  return fallback;
}

/**
 * 从表单 label 中读取可用于 placeholder 的文本。
 *
 * @param label - 表单 Schema 提供的字段标题或其他未知值。
 * @returns 可用于 placeholder 的纯文本标签；非字符串或 VNode 时为空字符串。
 */
function getTextLabel(label: unknown) {
  if (typeof label === 'string') {
    return label;
  }
  return '';
}

/**
 * 根据组件类型和字段文案生成默认 placeholder。
 *
 * @param component - 表单控件类型，用来区分选择类与输入类 placeholder。
 * @param label - 要拼入默认 placeholder 的字段标题。
 * @returns 选择类控件使用“请选择”，其他控件使用“请输入”的字段提示。
 */
function createPlaceholder(component: unknown, label: string) {
  if (!label || typeof component !== 'string') return undefined;

  if (component.includes('Picker')) {
    if (component === 'RangePicker') {
      return [`开始${label}`, `结束${label}`];
    }
    return `请选择${label}`;
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
 * @param schema - 提供字段标签与控件类型、用于生成默认 placeholder 的表单项。
 * @param componentProps - 业务侧已配置的表单控件属性；自动 placeholder 会与它合并。
 * @returns 保留业务属性并仅在缺失时补齐 placeholder 的控件属性。
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
 * @param schema - 要补齐栅格布局类与可选输入内标签的完整搜索表单 Schema。
 * @param collapsedRows - 搜索表单收起时保留的栅格行数。
 * @param formGrid - 搜索表单在不同断点下使用的 24 栅格配置。
 * @param labelInInput - 是否把字段标题移入输入控件的 placeholder。
 * @returns 补齐栅格 class、style 与可选输入内标签后的表单 Schema。
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
        componentProps: (...args: any[]) => {
          if (labelInInput) {
            return mergePlaceholder(item, resolveComponentProps(...args) || {});
          }
          return resolveComponentProps(...args);
        },
        formItemClass,
        style: mergeFormItemStyle(item, span),
      };
    }

    return {
      ...item,
      componentProps: (() => {
        if (labelInInput) {
          return mergePlaceholder(item, item.componentProps || {});
        }
        return item.componentProps;
      })(),
      formItemClass,
      style: mergeFormItemStyle(item, span),
    };
  });
}

/**
 * 根据字段跨度和收起行数计算仍应显示的 Schema 字段集合。
 *
 * @param schema - 要按字段跨度累计占用行数的搜索表单 Schema。
 * @param collapsedRows - 搜索表单收起时保留的栅格行数。
 * @param formGrid - 搜索表单在不同断点下使用的 24 栅格配置。
 * @returns 收起状态下仍完整位于允许行数内的字段名集合。
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
 * @param component - 用来区分范围选择器与普通字段样式的表单控件类型。
 * @param keepCollapsedVisible - 表单收起后是否仍强制显示该字段。
 * @returns 包含控件类型与收起可见标志的 KtTable 表单项 class。
 */
function getTableFormItemClass(
  component: unknown,
  keepCollapsedVisible: boolean,
) {
  const baseClass = (() => {
    if (component === 'RangePicker') {
      return 'kt-table__form-item--range';
    }
    return 'kt-table__form-item--field';
  })();

  // KtTable 的操作按钮在表单外部，桌面端收起时需要保留完整左侧 18 栅格行。
  if (keepCollapsedVisible) {
    return `${baseClass} kt-table__form-item--collapsed-visible`;
  }
  return baseClass;
}

/**
 * 根据字段覆盖值与断点栅格配置计算表单项列宽。
 *
 * @param schema - 提供字段级 span 覆盖值的表单项配置。
 * @param formGrid - 搜索表单在不同断点下使用的 24 栅格配置。
 * @returns 当前断点下字段占用的 24 栅格列数。
 */
function getTableFormSpan(
  schema: KtTableFormSchema,
  formGrid: KtTableFormGridOptions,
) {
  const customSpan = schema.formGridSpan ?? schema.colProps?.span;
  const defaultSpan = (() => {
    if (schema.component === 'RangePicker') {
      return formGrid.rangeSpan;
    }
    return formGrid.fieldSpan;
  })();
  const span = (() => {
    if (typeof customSpan === 'number') {
      return customSpan;
    }
    return defaultSpan;
  })();

  return Math.min(
    toPositiveInteger(span, formGrid.fieldSpan),
    formGrid.contentSpan,
  );
}

/**
 * 合并业务侧表单项 style 和 KtTable 根据栅格计算出的 span 变量。
 *
 * @param schema - 提供业务侧 formItemProps.style 的表单项配置。
 * @param span - KtTable 栅格计算得到的字段列宽。
 * @returns 保留业务 style 并写入 --kt-table-form-span 的样式对象。
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
 * 将非空 class 按传入顺序连接为空格分隔字符串。
 *
 * @param classes - 需要按传入顺序连接的可选 class 字符串。
 * @returns 过滤空值并用空格连接的 class 字符串。
 */
function mergeClass(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/**
 * 合并 KtTable 默认表单项 class 和业务侧自定义 class。
 *
 * @param baseClass - 始终保留的 KtTable 表单项基础类名。
 * @param customClass - 业务侧附加的 class 字符串或延迟求值函数；缺失时仅保留基础类名。
 * @returns 基础 class 与求值后的业务 class 组合字符串。
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
 * @param column - 要从 dataIndex、key 或 title 推导稳定键的列配置。
 * @returns dataIndex、key 或 title 解析出的稳定列键；均缺失时为空字符串。
 */
export function getColumnKey(column: TableColumnType<KtTableRecord>) {
  const dataIndex = (() => {
    if (Array.isArray(column.dataIndex)) {
      return column.dataIndex.join('.');
    }
    return column.dataIndex;
  })();

  return String(column.key || dataIndex || '');
}

/**
 * 检查事件载荷是否同时包含表格行记录和操作定义，识别 KtTable 行操作事件。
 *
 * @param event - 待识别是否包含行记录与操作定义的未知事件载荷。
 * @returns 载荷同时包含表格行记录与操作定义时返回 true，否则返回 false。
 */
export function isKtTableRowActionEvent(event: MouseEvent) {
  const target = event.target;
  return (
    target instanceof Element &&
    target.closest('.kt-table__row-actions') !== null
  );
}
