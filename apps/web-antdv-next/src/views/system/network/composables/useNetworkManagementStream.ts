import type { SystemNetworkApi } from '#/api/system/network';

import { ref } from 'vue';

import { getNetworkManagementEventsUrl } from '#/api/system/network';

export interface UseNetworkManagementStreamOptions {
  onSnapshotRequired: () => void;
  onStateChanged: (event: SystemNetworkApi.StateChangeEvent) => void;
}

export function useNetworkManagementStream(
  options: UseNetworkManagementStreamOptions,
) {
  const lastEventId = ref<string>();
  let source: EventSource | undefined;

  function start() {
    if (source) return;
    source = new EventSource(getNetworkManagementEventsUrl(lastEventId.value), {
      withCredentials: true,
    });
    source.addEventListener('network-state-changed', handleStateChanged);
    source.addEventListener('snapshot-required', handleSnapshotRequired);
  }

  function close() {
    if (!source) return;
    source.removeEventListener('network-state-changed', handleStateChanged);
    source.removeEventListener('snapshot-required', handleSnapshotRequired);
    source.close();
    source = undefined;
  }

  function handleStateChanged(event: Event) {
    const payload = parseStateChange(event);
    if (!payload || payload.eventId === lastEventId.value) return;
    lastEventId.value = payload.eventId;
    options.onStateChanged(payload);
  }

  function handleSnapshotRequired() {
    options.onSnapshotRequired();
  }

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
