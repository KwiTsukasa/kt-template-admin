import { useMessageCenterStore } from '@test-source/apps/web-antdv-next/src/store/message-center';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getNoticeUnreadCount: vi.fn(),
  openNoticeEventStream: vi.fn(),
}));

vi.mock('#/api/system/notice', () => apiMocks);

describe('message center realtime store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initializes the badge and refreshes it from a split SSE event', async () => {
    apiMocks.getNoticeUnreadCount
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 4 });
    let streamInput:
      | undefined
      | {
          onMessage: (chunk: string) => void;
          signal: AbortSignal;
        };
    apiMocks.openNoticeEventStream.mockImplementation(async (input) => {
      streamInput = input;
      await new Promise<void>((_resolve, reject) => {
        input.signal.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    const store = useMessageCenterStore();

    await store.start();
    expect(store.unreadCount).toBe(3);
    expect(streamInput).toBeDefined();

    streamInput?.onMessage('id: notice-1\nevent: notice-');
    streamInput?.onMessage('changed\ndata: {"reason":"created"}\n\n');

    await vi.waitFor(() => {
      expect(store.unreadCount).toBe(4);
      expect(store.changeRevision).toBe(1);
    });
    store.$reset();
  });

  it('ignores heartbeat events when deciding whether to reload the list', async () => {
    apiMocks.getNoticeUnreadCount.mockResolvedValue({ count: 2 });
    let onMessage: ((chunk: string) => void) | undefined;
    apiMocks.openNoticeEventStream.mockImplementation(async (input) => {
      onMessage = input.onMessage;
      await new Promise<void>((_resolve, reject) => {
        input.signal.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    const store = useMessageCenterStore();

    await store.start();
    onMessage?.('event: heartbeat\ndata: {"message":"alive"}\n\n');

    expect(store.changeRevision).toBe(0);
    expect(apiMocks.getNoticeUnreadCount).toHaveBeenCalledTimes(1);
    store.$reset();
  });
});
