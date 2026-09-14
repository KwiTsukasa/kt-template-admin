import type {
  CoordinationSnapshot,
  CoordinationTask,
} from '#/api/system/workflow-coordination';

import { describe, expect, it } from 'vitest';

import {
  claimStatus,
  RECENT_WINDOW_MS,
  summarizeCoordination,
  taskStatus,
} from '#/views/llm/coordination/model';

const now = Date.parse('2026-09-14T08:00:00Z');
const task = (
  id: string,
  status: CoordinationTask['status'],
  age = 0,
): CoordinationTask => ({
  workstreamId: id,
  objective: id,
  status,
  updatedAt: new Date(now - age).toISOString(),
  actionId: 'current',
  nextStep: '继续核对',
  executionDepth: 1,
  revision: 1,
});
const claim = (id: string, actionId = 'current') => ({
  workstreamId: id,
  actionId,
  kind: 'file',
  key: id,
  acquiredAt: new Date(now).toISOString(),
});
const snapshot = (): CoordinationSnapshot => ({
  schemaVersion: 1,
  snapshotId: 'snapshot',
  observedAt: new Date(now).toISOString(),
  unreadableTasks: 0,
  revision: 1,
  tasks: [
    task('current', 'active'),
    task('owner', 'active', RECENT_WINDOW_MS + 1),
    task('history', 'active', RECENT_WINDOW_MS + 1),
    task('paused', 'paused', RECENT_WINDOW_MS + 1),
    task('completed', 'completed', RECENT_WINDOW_MS + 1),
  ],
  claims: [
    claim('owner'),
    claim('completed'),
    claim('paused'),
    claim('unreadable'),
  ],
  events: [0, RECENT_WINDOW_MS, RECENT_WINDOW_MS + 1, -1].map((age, id) => ({
    id,
    at: new Date(now - age).toISOString(),
    operation: 'conflict',
    message: '',
    workstreamId: 'current',
  })),
});

describe('协调统计与资源声明边界', () => {
  it('历史和暂停任务不制造待确认告警，完成和不可读所有者的声明仍计入占用', () => {
    expect(summarizeCoordination(snapshot(), 'current', now)).toEqual({
      active: 1,
      resources: 4,
      conflicts: 2,
      pending: 1,
    });
  });
  it('当前任务即使无资源也需要超时确认，时间窗口结束后冲突不再累计', () => {
    const state = snapshot();
    expect(summarizeCoordination(state, 'history', now).pending).toBe(2);
    expect(
      summarizeCoordination(state, 'current', now + RECENT_WINDOW_MS + 2)
        .conflicts,
    ).toBe(0);
    expect(
      summarizeCoordination(state, 'current', now + RECENT_WINDOW_MS + 2)
        .pending,
    ).toBe(2);
  });
  it('原有状态和旧动作声明单独显示，不推断资源已释放', () => {
    expect(taskStatus(task('paused', 'paused', 86_400_000), now)).toBe(
      '已暂停',
    );
    expect(
      claimStatus(claim('completed'), task('completed', 'completed'), now),
    ).toBe('任务已完成，声明尚未释放');
    expect(
      claimStatus(claim('owner', 'previous'), task('owner', 'active'), now),
    ).toBe('旧动作声明，等待所有者核对');
    expect(claimStatus(claim('unknown'), undefined, now)).toBe(
      '所有者状态不可读，保留占用',
    );
    expect(
      claimStatus(
        claim('owner'),
        task('owner', 'active', RECENT_WINDOW_MS + 1),
        now,
      ),
    ).toBe('所有者状态待确认，保留占用');
  });
});
