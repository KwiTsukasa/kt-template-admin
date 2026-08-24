/* @vitest-environment happy-dom */

import type { MediaGovernanceApi } from '#/api/media-governance';

import { useMediaGovernanceStream } from '@test-source/apps/web-antdv-next/src/views/media/governance/composables/useMediaGovernanceStream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/api/media-governance', () => ({
  getMediaGovernanceEventsUrl: (lastEventId?: string) => {
    if (!lastEventId) return '/api/media-governance/events/stream';
    return `/api/media-governance/events/stream?lastEventId=${lastEventId}`;
  },
}));

type FakeEventSourceListener = (event: Event) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  closed = false;
  readonly listeners = new Map<string, Set<FakeEventSourceListener>>();

  constructor(
    readonly url: string,
    readonly options?: EventSourceInit,
  ) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: FakeEventSourceListener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close() {
    this.closed = true;
  }

  dispatch(type: string, payload: unknown, lastEventId = '') {
    if (this.closed) return;
    const event = new MessageEvent(type, { data: JSON.stringify(payload) });
    Object.defineProperty(event, 'lastEventId', { value: lastEventId });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  removeEventListener(type: string, listener: FakeEventSourceListener) {
    this.listeners.get(type)?.delete(listener);
  }
}

/**
 * 创建可由系列资料库原位替换的完整 catalog-changed 事件。
 *
 * @returns 带稳定 Series/Task 身份与卡片统计的目录事件。
 */
function catalogChangedEvent(): MediaGovernanceApi.CatalogChangedEvent {
  return {
    changeType: 'created',
    observedAt: '2026-08-24T00:00:00.000Z',
    revision: 1,
    series: {
      bindingCount: 2,
      boundEpisodeCount: 2,
      canonicalProvider: 'tmdb',
      canonicalProviderId: '90001',
      coveragePercent: 100,
      createTime: '2026-08-24T00:00:00.000Z',
      episodeCount: 2,
      id: 'media-series-auto-0001',
      mediaType: 'tv',
      originalTitle: null,
      primaryWorkId: 'media-work-auto-0001',
      releaseYear: 2026,
      revision: 1,
      rssCount: 0,
      rssTotalCount: 0,
      seasonCount: 1,
      seasonSummaries: [],
      status: 'active',
      taskCount: 1,
      title: '自动归类作品',
      updateTime: '2026-08-24T00:00:00.000Z',
      workCount: 1,
    },
    seriesId: 'media-series-auto-0001',
    taskId: 'media-task-auto-0001',
    taskIds: ['media-task-auto-0001'],
    updatedAt: '2026-08-24T00:00:00.000Z',
  };
}

describe('use media governance stream catalog events', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delivers a valid catalog card and preserves its replay cursor', () => {
    const onCatalogChanged = vi.fn();
    const stream = useMediaGovernanceStream({
      onCatalogChanged,
      onSnapshotRequired: vi.fn(),
    });
    stream.start();
    const source = FakeEventSource.instances[0];
    if (!source) throw new Error('expected EventSource instance');
    const payload = catalogChangedEvent();
    source.dispatch('catalog-changed', payload, 'catalog-cursor-1');

    expect(onCatalogChanged).toHaveBeenCalledWith(payload);
    expect(stream.lastEventId.value).toBe('catalog-cursor-1');
    expect(source.options).toEqual({ withCredentials: true });
    stream.close();
    expect(source.closed).toBe(true);
  });

  it('rejects a catalog event whose card revision differs from the envelope', () => {
    const onCatalogChanged = vi.fn();
    const stream = useMediaGovernanceStream({
      onCatalogChanged,
      onSnapshotRequired: vi.fn(),
    });
    stream.start();
    const payload = catalogChangedEvent();
    payload.revision = 2;
    const source = FakeEventSource.instances[0];
    if (!source) throw new Error('expected EventSource instance');
    source.dispatch('catalog-changed', payload);

    expect(onCatalogChanged).not.toHaveBeenCalled();
    stream.close();
  });
});
