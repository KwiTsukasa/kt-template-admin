import { createTextTypewriter } from '@test-source/apps/web-antdv-next/src/views/llm/chat/typewriter';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('lLM text typewriter', () => {
  afterEach(() => vi.useRealTimers());

  it('reveals streamed text incrementally and resolves drain after the queue', async () => {
    vi.useFakeTimers();
    let visible = '';
    const typewriter = createTextTypewriter((content) => {
      visible += content;
    });

    typewriter.enqueue('逐字显示');
    const drained = typewriter.drain();
    expect(visible).toBe('');

    await vi.advanceTimersByTimeAsync(16);
    expect(visible).toBe('逐');

    await vi.runAllTimersAsync();
    await drained;
    expect(visible).toBe('逐字显示');
  });

  it('flushes every received character immediately when generation stops', async () => {
    vi.useFakeTimers();
    let visible = '';
    const typewriter = createTextTypewriter((content) => {
      visible += content;
    });

    typewriter.enqueue('保留已经收到的内容');
    const drained = typewriter.drain();
    typewriter.flush();

    await drained;
    expect(visible).toBe('保留已经收到的内容');
    expect(vi.getTimerCount()).toBe(0);
  });
});
