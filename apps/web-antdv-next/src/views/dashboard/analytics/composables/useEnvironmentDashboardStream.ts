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

export function useEnvironmentDashboardStream(
  options: UseEnvironmentDashboardStreamOptions,
) {
  const connectionState = ref<EnvironmentStreamConnectionState>('idle');
  const lastEventId = ref<string>();
  let source: EventSource | undefined;

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

  function handleOpen() {
    connectionState.value = 'open';
  }

  function handleEnvironmentEvent(event: Event) {
    const payload = parseStreamEvent(event);
    if (!payload) return;
    rememberEventId(payload);
    options.onEnvironmentEvent(payload);
  }

  function handleEnvironmentSignal(event: Event) {
    const payload = parseStreamEvent(event);
    if (!payload) return;
    rememberEventId(payload);
    options.onEnvironmentSignal(payload);
  }

  function handleSnapshotRequired(event: Event) {
    const payload = parseStreamEvent(event);
    if (!payload) return;
    rememberEventId(payload);
    options.onSnapshotRequired(payload);
  }

  function handleHeartbeat() {
    if (connectionState.value === 'connecting') {
      connectionState.value = 'open';
    }
  }

  function handleError(event: Event) {
    connectionState.value = 'error';
    const payload = parseStreamEvent(event);
    if (payload) {
      rememberEventId(payload);
      options.onError?.(payload);
    }
  }

  function parseStreamEvent(event: Event) {
    const data = (event as MessageEvent<string>).data;
    if (!data) return undefined;
    try {
      return JSON.parse(data) as StreamEvent;
    } catch {
      return undefined;
    }
  }

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
