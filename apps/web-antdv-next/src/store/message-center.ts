import { ref } from 'vue';

import { defineStore } from 'pinia';

import {
  getNoticeUnreadCount,
  openNoticeEventStream,
} from '#/api/system/notice';

const RECONNECT_DELAYS = [1000, 2000, 5000, 10_000, 30_000] as const;

interface ParsedNoticeEvent {
  id: string;
  type: string;
}

export const useMessageCenterStore = defineStore('message-center', () => {
  const unreadCount = ref(0);
  const changeRevision = ref(0);
  const connected = ref(false);

  let active = false;
  let lastEventId = '';
  let reconnectAttempt = 0;
  let reconnectTimer: null | number = null;
  let refreshSequence = 0;
  let streamBuffer = '';
  let streamController: AbortController | null = null;

  /**
   * 从后端读取权威未读数，并仅让最后一次并发请求更新 Badge。
   *
   * @returns 本次未读数请求成功且结果已写入时返回 true。
   */
  async function refreshUnreadCount(): Promise<boolean> {
    const sequence = ++refreshSequence;
    try {
      const result = await getNoticeUnreadCount();
      if (sequence !== refreshSequence) return false;
      unreadCount.value = Math.max(0, Number(result.count) || 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 把一个完整 SSE 文本块解析为事件类型与业务游标，注释或不完整事件返回 null。
   *
   * @param block - 已去除双换行边界的 SSE 文本块。
   * @returns 可驱动消息中心刷新的事件元数据；无有效事件类型时返回 null。
   */
  function parseEventBlock(block: string): null | ParsedNoticeEvent {
    let id = '';
    let type = '';
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('id:')) {
        id = line.slice(3).trim();
      }
      if (line.startsWith('event:')) {
        type = line.slice(6).trim();
      }
    }
    if (!type) return null;
    return { id, type };
  }

  /**
   * 消费一个已解析站内信事件，推进重连游标并触发未读数和列表刷新版本。
   *
   * @param event - 从 SSE 文本中解析出的事件类型与业务游标。
   */
  function applyStreamEvent(event: ParsedNoticeEvent): void {
    if (event.type !== 'notice-changed' && event.type !== 'snapshot-required') {
      return;
    }
    connected.value = true;
    reconnectAttempt = 0;
    if (event.type === 'notice-changed' && event.id) {
      lastEventId = event.id;
    }
    changeRevision.value += 1;
    void refreshUnreadCount();
  }

  /**
   * 累积 fetch 流式数据块，并按 SSE 双换行边界逐条解析，兼容事件跨网络块拆分。
   *
   * @param chunk - 请求客户端交付的原始 UTF-8 SSE 文本片段。
   */
  function consumeStreamChunk(chunk: string): void {
    streamBuffer += chunk;
    let boundary = /\r?\n\r?\n/.exec(streamBuffer);
    while (boundary?.index !== undefined) {
      const block = streamBuffer.slice(0, boundary.index);
      streamBuffer = streamBuffer.slice(boundary.index + boundary[0].length);
      const event = parseEventBlock(block);
      if (event) {
        applyStreamEvent(event);
      }
      boundary = /\r?\n\r?\n/.exec(streamBuffer);
    }
  }

  /**
   * 把流式请求异常收敛为是否属于本 Store 的 AbortController 主动取消语义。
   *
   * @param error - fetch 流式请求抛出的未知异常。
   * @returns 异常名称为 AbortError 时返回 true。
   */
  function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }

  /**
   * 按有上限的退避间隔安排下一次连接，避免服务不可用时形成高频请求。
   */
  function scheduleReconnect(): void {
    if (!active || reconnectTimer !== null) return;
    const delayIndex = Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1);
    let delay = RECONNECT_DELAYS[delayIndex];
    if (delay === undefined) {
      delay = 30_000;
    }
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      void reconnect();
    }, delay);
  }

  /**
   * 重连前通过普通鉴权请求校准未读数并触发令牌刷新，然后重新建立 SSE。
   */
  async function reconnect(): Promise<void> {
    await refreshUnreadCount();
    if (!active) return;
    void runStream();
  }

  /**
   * 保证同一时刻只持有一个鉴权 SSE 控制器，并让正常结束或非主动异常进入统一退避。
   */
  async function runStream(): Promise<void> {
    if (!active || streamController) return;
    const controller = new AbortController();
    streamController = controller;
    streamBuffer = '';
    const streamInput = {
      onMessage: consumeStreamChunk,
      signal: controller.signal,
    } as {
      lastEventId?: string;
      onMessage: (chunk: string) => void;
      signal: AbortSignal;
    };
    if (lastEventId) {
      streamInput.lastEventId = lastEventId;
    }
    try {
      await openNoticeEventStream(streamInput);
    } catch (error) {
      if (!isAbortError(error)) {
        connected.value = false;
      }
    } finally {
      if (streamController === controller) {
        streamController = null;
      }
    }
    scheduleReconnect();
  }

  /**
   * 初始化未读数并启动共享长连接；重复调用保持同一条 SSE 会话。
   */
  async function start(): Promise<void> {
    if (active) return;
    active = true;
    await refreshUnreadCount();
    if (!active) return;
    void runStream();
  }

  /**
   * 取消当前 SSE 与待执行重连，保留最后未读数供布局卸载过程稳定渲染。
   */
  function stop(): void {
    active = false;
    connected.value = false;
    streamController?.abort();
    streamController = null;
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  /**
   * 退出会话时终止长连接并清空消息中心的用户态数据与业务游标。
   */
  function $reset(): void {
    stop();
    unreadCount.value = 0;
    changeRevision.value = 0;
    lastEventId = '';
    reconnectAttempt = 0;
    refreshSequence = 0;
    streamBuffer = '';
  }

  return {
    $reset,
    changeRevision,
    connected,
    refreshUnreadCount,
    start,
    stop,
    unreadCount,
  };
});
