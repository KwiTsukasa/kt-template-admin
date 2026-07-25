import type { FieldOptions, FormContext, GenericObject } from 'vee-validate';
import type { ZodTypeAny } from 'zod';

import type { Component, HtmlHTMLAttributes, Ref } from 'vue';

import type { VbenButtonProps } from '@vben-core/shadcn-ui';
import type { ClassType, MaybeComputedRef } from '@vben-core/typings';

import type { FormApi } from './form-api';

export type FormLayout = 'horizontal' | 'inline' | 'vertical';

export type BaseFormComponentType =
  | 'DefaultButton'
  | 'PrimaryButton'
  | 'VbenCheckbox'
  | 'VbenInput'
  | 'VbenInputPassword'
  | 'VbenPinInput'
  | 'VbenSelect'
  | (Record<never, never> & string);

type Breakpoints = '2xl:' | '3xl:' | '' | 'lg:' | 'md:' | 'sm:' | 'xl:';

type GridCols = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type WrapperClassType =
  | `${Breakpoints}grid-cols-${GridCols}`
  | (Record<never, never> & string);

export type FormItemClassType =
  | `${Breakpoints}cols-end-${'auto' | GridCols}`
  | `${Breakpoints}cols-span-${'auto' | 'full' | GridCols}`
  | `${Breakpoints}cols-start-${'auto' | GridCols}`
  | (Record<never, never> & string)
  | WrapperClassType;

export type FormFieldOptions = Partial<
  FieldOptions & {
    validateOnBlur?: boolean;
    validateOnChange?: boolean;
    validateOnInput?: boolean;
    validateOnModelUpdate?: boolean;
  }
>;

export interface FormShape {
  default?: any;
  fieldName: string;
  required?: boolean;
  rules?: ZodTypeAny;
}

export type MaybeComponentPropKey =
  | 'options'
  | 'placeholder'
  | 'title'
  | keyof HtmlHTMLAttributes
  | (Record<never, never> & string);

export type MaybeComponentProps = { [K in MaybeComponentPropKey]?: any };

export type FormActions = FormContext<GenericObject>;

export type CustomRenderType = (() => Component | string) | string;

export type FormSchemaRuleType =
  | 'required'
  | 'selectRequired'
  | null
  | (Record<never, never> & string)
  | ZodTypeAny;

type FormItemDependenciesCondition<T = boolean | PromiseLike<boolean>> = (
  value: Partial<Record<string, any>>,
  actions: FormActions,
) => T;

type FormItemDependenciesConditionWithRules = (
  value: Partial<Record<string, any>>,
  actions: FormActions,
) => FormSchemaRuleType | PromiseLike<FormSchemaRuleType>;

type FormItemDependenciesConditionWithProps = (
  value: Partial<Record<string, any>>,
  actions: FormActions,
) => MaybeComponentProps | PromiseLike<MaybeComponentProps>;

export interface FormItemDependencies {
  componentProps?: FormItemDependenciesConditionWithProps;
  disabled?: boolean | FormItemDependenciesCondition;
  if?: boolean | FormItemDependenciesCondition;
  required?: FormItemDependenciesCondition;
  rules?: FormItemDependenciesConditionWithRules;
  show?: boolean | FormItemDependenciesCondition;
  trigger?: FormItemDependenciesCondition<void>;
  triggerFields: string[];
}

type ComponentProps =
  | ((
      value: Partial<Record<string, any>>,
      actions: FormActions,
    ) => MaybeComponentProps)
  | MaybeComponentProps;

export interface FormCommonConfig {
  colon?: boolean;
  componentProps?: ComponentProps;
  controlClass?: string;
  disabled?: boolean;
  disabledOnChangeListener?: boolean;
  disabledOnInputListener?: boolean;
  emptyStateValue?: null | undefined;
  formFieldProps?: FormFieldOptions;
  formItemClass?: (() => string) | string;
  hideLabel?: boolean;
  hideRequiredMark?: boolean;
  labelClass?: string;
  labelWidth?: number;
  modelPropName?: string;
  wrapperClass?: string;
}

type RenderComponentContentType = (
  value: Partial<Record<string, any>>,
  api: FormActions,
) => Record<string, any>;

