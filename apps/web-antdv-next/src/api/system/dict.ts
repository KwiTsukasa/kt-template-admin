import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemDictApi {
  export interface DictItem {
    [key: string]: any;
    childrenCode?: null | string;
    createTime?: string;
    dictCode: string;
    id: string;
    label: string;
    sort: number;
    status: 0 | 1;
    updateTime?: string;
    value: string;
  }

  export interface DictTreeItem extends DictItem {
    children?: DictTreeItem[];
    treeKey: string;
  }

  export interface DictGroup {
    dictCode: string;
    id: string;
    itemCount: number;
    label: string;
    value: string;
  }

  export type DictInput = Omit<DictItem, 'createTime' | 'id' | 'updateTime'>;

  export interface DictCodeOption {
    label: string;
    value: string;
  }

  export interface PageResult<T> {
    items: T[];
    total: number;
  }
}

/**
 * 根据字典键、标签、值、状态和分页条件读取字典项。
 *
 * @param params - 字典键、标签、值、状态和分页条件。
 * @returns 包含字典键、标签、值、状态和总数的分页结果。
 */
async function getDictList(params: Recordable<any>) {
  return requestClient.get<SystemDictApi.PageResult<SystemDictApi.DictItem>>(
    '/dict/list',
    { params },
  );
}

/**
 * 根据查询条件读取带稳定树键与子节点的字典层级。
 *
 * @param params - 字典键、标签、值与状态条件，用于返回匹配的层级结构。
 * @returns 带稳定树键和可选子节点的字典项数组；没有字典时为空数组。
 */
async function getDictTree(params: Recordable<any>) {
  return requestClient.get<SystemDictApi.DictTreeItem[]>('/dict/tree', {
    params,
  });
}

/**
 * 按查询条件聚合字典编码、标签及条目数量，并返回分页结果。
 *
 * @param params - 字典分组名称、代码、值和分页条件。
 * @returns 包含字典编码、标签、条目数量和总数的分页分组结果。
 */
async function getDictGroups(params: Recordable<any>) {
  return requestClient.get<SystemDictApi.PageResult<SystemDictApi.DictGroup>>(
    '/dict/groups',
    { params },
  );
}

/**
 * 从后端读取字典编码的标签和值，供表单选择。
 *
 * @returns 字典编码对应的标签和值选项数组；没有字典时为空数组。
 */
async function getDictCodeOptions() {
  return requestClient.get<SystemDictApi.DictCodeOption[]>('/dict/codes');
}

/**
 * 创建字典键、标签、值、排序和启用状态，并返回新记录标识。
 *
 * @param data - 新字典项的代码、标签、值、排序、状态和子级代码。
 * @returns 后端为新字典项分配的标识。
 */
async function createDict(data: SystemDictApi.DictInput) {
  return requestClient.post<string>('/dict/save', data);
}

/**
 * 按字典标识合并标签、值、排序或状态字段。
 *
 * @param id - 需要更新的字典项标识。
 * @param data - 待覆盖的字典代码、标签、值、排序、状态或子级代码。
 * @returns 字典项更新接口返回的确认数据。
 */
async function updateDict(id: string, data: Partial<SystemDictApi.DictInput>) {
  return requestClient.post('/dict/update', {
    ...data,
    id,
  });
}

/**
 * 删除指定字典项，并由后端处理所属分组的剩余数据。
 *
 * @param id - 需要删除的字典项标识。
 * @returns 字典项删除接口返回的确认数据。
 */
async function deleteDict(id: string) {
  return requestClient.delete(`/dict/${id}`);
}

/**
 * 把指定字典项切换到启用或停用状态。
 *
 * @param id - 需要变更启用状态的字典项标识。
 * @param status - 字典项目标状态；1 表示启用，0 表示停用。
 * @returns 字典项状态切换接口返回的确认数据。
 */
async function toggleDictStatus(
  id: string,
  status: SystemDictApi.DictItem['status'],
) {
  return requestClient.post('/dict/toggle', undefined, {
    params: {
      id,
      status,
    },
  });
}

export {
  createDict,
  deleteDict,
  getDictCodeOptions,
  getDictGroups,
  getDictList,
  getDictTree,
  toggleDictStatus,
  updateDict,
};
