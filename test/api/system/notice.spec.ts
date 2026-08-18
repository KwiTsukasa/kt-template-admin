import {
  getNoticeUnreadCount,
  markNoticesRead,
  openNoticeEventStream,
} from '@test-source/apps/web-antdv-next/src/api/system/notice';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
    post: vi.fn(),
    requestSSE: vi.fn(),
  },
}));

describe('system notice api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the unread badge count and marks selected notices with one request', async () => {
    const ids = ['2041700000000300001', '2041700000000300002'];

    await getNoticeUnreadCount();
    await markNoticesRead(ids);

    expect(requestClient.get).toHaveBeenCalledWith(
      '/system/notice/unread-count',
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/system/notice/read/batch',
      { ids },
    );
  });

  it('opens the authenticated request-client SSE with the replay cursor', async () => {
    const controller = new AbortController();
    const onMessage = vi.fn();

    await openNoticeEventStream({
      lastEventId: 'notice-1',
      onMessage,
      signal: controller.signal,
    });

    expect(requestClient.requestSSE).toHaveBeenCalledWith(
      '/system/notice/events/stream',
      undefined,
      {
        headers: { 'Last-Event-ID': 'notice-1' },
        onMessage,
        signal: controller.signal,
      },
    );
  });
});
