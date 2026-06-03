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

async function getDictList(params: Recordable<any>) {
  return requestClient.get<SystemDictApi.PageResult<SystemDictApi.DictItem>>(
    '/dict/list',
    { params },
  );
}

async function getDictTree(params: Recordable<any>) {
  return requestClient.get<SystemDictApi.DictTreeItem[]>('/dict/tree', {
    params,
  });
}

async function getDictGroups(params: Recordable<any>) {
  return requestClient.get<SystemDictApi.PageResult<SystemDictApi.DictGroup>>(
    '/dict/groups',
    { params },
  );
}

async function getDictCodeOptions() {
  return requestClient.get<SystemDictApi.DictCodeOption[]>('/dict/codes');
}

async function createDict(data: SystemDictApi.DictInput) {
  return requestClient.post<string>('/dict/save', data);
}

async function updateDict(id: string, data: Partial<SystemDictApi.DictInput>) {
  return requestClient.post('/dict/update', {
    ...data,
    id,
  });
}

async function deleteDict(id: string) {
  return requestClient.delete(`/dict/${id}`);
}

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
