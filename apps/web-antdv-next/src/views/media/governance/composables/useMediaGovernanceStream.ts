import type { MediaGovernanceApi } from '#/api/media-governance';

import { ref } from 'vue';

import { getMediaGovernanceEventsUrl } from '#/api/media-governance';

export interface UseMediaGovernanceStreamOptions {
  onSnapshotRequired: () => void;
  onTaskChanged: (event: MediaGovernanceApi.TaskChangedEvent) => void;
}

export function useMediaGovernanceStream(
  options: UseMediaGovernanceStreamOptions,
) {
  const connected = ref(false);
  const lastEventId = ref<string>();
  let source: EventSource | undefined;

  function start() {
    if (source || typeof EventSource === 'undefined') return;
    source = new EventSource(getMediaGovernanceEventsUrl(lastEventId.value), {
      withCredentials: true,
    });
    source.addEventListener('open', handleOpen);
    source.addEventListener('error', handleError);
    source.addEventListener('task-changed', handleTaskChanged);
    source.addEventListener('snapshot-required', handleSnapshotRequired);
  }

  function close() {
    if (!source) return;
    source.removeEventListener('open', handleOpen);
    source.removeEventListener('error', handleError);
    source.removeEventListener('task-changed', handleTaskChanged);
    source.removeEventListener('snapshot-required', handleSnapshotRequired);
    source.close();
    source = undefined;
    connected.value = false;
  }

  function handleOpen() {
    connected.value = true;
  }

  function handleError() {
    connected.value = false;
  }

  function handleTaskChanged(event: Event) {
    const payload = parseTaskChanged(event);
    if (!payload) return;
    const cursor = (event as MessageEvent<string>).lastEventId;
    if (cursor) lastEventId.value = cursor;
    options.onTaskChanged(payload);
  }

  function handleSnapshotRequired(event: Event) {
    const cursor = (event as MessageEvent<string>).lastEventId;
    if (cursor) lastEventId.value = cursor;
    options.onSnapshotRequired();
  }

  function parseTaskChanged(
    event: Event,
  ): MediaGovernanceApi.TaskChangedEvent | undefined {
    const data = (event as MessageEvent<string>).data;
    if (!data) return undefined;
    try {
      const payload = JSON.parse(
        data,
      ) as Partial<MediaGovernanceApi.TaskChangedEvent>;
      if (
        !payload.taskId ||
        !payload.observedAt ||
        !Number.isInteger(payload.revision) ||
        !['created', 'source-updated', 'state-updated'].includes(
          payload.changeType || '',
        )
      ) {
        return undefined;
      }
      return payload as MediaGovernanceApi.TaskChangedEvent;
    } catch {
      return undefined;
    }
  }

  return { close, connected, lastEventId, start };
}
