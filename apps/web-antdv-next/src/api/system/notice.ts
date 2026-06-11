import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemNoticeApi {
  export interface NoticeItem {
    [key: string]: any;
    content: string;
    createTime?: string;
    createdBy?: string;
    dedupeKey?: string;
    eventType?: string;
    firstSeenAt?: string;
    id: string;
    isDeleted: boolean;
    isTop: boolean;
    lastSeenAt?: string;
    level: number;
    metadata?: Recordable<any> | string;
    notifyUsers?: string;
    notifyRoleCode?: string;
    occurrenceCount?: number;
    severity?: 'error' | 'fatal' | 'info' | 'warn';
    source?: string;
    status: 0 | 1;
    summary?: string;
    title: string;
    updateTime?: string;
  }

  export interface NoticeQuery {
    [key: string]: any;
    eventType?: string;
    isTop?: boolean | number | string;
    keyword?: string;
    level?: number | string;
    notifyUsers?: string;
    notifyRoleCode?: string;
    page?: number;
    pageNo?: number;
    pageSize?: number;
    severity?: string;
    source?: string;
    status?: 0 | 1 | number | string;
  }

  export interface PageResult<T> {
    items: T[];
    total: number;
  }
}

async function getNoticeList(params: Recordable<any>) {
  return requestClient.get<
    SystemNoticeApi.PageResult<SystemNoticeApi.NoticeItem>
  >('/system/notice/list', { params });
}

async function getNoticeDetail(id: string) {
  return requestClient.get<SystemNoticeApi.NoticeItem>(
    `/system/notice/detail/${id}`,
  );
}

async function deleteNotice(id: string) {
  return requestClient.delete(`/system/notice/${id}`);
}

async function toggleNoticeStatus(
  id: string,
  status: SystemNoticeApi.NoticeItem['status'],
) {
  return requestClient.post('/system/notice/toggle', undefined, {
    params: {
      id,
      status,
    },
  });
}

async function toggleNoticeTop(id: string, isTop: boolean) {
  return requestClient.post('/system/notice/top', undefined, {
    params: {
      id,
      isTop: isTop ? 1 : 0,
    },
  });
}

export {
  deleteNotice,
  getNoticeDetail,
  getNoticeList,
  toggleNoticeStatus,
  toggleNoticeTop,
};
