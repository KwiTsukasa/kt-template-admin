import type {
  FormState,
  GenericObject,
  ResetFormOpts,
  ValidationOptions,
} from 'vee-validate';

import type { ComponentPublicInstance } from 'vue';

import type { Recordable } from '@vben-core/typings';

import type { FormActions, FormSchema, VbenFormProps } from './types';

import { isRef, toRaw } from 'vue';

import { Store } from '@vben-core/shared/store';
import {
  bindMethods,
  createMerge,
  formatDate,
  isDate,
  isDayjsObject,
  isFunction,
  isObject,
  mergeWithArrayOverride,
  StateHandler,
} from '@vben-core/shared/utils';

/**
 * 创建一份与 VbenForm 初始配置合并后的独立表单状态。
 *
 * @returns 与调用配置合并后的独立表单状态对象。
 */
function getDefaultState(): VbenFormProps {
  return {
    actionWrapperClass: '',
    collapsed: false,
    collapsedRows: 1,
    collapseTriggerResize: false,
    commonConfig: {},
    handleReset: undefined,
    handleSubmit: undefined,
    handleValuesChange: undefined,
    handleCollapsedChange: undefined,
    layout: 'horizontal',
    resetButtonOptions: {},
    schema: [],
    scrollToFirstError: false,
    showCollapseButton: false,
    showDefaultActions: true,
    submitButtonOptions: {},
    submitOnChange: false,
    submitOnEnter: false,
    wrapperClass: 'grid-cols-1',
  };
}

export class FormApi {
  // private api: Pick<VbenFormProps, 'handleReset' | 'handleSubmit'>;
  public form = {} as FormActions;
  isMounted = false;

  public state: null | VbenFormProps = null;
  stateHandler: StateHandler;

  public store: Store<VbenFormProps>;

  private componentRefMap: Map<string, unknown> = new Map();

  // 最后一次点击提交时的表单值
  private latestSubmissionValues: null | Recordable<any> = null;

  private prevState: null | VbenFormProps = null;

  constructor(options: VbenFormProps = {}) {
    const { ...storeState } = options;

    const defaultState = getDefaultState();

    this.store = new Store<VbenFormProps>(
      {
        ...defaultState,
        ...storeState,
      },
      {
        onUpdate: () => {
          this.prevState = this.state;
          this.state = this.store.state;
          this.updateState();
        },
      },
    );

    this.state = this.store.state;
    this.stateHandler = new StateHandler();
    bindMethods(this);
  }

  /**
   * 根据字段名返回已挂载的表单控件实例；字段不存在时返回 undefined。
   *
   * @param fieldName - Vben 表单 Schema 中的字段路径。
   * @returns 已挂载的目标字段控件实例；字段不存在或未挂载时为 undefined。
   */
  getFieldComponentRef<T = ComponentPublicInstance>(
    fieldName: string,
  ): T | undefined {
    let target = (() => {
      if (this.componentRefMap.has(fieldName)) {
        return this.componentRefMap.get(fieldName) as ComponentPublicInstance;
      }
      return undefined;
    })();
    if (
      target &&
      target.$.type.name === 'AsyncComponentWrapper' &&
      target.$.subTree.ref
    ) {
      if (Array.isArray(target.$.subTree.ref)) {
        if (
          target.$.subTree.ref.length > 0 &&
          isRef(target.$.subTree.ref[0]?.r)
        ) {
          target = target.$.subTree.ref[0]?.r.value as ComponentPublicInstance;
        }
      } else if (isRef(target.$.subTree.ref.r)) {
        target = target.$.subTree.ref.r.value as ComponentPublicInstance;
      }
    }
    return target as T;
  }

  /**
   * 在已注册控件中查找包含当前活动元素的字段；没有匹配焦点时返回 undefined。
   *
   * @returns 当前聚焦字段的 fieldName 与控件引用；无焦点字段时为 undefined。
   */
  getFocusedField() {
    for (const fieldName of this.componentRefMap.keys()) {
      const ref = this.getFieldComponentRef(fieldName);
      if (ref) {
        let el: HTMLElement | null = null;
        if (ref instanceof HTMLElement) {
          el = ref;
        } else if (ref.$el instanceof HTMLElement) {
          el = ref.$el;
        }
        if (!el) {
          continue;
        }
        if (
          el === document.activeElement ||
          el.contains(document.activeElement)
        ) {
          return fieldName;
        }
      }
    }
    return undefined;
  }

