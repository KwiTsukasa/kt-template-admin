import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemRoleApi {
  export interface SystemRole {
    [key: string]: any;
    id: string;
    name: string;
    permissions: string[];
    remark?: string;
    status: 0 | 1;
  }
}

/**
 * 按筛选参数从后端读取角色记录。
 *
 * @param params - 列表接口接收的筛选与分页字段。
 * @returns 符合筛选条件的角色记录数组。
 */
async function getRoleList(params: Recordable<any>) {
  return requestClient.get<Array<SystemRoleApi.SystemRole>>(
    '/system/role/list',
    { params },
  );
}

/**
 * 将名称、角色标识、状态与权限保存为新角色。
 *
 * @param data - 角色名称、标识、状态、备注与权限字段。
 * @returns 角色创建请求的服务端响应。
 */
async function createRole(data: Omit<SystemRoleApi.SystemRole, 'id'>) {
  return requestClient.post('/system/role', data);
}

/**
 * 根据角色标识保存名称、状态、备注与权限变更。
 *
 * @param id - 目标角色的唯一标识。
 * @param data - 角色名称、标识、状态、备注与权限字段。
 * @returns 角色更新请求的服务端响应。
 */
async function updateRole(
  id: string,
  data: Omit<SystemRoleApi.SystemRole, 'id'>,
) {
  return requestClient.put(`/system/role/${id}`, data);
}

/**
 * 根据角色标识删除对应角色。
 *
 * @param id - 目标角色的唯一标识。
 * @returns 角色删除请求的服务端响应。
 */
async function deleteRole(id: string) {
  return requestClient.delete(`/system/role/${id}`);
}

export { createRole, deleteRole, getRoleList, updateRole };
