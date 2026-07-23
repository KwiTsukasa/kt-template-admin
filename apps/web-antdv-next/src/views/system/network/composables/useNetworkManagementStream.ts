import type { SystemNetworkApi } from '#/api/system/network';

import { ref } from 'vue';

import { getNetworkManagementEventsUrl } from '#/api/system/network';

export interface UseNetworkManagementStreamOptions {
  onSnapshotRequired: () => void;
  onStateChanged: (event: SystemNetworkApi.StateChangeEvent) => void;
}

/**
 * Bridges API SSE updates into the network page without exposing MQTT credentials.
 * @param options - Page-owned callbacks for committed changes and replay gaps.
 * @returns Idempotent start/close controls for route keep-alive lifecycle hooks.
 */
export function useNetworkManagementStream(
  options: UseNetworkManagementStreamOptions,
) {
  const lastEventId = ref<string>();
  let source: EventSource | undefined;

  /** Starts one EventSource and relies on native reconnect while the page is active. */
  function start() {
    if (source) return;
    source = new EventSource(getNetworkManagementEventsUrl(lastEventId.value), {
      withCredentials: true,
    });
    source.addEventListener('network-state-changed', handleStateChanged);
    source.addEventListener('snapshot-required', handleSnapshotRequired);
  }

  /** Closes the active route stream and removes its typed listeners. */
  function close() {
    if (!source) return;
    source.removeEventListener('network-state-changed', handleStateChanged);
    source.removeEventListener('snapshot-required', handleSnapshotRequired);
    source.close();
    source = undefined;
  }

  /**
   * Applies one committed MQTT-derived state event exactly once.
   * @param event - Browser SSE message containing a safe state-change envelope.
   */
  function handleStateChanged(event: Event) {
    const payload = parseStateChange(event);
    if (!payload || payload.eventId === lastEventId.value) return;
    lastEventId.value = payload.eventId;
    options.onStateChanged(payload);
  }

  /** Requests one fresh snapshot only when the API cannot replay a missed topic event. */
  function handleSnapshotRequired() {
    options.onSnapshotRequired();
  }

  /**
   * Validates the minimum browser payload before it reaches page state.
   * @param event - Typed EventSource message with JSON data.
   * @returns Parsed state event, or undefined for malformed/unexpected data.
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
