import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemUserApi {
  export interface SystemUser {
    [key: string]: any;
    createTime?: string;
    dept?: null | {
      id: string;
      name: string;
    };
    deptId?: null | string;
    deptName?: string;
    homePath: string;
    id: string;
    password?: string;
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
async function createUser(data: SystemUserApi.SystemUserInput) {
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
 * 删除用户
 * @param id 用户 ID
 */
async function deleteUser(id: string) {
  return requestClient.delete(`/system/user/${id}`);
}

export { createUser, deleteUser, getUserList, updateUser };
