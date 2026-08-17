import { requestClient } from '#/api/request';

export namespace SystemDeptApi {
  export interface SystemDept {
    [key: string]: any;
    children?: SystemDept[];
    id: string;
    name: string;
    remark?: string;
    status: 0 | 1;
  }
}

/**
 * 从后端读取完整部门树列表。
 *
 * @returns 后端返回的完整部门记录数组。
 */
async function getDeptList() {
  return requestClient.get<Array<SystemDeptApi.SystemDept>>(
    '/system/dept/list',
  );
}

/**
 * 将部门名称、父级、排序和状态保存为新记录。
 *
 * @param data - 部门名称、父级、排序和状态字段。
 * @returns 部门创建请求的服务端响应。
 */
async function createDept(
  data: Omit<SystemDeptApi.SystemDept, 'children' | 'id'>,
) {
  return requestClient.post('/system/dept', data);
}

/**
 * 根据部门标识保存名称、父级、排序和状态变更。
 *
 * @param id - 目标部门的唯一标识。
 * @param data - 部门名称、父级、排序和状态字段。
 * @returns 部门更新请求的服务端响应。
 */
async function updateDept(
  id: string,
  data: Omit<SystemDeptApi.SystemDept, 'children' | 'id'>,
) {
  return requestClient.put(`/system/dept/${id}`, data);
}

/**
 * 根据部门标识删除对应组织节点。
 *
 * @param id - 目标部门的唯一标识。
 * @returns 部门删除请求的服务端响应。
 */
async function deleteDept(id: string) {
  return requestClient.delete(`/system/dept/${id}`);
}

export { createDept, deleteDept, getDeptList, updateDept };