  /**
   * 读取最近一次成功提交的字段快照；尚未提交时返回空对象。
   *
   * @returns 最近一次成功提交的字段快照；尚未提交时为空对象。
   */
  getLatestSubmissionValues() {
    return this.latestSubmissionValues || {};
  }

  /**
   * 暴露表单当前配置状态，供组件订阅同一份响应式数据。
   *
   * @returns 表单当前内部状态对象。
   */
  getState() {
    return this.state;
  }

  /**
   * 读取当前表单字段值，并按 Schema 配置执行数组与字符串互转。
   *
   * @returns 按字段 Schema 完成数组与字符串转换后的当前表单值。
   */
  async getValues<T = Recordable<any>>() {
    const form = await this.getForm();
    return (() => {
      if (form.values) {
        return this.handleRangeTimeValue(form.values);
      }
      return {};
    })() as T;
  }

  /**
   * 通过表单实例检查指定字段是否仍有校验错误。
   *
   * @param fieldName - 要从当前表单读取校验状态的字段路径。
   * @returns 指定表单字段当前没有校验错误时返回 true，否则返回 false。
   */
  async isFieldValid(fieldName: string) {
    const form = await this.getForm();
    return form.isFieldValid(fieldName);
  }

  /**
   * 把多个表单 API 串联成代理，使调用方可统一校验并选择合并或分组返回各表单值。
   *
   * @param formApi - 要追加到统一校验与提交链的表单 API。
   * @returns 代理后的表单 API，可继续追加表单并统一提交全部表单。
   */
  merge(formApi: FormApi) {
    const chain = [this, formApi];
    const proxy = new Proxy(formApi, {
      /**
       * 代理表单 API 属性读取；为 `merge` 和 `submitAllForm` 提供跨表单实现，其他属性透传目标 API。
       *
       * @param target - 代理正在转发表单 API 属性读取的目标对象。
       * @param prop - 代理本次读取的属性键。
       * @returns `merge` 返回追加表单 API 的函数，`submitAllForm` 返回统一校验提交函数，其他属性返回原目标属性。
       */
      get(target: any, prop: any) {
        if (prop === 'merge') {
          return (nextFormApi: FormApi) => {
            chain.push(nextFormApi);
            return proxy;
          };
        }
        if (prop === 'submitAllForm') {
          return async (needMerge: boolean = true) => {
            try {
              const results = await Promise.all(
                chain.map(async (api) => {
                  const validateResult = await api.validate();
                  if (!validateResult.valid) {
                    return;
                  }
                  const rawValues = toRaw((await api.getValues()) || {});
                  return rawValues;
                }),
              );
              if (needMerge) {
                const mergedResults = Object.assign({}, ...results);
                return mergedResults;
              }
              return results;
            } catch (error) {
              console.error('Validation error:', error);
            }
          };
        }
        return target[prop];
      },
    });

    return proxy;
  }

  /**
   * 挂载弹窗或抽屉实例并同步初始状态，使后续 API 调用可以驱动组件。
   *
   * @param formActions - 供外部调用的表单校验、重置与提交方法集合。
   * @param componentRefMap - 按字段名保存动态表单组件引用的映射。
   */
  mount(formActions: FormActions, componentRefMap: Map<string, unknown>) {
    if (!this.isMounted) {
      Object.assign(this.form, formActions);
      this.stateHandler.setConditionTrue();
      this.setLatestSubmissionValues({
        ...toRaw(this.handleRangeTimeValue(this.form.values)),
      });
      this.componentRefMap = componentRefMap;
      this.isMounted = true;
    }
  }

  /**
   * 从当前 Schema 中移除指定字段，并通过状态更新保留其余表单项。
   *
   * @param fields - 需要从 Vben 表单 Schema 中移除的字段名集合。
   */
  async removeSchemaByFields(fields: string[]) {
    const fieldSet = new Set(fields);
    const schema = this.state?.schema ?? [];

    const filterSchema = schema.filter((item) => !fieldSet.has(item.fieldName));

    this.setState({
      schema: filterSchema,
    });
  }

  /**
   * 根据选项重置表单值、校验、脏状态与初始状态。
   *
   * @param state - 是否同时重置表单值、校验与脏状态的控制项。
   * @param opts - 重置表单时是否保留字段值、校验或脏状态的选项。
   * @returns 完成所选重置步骤后兑现的 Promise。
   */
  async resetForm(
    state?: Partial<FormState<GenericObject>> | undefined,
    opts?: Partial<ResetFormOpts>,
  ) {
    const form = await this.getForm();
    return form.resetForm(state, opts);
  }

