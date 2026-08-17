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

/**
 * 读取最多一千个启用角色，并转换为名称和标识选项。
 *
 * @returns 由角色记录转换得到的标签和值选项数组。
 */
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

/**
 * 创建系统用户密码校验规则，供表单检查必填值与 UTF-8 字节上限。
 *
 * @param requiredMessage - 密码缺失时向表单调用方展示的错误信息。
 * @returns 要求非空且不超过系统 UTF-8 字节上限的 Zod 字符串规则。
 */
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

/**
 * 通过非空检查与 UTF-8 字节计数校验用户密码，超过后端上限时拒绝提交。
 *
 * @param password - 待校验的用户密码原始值。
 * @param requiredMessage - 密码缺失时向表单调用方展示的错误信息。
 * @returns 通过非空与字节长度校验的密码字符串。
 * @throws 密码不是非空字符串，或 UTF-8 字节数超过系统上限时抛出。
 */
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

/**
 * 只提取可编辑用户字段，并按新建或更新模式组装创建密码及可选重置密码载荷。
 *
 * @param values - 用户表单的账号、姓名、部门、角色、状态、时区及密码重置字段。
 * @param id - 正在编辑的用户标识；缺省时按新建模式要求密码。
 * @returns 新建时返回含必填密码的创建载荷；编辑时返回含可选密码重置的更新载荷。
 */
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
    passwordReset: (() => {
      if (values.resetPassword) {
        return {
          password: assertFormPassword(values.password, '请输入新密码'),
        };
      }
      return undefined;
    })(),
    user,
  };
}

/**
 * 按新建或编辑模式生成用户表单；新建要求密码，编辑时仅在勾选重置后显示并校验新密码。
 *
 * @param isEditing - 当前表单是否处于编辑已有记录模式；未传入时使用 `false`。
 * @returns 与新建或编辑模式对应的用户表单字段 Schema 列表。
 */
export function useFormSchema(isEditing = false): VbenFormSchema[] {
  const passwordFields: VbenFormSchema[] = (() => {
    if (isEditing) {
      return [
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
            /**
             * 仅在勾选重置密码时返回新密码校验规则，否则不启用该字段规则。
             *
             * @param values - 包含 resetPassword 开关的用户表单字段，用于决定是否启用新密码校验。
             * @returns 勾选重置密码时为新密码校验规则，否则返回 null。
             */
            rules(values) {
              if (values.resetPassword) {
                return createPasswordRule('请输入新密码');
              }
              return null;
            },
            /**
             * 仅在勾选重置密码时显示新密码字段。
             *
             * @param values - 包含 resetPassword 开关的用户表单字段，用于决定是否显示新密码输入。
             * @returns 勾选重置密码时返回 true，否则返回 false。
             */
            show(values) {
              return !!values.resetPassword;
            },
            triggerFields: ['resetPassword'],
          },
          fieldName: 'password',
          label: $t('system.user.password'),
        },
      ];
    }
    return [
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
  })();

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

/**
 * 生成用户列表的账号、姓名、状态、角色与创建时间字段，供搜索表单直接渲染。
 *
 * @returns 可直接渲染用户搜索表单的字段 Schema 列表。
 */
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
