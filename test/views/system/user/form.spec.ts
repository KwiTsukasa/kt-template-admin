import {
  buildSystemUserFormSubmission,
  useFormSchema,
} from '@test-source/apps/web-antdv-next/src/views/system/user/data';
import { describe, expect, it, vi } from 'vitest';

import enSystem from '#/locales/langs/en-US/system.json';
import zhSystem from '#/locales/langs/zh-CN/system.json';

const FORM_SECRET_FIXTURE = 'form-secret-fixture';

vi.mock('#/adapter/form', () => {
  const string = (options: { required_error?: string } = {}) => {
    const checks: Array<{
      check: (value: string) => boolean;
      message: string;
    }> = [];
    const rule = {
      max(maximum: number, config: { message: string }) {
        checks.push({
          check: (value: string) => value.length <= maximum,
          message: config.message,
        });
        return rule;
      },
      min(minimum: number, config: { message: string }) {
        checks.push({
          check: (value: string) => value.length >= minimum,
          message: config.message,
        });
        return rule;
      },
      refine(check: (value: string) => boolean, config: { message: string }) {
        checks.push({ check, message: config.message });
        return rule;
      },
      safeParse(value: unknown) {
        if (typeof value !== 'string') {
          return {
            error: {
              issues: [{ message: options.required_error || '必填' }],
            },
            success: false,
          };
        }
        const failed = checks.find((item) => !item.check(value));
        return failed
          ? {
              error: { issues: [{ message: failed.message }] },
              success: false,
            }
          : { data: value, success: true };
      },
    };
    return rule;
  };
  return { z: { string } };
});

vi.mock('#/api/system/dept', () => ({
  getDeptList: vi.fn(),
}));

vi.mock('#/api/system/role', () => ({
  getRoleList: vi.fn(),
}));

vi.mock('#/api/system/user', () => ({
  SystemUserApi: {
    PASSWORD_MAX_BYTES: 128,
  },
}));

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

describe('system user form password contract', () => {
  it('describes the required create password without advertising a retired default', () => {
    expect(zhSystem.user.passwordPlaceholder).toBe(
      '新增用户必须输入密码；编辑时留空则不修改密码',
    );
    expect(enSystem.user.passwordPlaceholder).toBe(
      'Password is required for new users; leave blank when editing to keep the current password',
    );
  });

  it('requires a password for new users with a Chinese error message', () => {
    const passwordField = useFormSchema(false).find(
      (field) => field.fieldName === 'password',
    );
    const result = (passwordField?.rules as any).safeParse('');

    expect(passwordField?.component).toBe('VbenInputPassword');
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe('请输入密码');
    expect(() =>
      buildSystemUserFormSubmission(
        {
          password: '',
          realName: '新用户',
          roleIds: [],
          username: 'new-user',
        },
        undefined,
      ),
    ).toThrow('请输入密码');
  });

  it('does not include a reset switch for new users', () => {
    expect(
      useFormSchema(false).some((field) => field.fieldName === 'resetPassword'),
    ).toBe(false);
  });

  it('keeps an edited password untouched when reset is not explicit', () => {
    const submission = buildSystemUserFormSubmission(
      {
        password: FORM_SECRET_FIXTURE,
        realName: '新姓名',
        resetPassword: false,
        username: 'admin',
      },
      '1',
    );

    expect(submission).toEqual({
      mode: 'update',
      passwordReset: undefined,
      user: {
        realName: '新姓名',
        username: 'admin',
      },
    });
    expect(JSON.stringify(submission.user)).not.toContain('password');
  });

  it('requires a new password only after explicit reset is enabled', () => {
    const schema = useFormSchema(true);
    const passwordField = schema.find(
      (field) => field.fieldName === 'password',
    );
    const resetField = schema.find(
      (field) => field.fieldName === 'resetPassword',
    );
    const dependencies = passwordField?.dependencies as any;

    expect(resetField?.component).toBe('Switch');
    expect(dependencies.show({ resetPassword: false })).toBe(false);
    expect(dependencies.show({ resetPassword: true })).toBe(true);
    expect(
      dependencies.rules({ resetPassword: true }).safeParse('').error.issues[0]
        .message,
    ).toBe('请输入新密码');
    expect(() =>
      buildSystemUserFormSubmission(
        {
          password: '',
          resetPassword: true,
          username: 'admin',
        },
        '1',
      ),
    ).toThrow('请输入新密码');
  });

  it('returns a separate password-reset payload without repopulating password', () => {
    expect(
      buildSystemUserFormSubmission(
        {
          password: FORM_SECRET_FIXTURE,
          realName: '管理员',
          resetPassword: true,
          username: 'admin',
        },
        '1',
      ),
    ).toEqual({
      mode: 'update',
      passwordReset: {
        password: FORM_SECRET_FIXTURE,
      },
      user: {
        realName: '管理员',
        username: 'admin',
      },
    });
  });

  it('validates the password maximum by UTF-8 bytes', () => {
    const passwordField = useFormSchema(false).find(
      (field) => field.fieldName === 'password',
    );
    const withinLimit = (passwordField?.rules as any).safeParse(
      '密'.repeat(42),
    );
    const overLimit = (passwordField?.rules as any).safeParse('密'.repeat(43));

    expect(withinLimit.success).toBe(true);
    expect(overLimit.success).toBe(false);
    expect(overLimit.error.issues[0].message).toBe(
      '密码不能超过 128 个 UTF-8 字节',
    );
  });
});
