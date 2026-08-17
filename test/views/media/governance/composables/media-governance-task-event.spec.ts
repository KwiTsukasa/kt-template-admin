import type { MediaGovernanceApi } from '../../../../../apps/web-antdv-next/src/api/media-governance';
import type { MediaGovernanceTaskEventCursor } from '../../../../../apps/web-antdv-next/src/views/media/governance/composables/mediaGovernanceTaskEvent';

import { describe, expect, it } from 'vitest';

import { mergeMediaGovernanceTaskEvent } from '../../../../../apps/web-antdv-next/src/views/media/governance/composables/mediaGovernanceTaskEvent';

describe('media governance task SSE merge', () => {
  function currentTask() {
    return {
      agentSession: null,
      id: 'media-task-12345678',
      progress: {
        completedBytes: 0,
        completedItems: 0,
        etaLabel: '等待执行',
        heartbeatLabel: '尚无心跳',
        percent: 0,
        progressLabel: '等待执行',
        speedLabel: '0 B/s',
        totalBytes: 100,
        totalItems: 1,
      },
      revision: 5,
      titleHint: '实时合并测试',
    } as MediaGovernanceApi.Task;
  }

  function event(
    input: Partial<MediaGovernanceApi.TaskChangedEvent> &
      Pick<MediaGovernanceApi.TaskChangedEvent, 'observedAt' | 'task'>,
  ): MediaGovernanceApi.TaskChangedEvent {
    return {
      changeType: 'state-updated',
      patchMode: 'full',
      revision: 5,
      runId: null,
      runSequence: null,
      summary: {} as MediaGovernanceApi.Summary,
      taskId: 'media-task-12345678',
      updatedAt: input.observedAt,
      ...input,
    };
  }

  it('merges newer same-revision Agent state instead of treating revision as an event cursor', () => {
    const task = currentTask();
    const cursors = new Map<string, MediaGovernanceTaskEventCursor>();
    const first = event({
      observedAt: '2026-08-17T10:00:00.000Z',
      task: {
        agentSession: {
          currentActionLabel: '正在读取任务快照',
          currentUnitId: null,
          lastHeartbeatLabel: '刚刚',
          policyBoundaryLabel: '只读边界',
          status: 'running',
          statusLabel: 'Agent 运行中',
          threadId: 'thread-12345678',
        },
        id: task.id,
        revision: 5,
      },
    });
    const later = event({
      observedAt: '2026-08-17T10:00:01.000Z',
      task: {
        agentSession: {
          currentActionLabel: '已生成治理建议',
          currentUnitId: null,
          lastHeartbeatLabel: '刚刚',
          policyBoundaryLabel: '只读边界',
          status: 'needs-operator',
          statusLabel: '等待选择',
          threadId: 'thread-12345678',
        },
        id: task.id,
        revision: 5,
      },
    });

    expect(mergeMediaGovernanceTaskEvent(task, first, cursors).result).toBe(
      'applied',
    );
    expect(mergeMediaGovernanceTaskEvent(task, later, cursors).result).toBe(
      'applied',
    );
    expect(task.agentSession?.currentActionLabel).toBe('已生成治理建议');
    expect(mergeMediaGovernanceTaskEvent(task, first, cursors).result).toBe(
      'ignored',
    );
  });

  it('orders progress by runId and runSequence and detects a missing tick', () => {
    const task = currentTask();
    const cursors = new Map<string, MediaGovernanceTaskEventCursor>();
    const progressEvent = (runSequence: number, completedBytes: number) =>
      event({
        observedAt: `2026-08-17T10:00:${runSequence}.000Z`,
        runId: 'media-run-12345678',
        runSequence,
        task: {
          id: task.id,
          progress: {
            ...task.progress,
            completedBytes,
            percent: completedBytes,
          },
          revision: 5,
        },
      });

    expect(
      mergeMediaGovernanceTaskEvent(task, progressEvent(10, 10), cursors)
        .result,
    ).toBe('applied');
    expect(
      mergeMediaGovernanceTaskEvent(task, progressEvent(11, 20), cursors)
        .result,
    ).toBe('applied');
    expect(task.progress.completedBytes).toBe(20);
    expect(
      mergeMediaGovernanceTaskEvent(task, progressEvent(11, 20), cursors)
        .result,
    ).toBe('ignored');
    expect(
      mergeMediaGovernanceTaskEvent(task, progressEvent(13, 40), cursors)
        .result,
    ).toBe('gap');
  });

  it('marks an update for a row outside the current snapshot as missing', () => {
    const task = currentTask();
    const result = mergeMediaGovernanceTaskEvent(
      undefined,
      event({
        observedAt: '2026-08-17T10:00:00.000Z',
        task: { id: task.id, revision: task.revision },
      }),
      new Map(),
    );

    expect(result.result).toBe('missing');
    expect(result.task).toBeUndefined();
  });
});
