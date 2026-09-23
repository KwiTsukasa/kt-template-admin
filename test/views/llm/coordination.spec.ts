import type {
  CoordinationSnapshot,
  CoordinationTask,
} from '#/api/system/workflow-coordination';

import { describe, expect, it } from 'vitest';

import {
  claimIdentity,
  claimStatus,
  RECENT_WINDOW_MS,
  selectCoordinationTasks,
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
  it('同一资源的不同动作和获取时间保留独立身份，分隔符不会混淆', () => {
    const first = { ...claim('owner', 'old'), key: 'file:one' };
    const second = { ...claim('owner', 'new'), key: 'file:one' };
    const third = { ...claim('owner', 'old:file'), key: 'one' };
    const fourth = {
      ...first,
      acquiredAt: new Date(now - 1000).toISOString(),
    };
    expect(
      new Set([first, second, third, fourth].map((item) => claimIdentity(item)))
        .size,
    ).toBe(4);
  });
  it('当前身份在比较自身时保持输入顺序', () => {
    const state = snapshot();
    state.tasks = [
      {
        ...task('current', 'active'),
        objective: '先到',
        updatedAt: new Date(now - 1000).toISOString(),
      },
      { ...task('current', 'active'), objective: '后到' },
      task('other', 'active'),
    ];
    expect(
      selectCoordinationTasks(state, 'current', '', false, now).map(
        (item) => item.objective,
      ),
    ).toEqual(['先到', '后到', 'other']);
  });
  it('默认保留当前任务及历史资源所有者，搜索和状态筛选不改变入口身份', () => {
    const state = snapshot();
    expect(
      selectCoordinationTasks(state, 'current', '', false, now).map(
        (item) => item.workstreamId,
      ),
    ).toEqual(['current', 'owner', 'paused', 'completed']);
    expect(
      selectCoordinationTasks(state, 'current', 'OWNER', false, now).map(
        (item) => item.workstreamId,
      ),
    ).toEqual(['owner']);
    expect(
      selectCoordinationTasks(state, 'current', '', false, now, '已暂停').map(
        (item) => item.workstreamId,
      ),
    ).toEqual(['paused']);
    expect(
      selectCoordinationTasks(state, 'current', '', true, now),
    ).toHaveLength(5);
    expect(state.tasks[0]?.workstreamId).toBe('current');
  });
  it('筛选时对资源归属只读取一次，不为每个历史任务重新扫描声明', () => {
    const state = snapshot();
    state.tasks = Array.from({ length: 2000 }, (_, index) =>
      task(String(index), 'active', RECENT_WINDOW_MS + 1),
    );
    let reads = 0;
    state.claims = state.tasks.map((item) => ({
      ...claim(item.workstreamId),
      get workstreamId() {
        reads += 1;
        return item.workstreamId;
      },
    }));
    expect(selectCoordinationTasks(state, '0', '', false, now)).toHaveLength(
      2000,
    );
    expect(reads).toBe(2000);
  });
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
