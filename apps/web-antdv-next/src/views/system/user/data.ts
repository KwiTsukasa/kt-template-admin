import type { VbenFormSchema } from '#/adapter/form';

import { z } from '#/adapter/form';
import { getDeptList } from '#/api/system/dept';
import { getRoleList } from '#/api/system/role';
import { $t } from '#/locales';

const statusOptions = [
  { label: $t('common.enabled'), value: 1 },
  { label: $t('common.disabled'), value: 0 },
];

async function getRoleOptions() {
  const res = await getRoleList({
    page: 1,
    pageSize: 1000,
    status: 1,
  });
  const items = (res as any)?.items || [];
  return items.map((role: any) => ({
    label: role.name,
    value: role.id,
  }));
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('system.user.username'),
      rules: z
        .string()
        .min(2, $t('ui.formRules.minLength', [$t('system.user.username'), 2]))
        .max(
          30,
          $t('ui.formRules.maxLength', [$t('system.user.username'), 30]),
        ),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('system.user.passwordPlaceholder'),
      },
      fieldName: 'password',
      label: $t('system.user.password'),
    },
    {
      component: 'Input',
      fieldName: 'realName',
      label: $t('system.user.realName'),
      rules: z
        .string()
        .min(2, $t('ui.formRules.minLength', [$t('system.user.realName'), 2]))
        .max(
          30,
          $t('ui.formRules.maxLength', [$t('system.user.realName'), 30]),
        ),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: getRoleOptions,
        mode: 'multiple',
      },
      fieldName: 'roleIds',
      label: $t('system.user.roles'),
      rules: 'required',
    },
    {
      component: 'ApiTreeSelect',
      componentProps: {
        allowClear: true,
        api: getDeptList,
        childrenField: 'children',
        labelField: 'name',
        valueField: 'id',
      },
      fieldName: 'deptId',
      label: $t('system.user.dept'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '/analytics',
      },
      defaultValue: '/analytics',
      fieldName: 'homePath',
      label: $t('system.user.homePath'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: 'Asia/Shanghai',
      },
      defaultValue: 'Asia/Shanghai',
      fieldName: 'timezone',
      label: $t('system.user.timezone'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: statusOptions,
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.user.status'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('system.user.username'),
    },
    {
      component: 'Input',
      fieldName: 'realName',
      label: $t('system.user.realName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusOptions,
      },
      fieldName: 'status',
      label: $t('system.user.status'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getRoleOptions,
      },
      fieldName: 'roleId',
      label: $t('system.user.roles'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('system.user.createTime'),
    },
  ];
}
