import { useModalSessionIntent } from '@test-source/apps/web-antdv-next/src/hooks/useModalSessionIntent';
import { describe, expect, it } from 'vitest';

/**
 * 控制前一表单初始化何时完成，验证新会话不会被旧重置覆盖。
 * @returns 可手动兑现的异步完成信号。
 */
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('modal session intent', () => {
  it('keeps old release from unlocking a new session confirmation', async () => {
    const session = useModalSessionIntent();
    const a = session.begin();
    await session.initialize(a, async () => undefined);
    expect(session.claimConfirm(a)).toBe(true);
    expect(session.claimConfirm(a)).toBe(false);
    const b = session.begin();
    await session.initialize(b, async () => undefined);
    expect(session.claimConfirm(b)).toBe(true);
    session.releaseConfirm(a);
    expect(session.claimConfirm(b)).toBe(false);
    session.releaseConfirm(b);
    expect(session.claimConfirm(b)).toBe(true);
  });

  it('serializes form initialization and drops an old task before it writes values', async () => {
    const session = useModalSessionIntent();
    const oldReset = deferred();
    const values: string[] = [];
    const a = session.begin();
    const oldTask = session.initialize(a, async (stillCurrent) => {
      await oldReset.promise;
      if (!stillCurrent()) return;
      values.push('A');
    });
    await Promise.resolve();
    const b = session.begin();
    const newTask = session.initialize(b, async (stillCurrent) => {
      if (stillCurrent()) values.push('B');
    });
    expect(values).toEqual([]);
    oldReset.resolve();
    await Promise.all([oldTask, newTask]);
    expect(values).toEqual(['B']);
  });

  it('invalidates closed and disposed sessions without hiding initialization errors', async () => {
    const session = useModalSessionIntent();
    const a = session.begin();
    session.invalidate();
    expect(session.isCurrent(a)).toBe(false);
    expect(session.claimConfirm(a)).toBe(false);
    const b = session.begin();
    await expect(
      session.initialize(b, async () => {
        throw new Error('form unavailable');
      }),
    ).rejects.toThrow('form unavailable');
    expect(session.isReady(b)).toBe(false);
    expect(session.claimConfirm(b)).toBe(false);
    const c = session.begin();
    await session.initialize(c, async () => undefined);
    expect(session.isReady(c)).toBe(true);
    session.dispose();
    expect(session.isCurrent(c)).toBe(false);
    expect(session.claimConfirm(session.begin())).toBe(false);
  });

  it('keeps a new session unready while its reset waits for the old session', async () => {
    const session = useModalSessionIntent();
    const oldReset = deferred();
    const a = session.begin();
    const oldTask = session.initialize(a, async () => {
      await oldReset.promise;
    });
    await Promise.resolve();
    const b = session.begin();
    const newTask = session.initialize(b, async () => undefined);
    expect(session.isCurrent(b)).toBe(true);
    expect(session.isReady(b)).toBe(false);
    expect(session.ready.value).toBe(false);
    expect(session.claimConfirm(b)).toBe(false);
    oldReset.resolve();
    await Promise.all([oldTask, newTask]);
    expect(session.isReady(b)).toBe(true);
    expect(session.ready.value).toBe(true);
    expect(session.claimConfirm(b)).toBe(true);
  });
});
