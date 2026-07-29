import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemUserApi {
  export const PASSWORD_MAX_BYTES = 128;

  export interface SystemUser {
    createTime?: string;
    dept?: null | {
      id: string;
      name: string;
    };
    deptId?: null | string;
    deptName?: string;
    homePath: string;
    id: string;
    realName: string;
    roleIds: string[];
    roleNames: string[];
    roles?: Array<{
      id: string;
      name: string;
      roleCode: string;
      status: 0 | 1;
    }>;
    status: 0 | 1;
    timezone: string;
    updateTime?: string;
    username: string;
  }

  export type SystemUserInput = Partial<Omit<SystemUser, 'id' | 'roles'>> & {
    roleIds?: string[];
  };

  export type SystemUserCreateInput = SystemUserInput & {
    password: string;
    realName: string;
    username: string;
  };

  export interface SystemUserPasswordResetInput {
    password: string;
  }
}

/**
 * 获取用户列表数据
 * @param params 用户查询参数
 */
async function getUserList(params: Recordable<any>) {
  return requestClient.get<Array<SystemUserApi.SystemUser>>(
    '/system/user/list',
    { params },
  );
}

/**
 * 创建用户
 * @param data 用户数据
 */
async function createUser(data: SystemUserApi.SystemUserCreateInput) {
  return requestClient.post('/system/user', data);
}

/**
 * 更新用户
 * @param id 用户 ID
 * @param data 用户数据
 */
async function updateUser(id: string, data: SystemUserApi.SystemUserInput) {
  return requestClient.put(`/system/user/${id}`, data);
}

/**
 * 重置用户密码
 * @param id 用户 ID
 * @param data 新密码
 */
async function resetUserPassword(
  id: string,
  data: SystemUserApi.SystemUserPasswordResetInput,
) {
  return requestClient.put(`/system/user/${id}/password`, data);
}

/**
 * 删除用户
 * @param id 用户 ID
 */
async function deleteUser(id: string) {
  return requestClient.delete(`/system/user/${id}`);
}

export { createUser, deleteUser, getUserList, resetUserPassword, updateUser };
