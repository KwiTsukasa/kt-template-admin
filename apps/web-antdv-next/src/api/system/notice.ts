import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemNoticeApi {
  export interface BatchReadResult {
    updated: number;
  }

  export interface EventStreamInput {
    lastEventId?: string;
    onMessage: (chunk: string) => void;
    signal: AbortSignal;
  }

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

  export interface UnreadCountResult {
    count: number;
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
 * 读取当前消息中心的未读站内信数量，作为顶部铃铛 Badge 的权威值。
 *
 * @returns 包含当前未读站内信数量的结果。
 */
async function getNoticeUnreadCount() {
  return requestClient.get<SystemNoticeApi.UnreadCountResult>(
    '/system/notice/unread-count',
  );
}

/**
 * 使用请求客户端的 Bearer 拦截器建立站内信 SSE 长连接，并逐块交给调用方解析。
 *
 * @param input - 包含取消信号、原始数据块回调和可选断线游标的连接参数。
 * @returns SSE 会话结束时完成的 Promise。
 */
async function openNoticeEventStream(input: SystemNoticeApi.EventStreamInput) {
  const headers: Record<string, string> = {};
  if (input.lastEventId) {
    headers['Last-Event-ID'] = input.lastEventId;
  }
  return requestClient.requestSSE('/system/notice/events/stream', undefined, {
    headers,
    onMessage: input.onMessage,
    signal: input.signal,
  });
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
 * 用一次请求把所选站内信中仍为未读的记录批量标记为已读。
 *
 * @param ids - 需要标记已读的 1–100 个唯一站内信标识。
 * @returns 实际从未读更新为已读的记录数量。
 */
async function markNoticesRead(ids: string[]) {
  return requestClient.post<SystemNoticeApi.BatchReadResult>(
    '/system/notice/read/batch',
    { ids },
  );
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
  getNoticeUnreadCount,
  markNoticesRead,
  openNoticeEventStream,
  toggleNoticeStatus,
  toggleNoticeTop,
};
