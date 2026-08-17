import type { KtTableModule, KtTableProps, KtTableRecord } from '../types';

import { computed, watch } from 'vue';

import { useVbenForm } from '#/adapter/form';

import { mergeFormOptions, resolveFormGridOptions } from '../utils/index';

type KtTableFormProps = Readonly<
  Pick<KtTableProps<KtTableRecord>, 'formOptions' | 'modules'>
>;

/**
 * 初始化 KtTable 搜索表单并合并模块注入的表单配置。
 *
 * @param props - 搜索表单配置、模块配置与表格 API。
 * @returns 搜索表单组件、表单 API 以及读取、写入和重置字段的方法。
 */
export function useKtTableForm(props: KtTableFormProps) {
  const sourceOptions = computed(() => [
    props.formOptions,
    ...(props.modules || []).map((module: KtTableModule) => module.formOptions),
  ]);
  const formGrid = computed(() => resolveFormGridOptions(sourceOptions.value));
  const formOptions = computed(() => mergeFormOptions(sourceOptions.value));

  const [SearchForm, formApi] = useVbenForm(formOptions.value);
  const hasSearchForm = computed(
    () => (formOptions.value.schema?.length || 0) > 0,
  );

  watch(
    formOptions,
    (options) => {
      formApi.setState(options);
    },
    {
      deep: true,
      immediate: true,
    },
  );

  /**
   * 获取当前搜索表单值。
   *
   * @returns 搜索表单当前字段值；未启用表单时为空对象。
   */
  async function getSearchValues() {
    if (!hasSearchForm.value) return {};

    return await formApi.getValues();
  }

  /**
   * 将指定字段写入搜索表单，并等待表单状态同步完成。
   *
   * @param values - 要合并到搜索表单的字段和值。
   */
  async function setSearchValues(values: KtTableRecord) {
    if (!hasSearchForm.value) return;

    await formApi.setValues(values);
  }

  /**
   * 通过表单 API 清空搜索字段和校验状态。
   */
  async function resetForm() {
    if (!hasSearchForm.value) return;

    await formApi.resetForm();
  }

  return {
    formApi,
    formGrid,
    formOptions,
    getSearchValues,
    resetForm,
    SearchForm,
    setSearchValues,
  };
}
