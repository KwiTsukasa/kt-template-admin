import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace MediaScrapeValidationApi {
  export type Status = 'healthy' | 'issues' | 'pending' | 'running';

  export interface Issue {
    code: string;
    message: string;
    scope: string;
    severity: 'error' | 'warning';
  }

  export interface RecordItem {
    completedAt: null | string;
    evidenceSha256: null | string;
    governanceRevision: number;
    governanceSnapshot: Record<string, unknown>;
    id: string;
    identitySnapshot: Record<string, unknown>;
    issues: Issue[];
    mediaType: string;
    reason: null | string;
    requestedAt: string;
    revision: number;
    seriesId: null | string;
    startedAt: null | string;
    status: Status;
    statusLabel: string;
    taskId: string;
    title: string;
    workId: null | string;
  }

  export interface PageQuery extends Recordable<any> {
    keyword?: string;
    pageNo?: number;
    pageSize?: number;
    status?: Status;
  }

  export interface PageResult {
    items: RecordItem[];
    total: number;
  }
}

/**
 * 按状态、关键词与分页参数读取独立 NAS 刮削校验记录。
 * @param params - 刮削校验列表筛选和分页参数。
 * @returns 当前页校验记录和总数。
 */
export function getMediaScrapeValidationPage(
  params: MediaScrapeValidationApi.PageQuery,
) {
  return requestClient.get<MediaScrapeValidationApi.PageResult>(
    '/media-scrape-validation/page',
    { params },
  );
}

/**
 * 将指定记录重新排入 NAS 刮削校验队列。
 * @param validationId - 独立刮削校验记录标识。
 * @param expectedRevision - 调用方已读取的记录修订号。
 * @returns 重新排队后的校验记录。
 */
export function recheckMediaScrapeValidation(
  validationId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaScrapeValidationApi.RecordItem>(
    `/media-scrape-validation/${validationId}/recheck`,
    { expectedRevision },
  );
}
