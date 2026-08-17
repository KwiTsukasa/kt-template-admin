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
 * 按筛选参数从后端读取系统用户记录。
 *
 * @param params - 列表接口接收的筛选与分页字段。
 * @returns 符合筛选条件的系统用户记录数组。
 */
async function getUserList(params: Recordable<any>) {
  return requestClient.get<Array<SystemUserApi.SystemUser>>(
    '/system/user/list',
    { params },
  );
}

/**
 * 将账号、资料、角色、状态与初始密码保存为新用户。
 *
 * @param data - 新用户的账号、资料、角色、状态与初始密码。
 * @returns 用户创建请求的服务端响应。
 */
async function createUser(data: SystemUserApi.SystemUserCreateInput) {
  return requestClient.post('/system/user', data);
}

/**
 * 根据用户标识保存资料、角色与状态变更。
 *
 * @param id - 目标系统用户的唯一标识。
 * @param data - 现有用户要保存的资料、角色与状态字段。
 * @returns 用户更新请求的服务端响应。
 */
async function updateUser(id: string, data: SystemUserApi.SystemUserInput) {
  return requestClient.put(`/system/user/${id}`, data);
}

/**
 * 根据用户标识把登录密码替换为表单提供的新密码。
 *
 * @param id - 目标系统用户的唯一标识。
 * @param data - 目标用户的新密码字段。
 * @returns 密码重置请求的服务端响应。
 */
async function resetUserPassword(
  id: string,
  data: SystemUserApi.SystemUserPasswordResetInput,
) {
  return requestClient.put(`/system/user/${id}/password`, data);
}

/**
 * 根据用户标识删除对应系统用户。
 *
 * @param id - 目标系统用户的唯一标识。
 * @returns 用户删除请求的服务端响应。
 */
async function deleteUser(id: string) {
  return requestClient.delete(`/system/user/${id}`);
}

export { createUser, deleteUser, getUserList, resetUserPassword, updateUser };
