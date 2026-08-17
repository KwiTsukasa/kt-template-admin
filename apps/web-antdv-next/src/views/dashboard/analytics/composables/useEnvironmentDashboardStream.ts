import type { EnvironmentDashboardApi } from '#/api/system/environment';

import { ref } from 'vue';

import { getEnvironmentDashboardEventsUrl } from '#/api/system/environment';

type StreamEvent = EnvironmentDashboardApi.EnvironmentEvent;

export type EnvironmentStreamConnectionState =
  | 'closed'
  | 'connecting'
  | 'error'
  | 'idle'
  | 'open';

export interface UseEnvironmentDashboardStreamOptions {
  onEnvironmentEvent: (event: StreamEvent) => void;
  onEnvironmentSignal: (event: StreamEvent) => void;
  onError?: (event: StreamEvent) => void;
  onSnapshotRequired: (event: StreamEvent) => void;
}

/**
 * 管理环境总览 SSE 连接状态与续传标识，并把业务事件、信号和快照补偿分发给调用方。
 *
 * @param options - 分别接收环境事件、信号、快照刷新和可选错误事件的回调集合。
 * @returns 包含连接状态以及启动、关闭方法的环境事件流控制器。
 */
export function useEnvironmentDashboardStream(
  options: UseEnvironmentDashboardStreamOptions,
) {
  const connectionState = ref<EnvironmentStreamConnectionState>('idle');
  const lastEventId = ref<string>();
  let source: EventSource | undefined;

  /**
   * 建立带凭据的环境总览 SSE 连接并注册业务事件、快照补偿、心跳与错误监听；重复启动保持现有连接。
   */
  function start() {
    if (source) return;
    connectionState.value = 'connecting';
    source = new EventSource(
      getEnvironmentDashboardEventsUrl(lastEventId.value),
      {
        withCredentials: true,
      },
    );
    source.addEventListener('open', handleOpen);
    source.addEventListener('environment-event', handleEnvironmentEvent);
    source.addEventListener('environment-signal', handleEnvironmentSignal);
    source.addEventListener('snapshot-required', handleSnapshotRequired);
    source.addEventListener('heartbeat', handleHeartbeat);
    source.addEventListener('error', handleError);
  }

  /**
   * 移除环境总览 SSE 的全部监听并关闭连接，随后把连接状态标记为已关闭。
   */
  function close() {
    if (!source) return;
    source.removeEventListener('open', handleOpen);
    source.removeEventListener('environment-event', handleEnvironmentEvent);
    source.removeEventListener('environment-signal', handleEnvironmentSignal);
    source.removeEventListener('snapshot-required', handleSnapshotRequired);
    source.removeEventListener('heartbeat', handleHeartbeat);
    source.removeEventListener('error', handleError);
    source.close();
    source = undefined;
    connectionState.value = 'closed';
  }

  /**
   * 事件流建立后把连接状态标记为已打开。
   */
  function handleOpen() {
    connectionState.value = 'open';
  }

  /**
   * 解析环境事件流消息、记录续传标识，并把有效载荷交给业务事件回调。
   *
   * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
   */
  function handleEnvironmentEvent(event: Event) {
    const payload = parseStreamEvent(event);
    if (!payload) return;
    rememberEventId(payload);
    options.onEnvironmentEvent(payload);
  }

  /**
   * 解析环境信号流消息、记录续传标识，并把有效载荷交给信号回调。
   *
   * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
   */
  function handleEnvironmentSignal(event: Event) {
    const payload = parseStreamEvent(event);
    if (!payload) return;
    rememberEventId(payload);
    options.onEnvironmentSignal(payload);
  }

  /**
   * 解析快照补偿消息、记录续传标识，并通知页面重新拉取完整快照。
   *
   * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
   */
  function handleSnapshotRequired(event: Event) {
    const payload = parseStreamEvent(event);
    if (!payload) return;
    rememberEventId(payload);
    options.onSnapshotRequired(payload);
  }

  /**
   * 收到心跳时把仍处于连接中的事件流确认成已打开状态。
   */
  function handleHeartbeat() {
    if (connectionState.value === 'connecting') {
      connectionState.value = 'open';
    }
  }

  /**
   * 把事件流标记为错误，并将可解析的错误载荷记录后交给外部回调。
   *
   * @param event - 环境 SSE 连接触发的原始错误事件。
   */
  function handleError(event: Event) {
    connectionState.value = 'error';
    const payload = parseStreamEvent(event);
    if (payload) {
      rememberEventId(payload);
      options.onError?.(payload);
    }
  }

  /**
   * 通过解析环境总览 SSE 消息，空数据或非法 JSON 返回 undefined。
   *
   * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
   * @returns 解析成功的环境 SSE 事件；消息为空或 JSON 非法时返回 undefined。
   */
  function parseStreamEvent(event: Event) {
    const data = (event as MessageEvent<string>).data;
    if (!data) return undefined;
    try {
      return JSON.parse(data) as StreamEvent;
    } catch {
      return undefined;
    }
  }

  /**
   * 保存最近处理的 SSE 事件标识，并忽略空值与已经见过的事件。
   *
   * @param event - 可能携带 lastEventId、需要参与去重的 SSE 消息事件。
   */
  function rememberEventId(event: StreamEvent) {
    if (event.eventId) {
      lastEventId.value = event.eventId;
    }
  }

  return {
    close,
    connectionState,
    start,
  };
}
