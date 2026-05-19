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
 * @param props 表格表单相关配置，包含主表单配置和模块列表。
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
   */
  async function getSearchValues() {
    if (!hasSearchForm.value) return {};

    return await formApi.getValues();
  }

  /**
   * 设置搜索表单值。
   *
   * @param values 需要写入搜索表单的字段值。
   */
  async function setSearchValues(values: KtTableRecord) {
    if (!hasSearchForm.value) return;

    await formApi.setValues(values);
  }

  /**
   * 重置搜索表单。
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
