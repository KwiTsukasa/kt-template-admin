import { reactive } from 'vue';

export type AccountConfigKind = 'command' | 'event' | 'rule';
export type AccountConfigWriteOutcome = 'already-pending' | 'failed' | 'saved';

type WriteSettledListener = (selfId: string, kind: AccountConfigKind) => void;

const pendingWrites = reactive(new Set<string>());
const settledListeners = new Set<WriteSettledListener>();

/**
 * 将账号、配置类别和实体键组合为同一用户写入的稳定身份。
 * @param selfId - 发起操作的账号 Self ID。
 * @param kind - 命令、事件插件或规则类别。
 * @param entityId - 此次绑定实体的 id 或插件 key。
 * @returns 可用于同项去重的写入身份。
 */
function writeKey(selfId: string, kind: AccountConfigKind, entityId: string) {
  return `${selfId}:${kind}:${entityId}`;
}

/**
 * 旧面板卸载并不结束绑定请求；新面板据此隐藏行操作，避免同一条目重复提交。
 * @param selfId - 当前按钮所属账号 Self ID。
 * @param kind - 当前按钮所属配置类别。
 * @param entityId - 当前按钮所属实体身份。
 * @returns 该写入未结束时为 true。
 */
export function isAccountConfigWritePending(
  selfId: string,
  kind: AccountConfigKind,
  entityId: string,
) {
  return pendingWrites.has(writeKey(selfId, kind, entityId));
}

/**
 * 订阅写入结束身份，让当前仍显示该账号的组件自行回读权威分类事实。
 * @param listener - 只接收已结束写入的账号与类别，不共享业务快照。
 * @returns 当前组件卸载时应调用的取消订阅函数。
 */
export function subscribeAccountConfigWriteSettled(
  listener: WriteSettledListener,
) {
  settledListeners.add(listener);
  return () => settledListeners.delete(listener);
}

/**
 * 跨组件实例去重同项写入，并在成功或失败结束后释放身份、通知存活页面回读。
 * @param selfId - 发起写入时固定的账号 Self ID。
 * @param kind - 写入所属命令、事件插件或规则类别。
 * @param entityId - 发起写入的稳定实体身份。
 * @param write - 只执行本次已确认目标的后端绑定或解绑请求。
 * @returns 已有同项写入、成功或失败三种实际完成结果。
 */
export async function settleAccountConfigWrite(
  selfId: string,
  kind: AccountConfigKind,
  entityId: string,
  write: () => Promise<unknown>,
): Promise<AccountConfigWriteOutcome> {
  const key = writeKey(selfId, kind, entityId);
  if (pendingWrites.has(key)) return 'already-pending';
  pendingWrites.add(key);
  try {
    await write();
    return 'saved';
  } catch {
    return 'failed';
  } finally {
    pendingWrites.delete(key);
    for (const listener of settledListeners) listener(selfId, kind);
  }
}
