export interface TextTypewriter {
  drain: () => Promise<void>;
  enqueue: (content: string) => void;
  flush: () => void;
}

const TYPEWRITER_INTERVAL_MS = 16;

/**
 * 把供应商大小不一的文本增量平滑拆成可见字符批次，并允许终态等待队列排空。
 * @param onAppend - 每个可见批次写入响应式消息正文的回调。
 * @returns 可追加增量、等待排空或立即冲刷剩余文本的打字机控制器。
 */
export function createTextTypewriter(
  onAppend: (content: string) => void,
): TextTypewriter {
  let characters: string[] = [];
  let cursor = 0;
  let drainResolvers: Array<() => void> = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const pendingCount = () => characters.length - cursor;
  const resolveDrains = () => {
    if (pendingCount() > 0 || timer) return;
    const resolvers = drainResolvers;
    drainResolvers = [];
    for (const resolve of resolvers) resolve();
  };
  const batchSize = (remaining: number) => {
    let size = 1;
    if (remaining > 48) size = 3;
    if (remaining > 160) size = 8;
    if (remaining > 600) size = 24;
    if (remaining > 2000) size = 80;
    return size;
  };
  const schedule = () => {
    if (timer || pendingCount() === 0) return;
    timer = setTimeout(tick, TYPEWRITER_INTERVAL_MS);
  };
  const tick = () => {
    timer = undefined;
    const remaining = pendingCount();
    if (remaining === 0) {
      resolveDrains();
      return;
    }
    const end = Math.min(characters.length, cursor + batchSize(remaining));
    const content = characters.slice(cursor, end).join('');
    cursor = end;
    onAppend(content);
    if (cursor === characters.length) {
      characters = [];
      cursor = 0;
      resolveDrains();
      return;
    }
    schedule();
  };
  const enqueue = (content: string) => {
    if (!content) return;
    for (const character of content) characters.push(character);
    schedule();
  };
  const drain = () => {
    if (pendingCount() === 0) return Promise.resolve();
    return new Promise<void>((resolve) => drainResolvers.push(resolve));
  };
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const content = characters.slice(cursor).join('');
    characters = [];
    cursor = 0;
    if (content) onAppend(content);
    resolveDrains();
  };

  return { drain, enqueue, flush };
}
