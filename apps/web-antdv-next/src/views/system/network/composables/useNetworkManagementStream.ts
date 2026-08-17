import type { SystemNetworkApi } from '#/api/system/network';

import { ref } from 'vue';

import { getNetworkManagementEventsUrl } from '#/api/system/network';

export interface UseNetworkManagementStreamOptions {
  onSnapshotRequired: () => void;
  onStateChanged: (event: SystemNetworkApi.StateChangeEvent) => void;
}

/**
 * 建立网络管理 SSE 连接并把有效状态事件及快照补偿通知交给调用方，重复启动复用现有连接。
 *
 * @param options - 网络状态变更与要求重载完整快照时分别执行的回调。
 * @returns 包含启动与关闭方法的网络管理事件流控制器。
 */
export function useNetworkManagementStream(
  options: UseNetworkManagementStreamOptions,
) {
  const lastEventId = ref<string>();
  let source: EventSource | undefined;

  /**
   * 建立带凭据的网络管理 SSE 连接并注册状态变化与快照补偿监听；重复启动保持现有连接。
   */
  function start() {
    if (source) return;
    source = new EventSource(getNetworkManagementEventsUrl(lastEventId.value), {
      withCredentials: true,
    });
    source.addEventListener('network-state-changed', handleStateChanged);
    source.addEventListener('snapshot-required', handleSnapshotRequired);
  }

  /**
   * 移除网络管理 SSE 监听并关闭连接，随后清空连接引用。
   */
  function close() {
    if (!source) return;
    source.removeEventListener('network-state-changed', handleStateChanged);
    source.removeEventListener('snapshot-required', handleSnapshotRequired);
    source.close();
    source = undefined;
  }

  /**
   * 解析并去重网络状态 SSE 事件，记录最新事件标识后通知调用方。
   *
   * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
   */
  function handleStateChanged(event: Event) {
    const payload = parseStateChange(event);
    if (!payload || payload.eventId === lastEventId.value) return;
    lastEventId.value = payload.eventId;
    options.onStateChanged(payload);
  }

  /**
   * 当收到网络状态快照补偿信号时，通知页面重新加载完整数据。
   */
  function handleSnapshotRequired() {
    options.onSnapshotRequired();
  }

  /**
   * 解析并校验网络 SSE 状态事件，缺少事件标识、时间或合法来源时返回 undefined。
   *
   * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
   * @returns 字段完整且来源合法的网络状态事件；载荷无效时返回 undefined。
   */
  function parseStateChange(
    event: Event,
  ): SystemNetworkApi.StateChangeEvent | undefined {
    const data = (event as MessageEvent<string>).data;
    if (!data) return undefined;
    try {
      const payload = JSON.parse(
        data,
      ) as Partial<SystemNetworkApi.StateChangeEvent>;
      if (
        !payload.eventId ||
        !payload.observedAt ||
        !['ddns', 'events', 'reported', 'status'].includes(payload.source || '')
      ) {
        return undefined;
      }
      return payload as SystemNetworkApi.StateChangeEvent;
    } catch {
      return undefined;
    }
  }

  return { close, start };
}
