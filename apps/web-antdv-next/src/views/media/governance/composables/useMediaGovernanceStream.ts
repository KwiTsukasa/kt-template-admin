import type { MediaGovernanceApi } from '#/api/media-governance';

import { ref } from 'vue';

import { getMediaGovernanceEventsUrl } from '#/api/media-governance';

export interface UseMediaGovernanceStreamOptions {
  onAgentConversation?: (
    event: MediaGovernanceApi.AgentConversationEvent,
  ) => void;
  onSnapshotRequired: () => void;
  onTaskChanged: (event: MediaGovernanceApi.TaskChangedEvent) => void;
}

/**
 * 建立可续传的媒体治理事件流并分发已校验事件。
 *
 * @param options - 任务、会话和快照补偿事件的回调集合。
 * @returns 事件流连接状态与主动关闭连接的方法。
 */
export function useMediaGovernanceStream(
  options: UseMediaGovernanceStreamOptions,
) {
  const connected = ref(false);
  const lastEventId = ref<string>();
  let source: EventSource | undefined;

  /**
   * 仅当浏览器支持 `EventSource` 且尚无连接时建立带 Cookie 和续传游标的媒体治理事件流。
   */
  function start() {
    if (source || typeof EventSource === 'undefined') return;
    source = new EventSource(getMediaGovernanceEventsUrl(lastEventId.value), {
      withCredentials: true,
    });
    source.addEventListener('open', handleOpen);
    source.addEventListener('error', handleError);
    source.addEventListener(
      'agent-conversation-changed',
      handleAgentConversation,
    );
    source.addEventListener('task-changed', handleTaskChanged);
    source.addEventListener('snapshot-required', handleSnapshotRequired);
  }

  /**
   * 在关闭媒体治理事件流时移除全部监听器并释放 EventSource。
   */
  function close() {
    if (!source) return;
    source.removeEventListener('open', handleOpen);
    source.removeEventListener('error', handleError);
    source.removeEventListener(
      'agent-conversation-changed',
      handleAgentConversation,
    );
    source.removeEventListener('task-changed', handleTaskChanged);
    source.removeEventListener('snapshot-required', handleSnapshotRequired);
    source.close();
    source = undefined;
    connected.value = false;
  }

  /**
   * 当事件流连接建立时把连接状态切换为 connected。
   */
  function handleOpen() {
    connected.value = true;
  }

  /**
   * 当事件流断开或报错时把连接状态切换为 disconnected。
   */
  function handleError() {
    connected.value = false;
  }

  /**
   * 解析任务变更事件、保存续传游标并通知调用方。
   *
   * @param event - SSE 监听器收到的原始消息事件。
   */
  function handleTaskChanged(event: Event) {
    const payload = parseTaskChanged(event);
    if (!payload) return;
    const cursor = (event as MessageEvent<string>).lastEventId;
    if (cursor) lastEventId.value = cursor;
    options.onTaskChanged(payload);
  }

  /**
   * 校验 Agent 会话事件身份后更新游标并通知调用方。
   *
   * @param event - SSE 监听器收到的原始消息事件。
   */
  function handleAgentConversation(event: Event) {
    const payload =
      parseJsonEvent<MediaGovernanceApi.AgentConversationEvent>(event);
    if (!payload) return;
    if (!payload.taskId) return;
    if (!payload.threadId) return;
    if (!payload.messageId) return;
    if (!Number.isInteger(payload.eventSequence)) return;
    const cursor = (event as MessageEvent<string>).lastEventId;
    if (cursor) lastEventId.value = cursor;
    options.onAgentConversation?.(payload);
  }

  /**
   * 从补偿事件保存最新游标，并通知页面回读完整任务快照。
   *
   * @param event - SSE 监听器收到的原始消息事件。
   */
  function handleSnapshotRequired(event: Event) {
    const cursor = (event as MessageEvent<string>).lastEventId;
    if (cursor) lastEventId.value = cursor;
    options.onSnapshotRequired();
  }

  /**
   * 解析并逐项校验任务变更事件的运行身份与补丁合同。
   *
   * @param event - SSE 监听器收到的原始消息事件。
   * @returns 通过运行身份和任务补丁校验的任务事件；非法事件为 undefined。
   */
  function parseTaskChanged(
    event: Event,
  ): MediaGovernanceApi.TaskChangedEvent | undefined {
    const data = (event as MessageEvent<string>).data;
    if (!data) return undefined;
    try {
      const payload = JSON.parse(
        data,
      ) as Partial<MediaGovernanceApi.TaskChangedEvent>;
      if (!payload.taskId) return undefined;
      if (!payload.observedAt) return undefined;
      if (!payload.updatedAt) return undefined;
      if (!['full', 'progress'].includes(payload.patchMode || '')) {
        return undefined;
      }
      if (!Number.isInteger(payload.revision)) return undefined;
      if (
        !['created', 'deleted', 'source-updated', 'state-updated'].includes(
          payload.changeType || '',
        )
      ) {
        return undefined;
      }
      if (!payload.summary) return undefined;
      if (
        payload.runSequence !== null &&
        !Number.isInteger(payload.runSequence)
      ) {
        return undefined;
      }
      const hasRunSequence = payload.runSequence !== null;
      const hasRunId = payload.runId !== null;
      if (hasRunSequence !== hasRunId) return undefined;
      if (payload.changeType === 'deleted') {
        if (payload.task !== null) return undefined;
      } else {
        if (!payload.task) return undefined;
        if (payload.task.id !== payload.taskId) return undefined;
        if (payload.task.revision !== payload.revision) return undefined;
      }
      if (payload.changeType === 'created') {
        if (!payload.task?.titleHint) return undefined;
        if (!payload.task.identityPreview) return undefined;
        if (!Array.isArray(payload.task.sources)) return undefined;
        if (!Array.isArray(payload.task.units)) return undefined;
      }
      return payload as MediaGovernanceApi.TaskChangedEvent;
    } catch {
      return undefined;
    }
  }

  /**
   * 将事件数据解析为指定结构，非法数据统一视为缺失。
   *
   * @param event - SSE 监听器收到的原始消息事件。
   * @returns 从 MessageEvent.data 解析出的目标结构；非消息事件或非法 JSON 为 undefined。
   */
  function parseJsonEvent<T>(event: Event): T | undefined {
    const data = (event as MessageEvent<string>).data;
    if (!data) return undefined;
    try {
      return JSON.parse(data) as T;
    } catch {
      return undefined;
    }
  }

  return { close, connected, lastEventId, start };
}
