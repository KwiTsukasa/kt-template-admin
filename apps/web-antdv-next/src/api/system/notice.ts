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

/**
 * 根据关键词、严重程度、状态、来源、事件类型和分页条件读取系统通知。
 *
 * @param params - 通知关键词、严重程度、状态、来源、事件类型和分页条件。
 * @returns 包含通知正文、来源、严重程度、状态和总数的分页结果。
 */
async function getNoticeList(params: Recordable<any>) {
  return requestClient.get<
    SystemNoticeApi.PageResult<SystemNoticeApi.NoticeItem>
  >('/system/notice/list', { params });
}

/**
 * 根据通知标识读取正文、来源、发生次数、元数据与处理状态。
 *
 * @param id - 需要加载正文、元数据和出现次数的通知标识。
 * @returns 指定通知的正文、来源、严重程度、发生次数、元数据和处理状态。
 */
async function getNoticeDetail(id: string) {
  return requestClient.get<SystemNoticeApi.NoticeItem>(
    `/system/notice/detail/${id}`,
  );
}

/**
 * 根据通知标识删除系统通知，使其不再出现在管理列表。
 *
 * @param id - 需要删除的系统通知标识。
 * @returns 通知删除接口返回的确认数据。
 */
async function deleteNotice(id: string) {
  return requestClient.delete(`/system/notice/${id}`);
}

/**
 * 把指定系统通知切换到目标处理状态。
 *
 * @param id - 需要变更已读或启用状态的系统通知标识。
 * @param status - 系统通知目标处理状态；1 与 0 的含义沿用通知接口约定。
 * @returns 通知状态切换接口返回的确认数据。
 */
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

/**
 * 把指定系统通知切换为置顶或取消置顶。
 *
 * @param id - 需要置顶或取消置顶的系统通知标识。
 * @param isTop - 通知目标置顶状态；true 表示置顶。
 * @returns 通知置顶状态切换接口返回的确认数据。
 */
async function toggleNoticeTop(id: string, isTop: boolean) {
  return requestClient.post('/system/notice/top', undefined, {
    params: {
      id,
      isTop: (() => {
        if (isTop) {
          return 1;
        }
        return 0;
      })(),
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
