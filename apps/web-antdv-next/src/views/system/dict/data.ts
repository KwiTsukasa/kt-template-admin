import type { VbenFormSchema } from '#/adapter/form';

import { z } from '#/adapter/form';
import { $t } from '#/locales';

export function getStatusOptions() {
  return [
    { color: 'success', label: $t('common.enabled'), value: 1 },
    { color: 'default', label: $t('common.disabled'), value: 0 },
  ];
}

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