  /**
   * 等待表单挂载后清除所有当前字段校验错误。
   */
  async resetValidate() {
    const form = await this.getForm();
    const fields = Object.keys(form.errors.value);
    fields.forEach((field) => {
      form.setFieldError(field, undefined);
    });
  }

  /**
   * 从校验错误中找到第一个字段，并把对应控件滚动到视口。
   *
   * @param errors - Vben 表单校验返回的字段错误映射。
   */
  scrollToFirstError(errors: Record<string, any> | string) {
    // https://github.com/logaretm/vee-validate/discussions/3835
    const firstErrorFieldName = (() => {
      if (typeof errors === 'string') {
        return errors;
      }
      return Object.keys(errors)[0];
    })();

    if (!firstErrorFieldName) {
      return;
    }

    let el = document.querySelector(
      `[name="${firstErrorFieldName}"]`,
    ) as HTMLElement;

    // 如果通过 name 属性找不到，尝试通过组件引用查找, 正常情况下不会走到这，怕哪天 vee-validate 改了 name 属性有个兜底的
    if (!el) {
      const componentRef = this.getFieldComponentRef(firstErrorFieldName);
      if (componentRef && componentRef.$el instanceof HTMLElement) {
        el = componentRef.$el;
      }
    }

    if (el) {
      // 滚动到错误字段，添加一些偏移量以确保字段完全可见
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }

  /**
   * 等待表单实例挂载后写入指定字段，并按参数决定是否立即校验。
   *
   * @param field - 需要写值的 vee-validate 字段路径。
   * @param value - 写入指定字段的新值。
   * @param shouldValidate - 是否在更新字段后立即执行表单校验。
   */
  async setFieldValue(field: string, value: any, shouldValidate?: boolean) {
    const form = await this.getForm();
    form.setFieldValue(field, value, shouldValidate);
  }

  /**
   * 复制并保存最近一次提交字段，避免响应式代理或调用方后续修改污染快照。
   *
   * @param values - 要保存为最近提交快照的表单字段；null 会清空快照。
   */
  setLatestSubmissionValues(values: null | Recordable<any>) {
    this.latestSubmissionValues = { ...toRaw(values) };
  }

  /**
   * 通过状态补丁或状态计算函数更新表单配置，数组字段采用新值整体覆盖。
   *
   * @param stateOrFn - 表单状态补丁，或根据旧状态计算补丁的函数。
   */
  setState(
    stateOrFn:
      | ((prev: VbenFormProps) => Partial<VbenFormProps>)
      | Partial<VbenFormProps>,
  ) {
    if (isFunction(stateOrFn)) {
      this.store.setState((prev) => {
        return mergeWithArrayOverride(stateOrFn(prev), prev);
      });
    } else {
      this.store.setState((prev) => mergeWithArrayOverride(stateOrFn, prev));
    }
  }

  /**
   * 批量写入表单字段；指定过滤字段时只递归合并已存在字段，数组、日期和 Day.js 值整体替换。
   *
   * @param fields - 需要批量转换或验证的表单字段名集合。
   * @param filterFields - 允许参与搜索匹配的字段名集合；未传入时使用 `true`。
   * @param shouldValidate - 是否在更新字段后立即执行表单校验；未传入时使用 `false`。
   */
  async setValues(
    fields: Record<string, any>,
    filterFields: boolean = true,
    shouldValidate: boolean = false,
  ) {
    const form = await this.getForm();
    if (!filterFields) {
      form.setValues(fields, shouldValidate);
      return;
    }

    const fieldMergeFn = createMerge((obj, key, value) => {
      if (key in obj) {
        obj[key] = (() => {
          if (
            !Array.isArray(obj[key]) &&
            isObject(obj[key]) &&
            !isDayjsObject(obj[key]) &&
            !isDate(obj[key])
          ) {
            return fieldMergeFn(value, obj[key]);
          }
          return value;
        })();
      }
      return true;
    });
    const filteredFields = fieldMergeFn(fields, form.values);
    form.setValues(filteredFields, shouldValidate);
  }

  /**
   * 阻止原生提交事件，触发表单提交与外部回调，并返回去除响应式代理后的字段值。
   *
   * @param e - 触发当前处理流程的原始事件或错误值。
   * @returns 已提交并去除响应式代理的表单字段值。
   */
  async submitForm(e?: Event) {
    e?.preventDefault();
    e?.stopPropagation();
    const form = await this.getForm();
    await form.submitForm();
    const rawValues = toRaw(await this.getValues());
    await this.state?.handleSubmit?.(rawValues);

    return rawValues;
  }

  /**
   * 解除组件实例与 API 的绑定，并清理只属于该实例的状态。
   */
  unmount() {
    this.form?.resetForm?.();
    // this.state = null;
    this.latestSubmissionValues = null;
    this.isMounted = false;
    this.stateHandler.reset();
  }

  /**
   * 按 fieldName 合并已有表单字段 Schema；任一更新项缺少字段名时拒绝整批更新。
   *
   * @param schema - 按 fieldName 合并进现有表单 Schema 的字段补丁；缺少有效 fieldName 时拒绝更新。
   */
  updateSchema(schema: Partial<FormSchema>[]) {
    const updated: Partial<FormSchema>[] = [...schema];
    const hasField = updated.every(
      (item) => Reflect.has(item, 'fieldName') && item.fieldName,
    );

    if (!hasField) {
      console.error(
        'All items in the schema array must have a valid `fieldName` property to be updated',
      );
      return;
    }
    const currentSchema = [...(this.state?.schema ?? [])];

    const updatedMap: Record<string, any> = {};

    updated.forEach((item) => {
      if (item.fieldName) {
        updatedMap[item.fieldName] = item;
      }
    });

    currentSchema.forEach((schema, index) => {
      const updatedData = updatedMap[schema.fieldName];
      if (updatedData) {
        currentSchema[index] = mergeWithArrayOverride(
          updatedData,
          schema,
        ) as FormSchema;
      }
    });
    this.setState({ schema: currentSchema });
  }

  /**
   * 校验完整表单并按配置滚动到首个错误，返回有效标志与字段错误集合。
   *
   * @param opts - 控制是否校验脏字段及是否滚动到首个错误的选项。
   * @returns 完整表单的有效标志与字段错误集合。
   */
  async validate(opts?: Partial<ValidationOptions>) {
    const form = await this.getForm();

    const validateResult = await form.validate(opts);

    if (Object.keys(validateResult?.errors ?? {}).length > 0) {
      console.error('validate error', validateResult?.errors);

      if (this.state?.scrollToFirstError) {
        this.scrollToFirstError(validateResult.errors);
      }
    }
    return validateResult;
  }

  /**
   * 先校验完整表单；失败时滚动到首个错误，成功时提交并返回字段值。
   *
   * @returns 校验成功时为已提交字段值；校验失败时返回 undefined。
   */
  async validateAndSubmitForm() {
    const form = await this.getForm();
    const { valid, errors } = await form.validate();
    if (!valid) {
      if (this.state?.scrollToFirstError) {
        this.scrollToFirstError(errors);
      }
      return;
    }
    return await this.submitForm();
  }

  /**
   * 校验指定字段并在需要时滚动到该错误字段，返回字段级校验结果。
   *
   * @param fieldName - 需要单独校验的表单字段路径。
   * @param opts - 控制字段校验失败时是否滚动定位的选项。
   * @returns 指定字段的有效标志与错误信息集合。
   */
  async validateField(fieldName: string, opts?: Partial<ValidationOptions>) {
    const form = await this.getForm();
    const validateResult = await form.validateField(fieldName, opts);

    if (Object.keys(validateResult?.errors ?? {}).length > 0) {
      console.error('validate error', validateResult?.errors);

      if (this.state?.scrollToFirstError) {
        this.scrollToFirstError(fieldName);
      }
    }
    return validateResult;
  }

  /**
   * 等待 VbenForm 挂载完成后返回表单实例，挂载失败时抛出明确错误。
   *
   * @returns 已挂载的 VbenForm 实例。
   * @throws 等待挂载后仍找不到 VbenForm 元数据时抛出。
   */
  private async getForm() {
    if (!this.isMounted) {
      // 等待form挂载
      await this.stateHandler.waitForCondition();
    }
    if (!this.form?.meta) {
      throw new Error('<VbenForm /> is not mounted');
    }
    return this.form;
  }

  private handleMultiFields = (originValues: Record<string, any>) => {
    const arrayToStringFields = this.state?.arrayToStringFields;
    if (!arrayToStringFields || !Array.isArray(arrayToStringFields)) {
      return;
    }

    const processFields = (fields: string[], separator: string = ',') => {
      this.processFields(fields, separator, originValues, (value, sep) => {
        if (Array.isArray(value)) {
          return value.join(sep);
        } else if (typeof value === 'string') {
          // 处理空字符串的情况
          if (value === '') {
            return [];
          }
          // 处理复杂分隔符的情况
          const escapedSeparator = sep.replaceAll(
            /[.*+?^${}()|[\]\\]/g,
            String.raw`\$&`,
          );
          return value.split(new RegExp(escapedSeparator));
        } else {
          return value;
        }
      });
    };

    // 处理简单数组格式 ['field1', 'field2', ';'] 或 ['field1', 'field2']
    if (arrayToStringFields.every((item) => typeof item === 'string')) {
      const lastItem =
        arrayToStringFields[arrayToStringFields.length - 1] || '';
      const fields = (() => {
        if (lastItem.length === 1) {
          return arrayToStringFields.slice(0, -1);
        }
        return arrayToStringFields;
      })();
      const separator = (() => {
        if (lastItem.length === 1) {
          return lastItem;
        }
        return ',';
      })();
      processFields(fields, separator);
      return;
    }

    // 处理嵌套数组格式 [['field1'], ';']
    arrayToStringFields.forEach((fieldConfig) => {
      if (Array.isArray(fieldConfig)) {
        const [fields, separator = ','] = fieldConfig;
        // 根据类型定义，fields 应该始终是字符串数组
        if (!Array.isArray(fields)) {
          console.warn(
            `Invalid field configuration: fields should be an array of strings, got ${typeof fields}`,
          );
          return;
        }
        processFields(fields, separator);
      }
    });
  };

  private handleRangeTimeValue = (originValues: Record<string, any>) => {
    const values = { ...originValues };
    const fieldMappingTime = this.state?.fieldMappingTime;

    this.handleMultiFields(values);
    if (!fieldMappingTime || !Array.isArray(fieldMappingTime)) {
      return values;
    }

    fieldMappingTime.forEach(
      ([field, [startTimeKey, endTimeKey], format = 'YYYY-MM-DD']) => {
        if (startTimeKey && endTimeKey && values[field] === null) {
          Reflect.deleteProperty(values, startTimeKey);
          Reflect.deleteProperty(values, endTimeKey);
          // delete values[startTimeKey];
          // delete values[endTimeKey];
        }

        if (!values[field]) {
          Reflect.deleteProperty(values, field);
          // delete values[field];
          return;
        }

        const [startTime, endTime] = values[field];
        if (format === null) {
          values[startTimeKey] = startTime;
          values[endTimeKey] = endTime;
        } else if (isFunction(format)) {
          values[startTimeKey] = format(startTime, startTimeKey);
          values[endTimeKey] = format(endTime, endTimeKey);
        } else {
          const [startTimeFormat, endTimeFormat] = (() => {
            if (Array.isArray(format)) {
              return format;
            }
            return [format, format];
          })();

          values[startTimeKey] = (() => {
            if (startTime) {
              return formatDate(startTime, startTimeFormat);
            }
            return undefined;
          })();
          values[endTimeKey] = (() => {
            if (endTime) {
              return formatDate(endTime, endTimeFormat);
            }
            return undefined;
          })();
        }
        // delete values[field];
        Reflect.deleteProperty(values, field);
      },
    );
    return values;
  };

  private processFields = (
    fields: string[],
    separator: string,
    originValues: Record<string, any>,
    transformFn: (value: any, separator: string) => any,
  ) => {
    fields.forEach((field) => {
      const value = originValues[field];
      if (value === undefined || value === null) {
        return;
      }
      originValues[field] = transformFn(value, separator);
    });
  };

  /**
   * 对比新旧 Schema，并把已删除字段的表单值清为 undefined。
   */
  private updateState() {
    const currentSchema = this.state?.schema ?? [];
    const prevSchema = this.prevState?.schema ?? [];
    // 进行了删除schema操作
    if (currentSchema.length < prevSchema.length) {
      const currentFields = new Set(
        currentSchema.map((item) => item.fieldName),
      );
      const deletedSchema = prevSchema.filter(
        (item) => !currentFields.has(item.fieldName),
      );
      for (const schema of deletedSchema) {
        this.form?.setFieldValue?.(schema.fieldName, undefined);
      }
    }
  }
}
