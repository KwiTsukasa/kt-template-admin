import type { VbenFormSchema } from '#/adapter/form';

import { z } from '#/adapter/form';
import { getDeptList } from '#/api/system/dept';
import { getRoleList } from '#/api/system/role';
import { SystemUserApi } from '#/api/system/user';
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

const editableUserFields = [
  'deptId',
  'homePath',
  'realName',
  'roleIds',
  'status',
  'timezone',
  'username',
] as const;

type SystemUserFormSubmission =
  | {
      mode: 'create';
      user: SystemUserApi.SystemUserCreateInput;
    }
  | {
      mode: 'update';
      passwordReset?: SystemUserApi.SystemUserPasswordResetInput;
      user: SystemUserApi.SystemUserInput;
    };

function createPasswordRule(requiredMessage: string) {
  return z
    .string({ required_error: requiredMessage })
    .min(1, { message: requiredMessage })
    .refine(
      (value) =>
        new TextEncoder().encode(value).byteLength <=
        SystemUserApi.PASSWORD_MAX_BYTES,
      {
        message: `密码不能超过 ${SystemUserApi.PASSWORD_MAX_BYTES} 个 UTF-8 字节`,
      },
    );
}

function assertFormPassword(password: unknown, requiredMessage: string) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error(requiredMessage);
  }
  if (
    new TextEncoder().encode(password).byteLength >
    SystemUserApi.PASSWORD_MAX_BYTES
  ) {
    throw new Error(
      `密码不能超过 ${SystemUserApi.PASSWORD_MAX_BYTES} 个 UTF-8 字节`,
    );
  }
  return password;
}

export function buildSystemUserFormSubmission(
  values: Record<string, any>,
  id?: string,
): SystemUserFormSubmission {
  const editableValues: Record<string, unknown> = {};
  for (const field of editableUserFields) {
    if (values[field] !== undefined) {
      editableValues[field] = values[field];
    }
  }
  const user = editableValues as SystemUserApi.SystemUserInput;

  if (!id) {
    return {
      mode: 'create',
      user: {
        ...user,
        password: assertFormPassword(values.password, '请输入密码'),
        realName: String(user.realName || ''),
        username: String(user.username || ''),
      },
    };
  }

  return {
    mode: 'update',
    passwordReset: values.resetPassword
      ? {
          password: assertFormPassword(values.password, '请输入新密码'),
        }
      : undefined,
    user,
  };
}

export function useFormSchema(isEditing = false): VbenFormSchema[] {
  const passwordFields: VbenFormSchema[] = isEditing
    ? [
        {
          component: 'Switch',
          defaultValue: false,
          fieldName: 'resetPassword',
          label: '重置密码',
        },
        {
          component: 'VbenInputPassword',
          componentProps: {
            placeholder: `请输入新密码（最多 ${SystemUserApi.PASSWORD_MAX_BYTES} 个 UTF-8 字节）`,
          },
          dependencies: {
            rules(values) {
              return values.resetPassword
                ? createPasswordRule('请输入新密码')
                : null;
            },
            show(values) {
              return !!values.resetPassword;
            },
            triggerFields: ['resetPassword'],
          },
          fieldName: 'password',
          label: $t('system.user.password'),
        },
      ]
    : [
        {
          component: 'VbenInputPassword',
          componentProps: {
            placeholder: `请输入密码（最多 ${SystemUserApi.PASSWORD_MAX_BYTES} 个 UTF-8 字节）`,
          },
          fieldName: 'password',
          label: $t('system.user.password'),
          rules: createPasswordRule('请输入密码'),
        },
      ];

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
    ...passwordFields,
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
