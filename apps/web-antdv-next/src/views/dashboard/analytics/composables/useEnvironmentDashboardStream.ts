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
 * Opens one browser EventSource for Admin environment updates after the first HTTP snapshot.
 *
 * @param options Page-owned callbacks that merge SSE payloads into visible state.
 * @returns Controls for starting and closing the stream plus connection state for display.
 */
export function useEnvironmentDashboardStream(
  options: UseEnvironmentDashboardStreamOptions,
) {
  const connectionState = ref<EnvironmentStreamConnectionState>('idle');
  const lastEventId = ref<string>();
  let source: EventSource | undefined;

  /**
   * Starts the SSE connection once and lets the browser handle native reconnects.
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
   * Closes the EventSource when the route leaves or the component unmounts.
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
   * Marks the stream as open after the browser confirms the connection.
   */
  function handleOpen() {
    connectionState.value = 'open';
  }

  /**
   * Applies a backend event entry to the visible event stream.
   *
   * @param event Browser SSE message carrying an EnvironmentEvent JSON payload.
   */
  function handleEnvironmentEvent(event: Event) {
    const payload = parseStreamEvent(event);
    if (!payload) return;
    rememberEventId(payload);
    options.onEnvironmentEvent(payload);
  }

  /**
   * Applies one signal-level update without reloading the dashboard snapshot.
   *
   * @param event Browser SSE message carrying an EnvironmentEvent JSON payload.
   */
  function handleEnvironmentSignal(event: Event) {
    const payload = parseStreamEvent(event);
    if (!payload) return;
    rememberEventId(payload);
    options.onEnvironmentSignal(payload);
  }

  /**
   * Notifies the page that the API replay buffer requires one fresh snapshot.
   *
   * @param event Browser SSE message carrying the replay-gap event envelope.
   */
  function handleSnapshotRequired(event: Event) {
    const payload = parseStreamEvent(event);
    if (!payload) return;
    rememberEventId(payload);
    options.onSnapshotRequired(payload);
  }

  /**
   * Leaves dashboard state unchanged for keepalive events.
   */
  function handleHeartbeat() {
    if (connectionState.value === 'connecting') {
      connectionState.value = 'open';
    }
  }

  /**
   * Records stream errors without starting polling or manual reconnect loops.
   *
   * @param event Optional API error payload when the server sends a typed error event.
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
   * Parses JSON payloads from typed SSE events.
   *
   * @param event Browser EventSource event that may include string data.
   * @returns Environment event payload, or undefined when malformed.
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
   * Keeps the replay cursor scoped to the current route instance.
   *
   * @param event Parsed environment stream event from the API.
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