export type HandleSubmitFn = (
  values: Record<string, any>,
) => Promise<void> | void;

export type HandleResetFn = (
  values: Record<string, any>,
) => Promise<void> | void;

export type FieldMappingTime = [
  string,
  [string, string],
  (
    | ((value: any, fieldName: string) => any)
    | [string, string]
    | null
    | string
  )?,
][];

export type ArrayToStringFields = Array<
  | [string[], string?] // 嵌套数组格式，可选分隔符
  | string // 单个字段，使用默认分隔符
  | string[] // 简单数组格式，最后一个元素可以是分隔符
>;

export interface FormSchema<
  T extends BaseFormComponentType = BaseFormComponentType,
> extends FormCommonConfig {
  component: Component | T;
  componentProps?: ComponentProps;
  defaultValue?: any;
  dependencies?: FormItemDependencies;
  description?: CustomRenderType;
  fieldName: string;
  help?: CustomRenderType;
  hide?: boolean;
  label?: CustomRenderType;
  // 自定义组件内部渲染
  renderComponentContent?: RenderComponentContentType;
  rules?: FormSchemaRuleType;
  suffix?: CustomRenderType;
}

export interface FormFieldProps extends FormSchema {
  required?: boolean;
}

export interface FormRenderProps<
  T extends BaseFormComponentType = BaseFormComponentType,
> {
  arrayToStringFields?: ArrayToStringFields;
  collapsed?: boolean;
  collapsedRows?: number;
  collapseTriggerResize?: boolean;
  collapseReserveAction?: boolean;
  commonConfig?: FormCommonConfig;
  compact?: boolean;
  componentBindEventMap?: Partial<Record<BaseFormComponentType, string>>;
  componentMap: Record<BaseFormComponentType, Component>;
  fieldMappingTime?: FieldMappingTime;
  form?: FormContext<GenericObject>;
  layout?: FormLayout;
  schema?: FormSchema<T>[];

  showCollapseButton?: boolean;

  wrapperClass?: WrapperClassType;
}

export interface ActionButtonOptions extends VbenButtonProps {
  [key: string]: any;
  content?: MaybeComputedRef<string>;
  show?: boolean;
}

export interface VbenFormProps<
  T extends BaseFormComponentType = BaseFormComponentType,
> extends Omit<
  FormRenderProps<T>,
  'componentBindEventMap' | 'componentMap' | 'form'
> {
  actionButtonsReverse?: boolean;
  actionLayout?: 'inline' | 'newLine' | 'rowEnd';
  actionPosition?: 'center' | 'left' | 'right';
  actionWrapperClass?: ClassType;
  arrayToStringFields?: ArrayToStringFields;

  fieldMappingTime?: FieldMappingTime;
  handleCollapsedChange?: (collapsed: boolean) => void;
  handleReset?: HandleResetFn;
  handleSubmit?: HandleSubmitFn;
  handleValuesChange?: (
    values: Record<string, any>,
    fieldsChanged: string[],
  ) => void;
  resetButtonOptions?: ActionButtonOptions;

  scrollToFirstError?: boolean;

  showDefaultActions?: boolean;

  submitButtonOptions?: ActionButtonOptions;

  submitOnChange?: boolean;

  submitOnEnter?: boolean;
}

export type ExtendedFormApi = FormApi & {
  useStore: <T = NoInfer<VbenFormProps>>(
    selector?: (state: NoInfer<VbenFormProps>) => T,
  ) => Readonly<Ref<T>>;
};

export interface VbenFormAdapterOptions<
  T extends BaseFormComponentType = BaseFormComponentType,
> {
  config?: {
    baseModelPropName?: string;
    disabledOnChangeListener?: boolean;
    disabledOnInputListener?: boolean;
    emptyStateValue?: null | undefined;
    modelPropNameMap?: Partial<Record<T, string>>;
  };
  defineRules?: {
    required?: (
      value: any,
      params: any,
      ctx: Record<string, any>,
    ) => boolean | string;
    selectRequired?: (
      value: any,
      params: any,
      ctx: Record<string, any>,
    ) => boolean | string;
  };
}
