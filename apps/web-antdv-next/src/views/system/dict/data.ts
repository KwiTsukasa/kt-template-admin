import type { VbenFormSchema } from '#/adapter/form';

import { z } from '#/adapter/form';
import { $t } from '#/locales';

/**
 * 将启用和停用状态映射为字典表单使用的国际化标签与颜色选项。
 *
 * @returns 启用与停用状态的表单选项数组。
 */
export function getStatusOptions() {
  return [
    { color: 'success', label: $t('common.enabled'), value: 1 },
    { color: 'default', label: $t('common.disabled'), value: 0 },
  ];
}

/**
 * 生成字典项编辑字段，约束字典键、标签和值的必填与长度，并补齐排序和状态默认值。
 *
 * @returns 可直接渲染字典项编辑表单的字段 Schema 列表。
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '如 COMPONENT_TYPE',
      },
      fieldName: 'dictCode',
      label: $t('system.dict.dictCode'),
      rules: z
        .string()
        .min(1, $t('ui.formRules.required', [$t('system.dict.dictCode')]))
        .max(
          120,
          $t('ui.formRules.maxLength', [$t('system.dict.dictCode'), 120]),
        ),
    },
    {
      component: 'Input',
      fieldName: 'label',
      label: $t('system.dict.label'),
      rules: z
        .string()
        .min(1, $t('ui.formRules.required', [$t('system.dict.label')]))
        .max(120, $t('ui.formRules.maxLength', [$t('system.dict.label'), 120])),
    },
    {
      component: 'Input',
      fieldName: 'value',
      label: $t('system.dict.value'),
      rules: z
        .string()
        .min(1, $t('ui.formRules.required', [$t('system.dict.value')]))
        .max(120, $t('ui.formRules.maxLength', [$t('system.dict.value'), 120])),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '如 CHART',
      },
      fieldName: 'childrenCode',
      label: $t('system.dict.childrenCode'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        min: 0,
        precision: 0,
      },
      defaultValue: 0,
      fieldName: 'sort',
      label: $t('system.dict.sort'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: getStatusOptions(),
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.dict.status'),
    },
  ];
}

/**
 * 生成字典项列表的字典键、标签、值、状态和时间筛选字段，供搜索表单直接渲染。
 *
 * @returns 可直接渲染字典项搜索表单的字段 Schema 列表。
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '如 COMPONENT_TYPE',
      },
      fieldName: 'dictCode',
      label: $t('system.dict.dictCode'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
      },
      fieldName: 'label',
      label: $t('system.dict.label'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
      },
      fieldName: 'value',
      label: $t('system.dict.value'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
      },
      fieldName: 'childrenCode',
      label: $t('system.dict.childrenCode'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: getStatusOptions(),
      },
      fieldName: 'status',
      label: $t('system.dict.status'),
    },
  ];
}

/**
 * 生成字典分组编辑字段，约束分组编码与名称并提供状态和备注配置。
 *
 * @returns 可直接渲染字典分组编辑表单的字段 Schema 列表。
 */
export function useGroupFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '如 COMPONENT_TYPE',
      },
      fieldName: 'keyword',
      label: $t('system.dict.dictCode'),
    },
  ];
}
