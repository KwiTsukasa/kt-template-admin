import type { PluginPlatformApi } from '#/api/plugin-platform/plugin';

import { computed, reactive } from 'vue';

export type InstallationAction = 'disable' | 'enable' | 'uninstall';
export type InstallationWriteOutcome = 'already-pending' | 'failed' | 'saved';

const pendingWrites = reactive(new Set<string>());
const settledListeners = new Set<(installationId: string) => void>();

export const pendingInstallationIds = computed(() => [...pendingWrites]);

/**
 * 按 API 明确的状态限制判断安装操作，其余状态不增加猜测性禁用。
 * @param status - 已确认的插件安装状态。
 * @param action - 用户选定的启用、禁用或卸载操作。
 * @returns 当前状态允许该操作时为 true。
 */
export function isInstallationActionAvailable(
  status: PluginPlatformApi.InstallStatus,
  action: InstallationAction,
) {
  if (action === 'enable') return status !== 'enabled';
  if (action === 'disable') return status !== 'disabled';
  return status !== 'enabled';
}

/**
 * 旧页面卸载并不结束安装写入；新页面据此禁用同一条目的按钮，阻止重复提交。
 * @param installationId - 后端安装记录的稳定 id。
 * @returns 此安装条目仍有提交在途时为 true。
 */
export function isInstallationWritePending(installationId: string) {
  return pendingWrites.has(installationId);
}

/**
 * 把已结算的安装条目身份送给当前存活页面，由页面自行决定是否回读安装目录。
 * @param listener - 只接收安装 id，不共享列表或状态快照的监听器。
 * @returns 页面卸载时需要调用的取消订阅函数。
 */
export function subscribeInstallationWriteSettled(
  listener: (installationId: string) => void,
) {
  settledListeners.add(listener);
  return () => settledListeners.delete(listener);
}

/**
 * 跨页面实例去重同安装写入，并在成功或失败结算时释放 id、通知存活页面回读。
 * @param installationId - 本次后端安装操作的记录 id。
 * @param write - 对该固定安装 id 执行的启用、禁用或卸载请求。
 * @returns 已有在途操作、成功或失败三种明确结果。
 */
export async function settleInstallationWrite(
  installationId: string,
  write: () => Promise<unknown>,
): Promise<InstallationWriteOutcome> {
  if (pendingWrites.has(installationId)) return 'already-pending';
  pendingWrites.add(installationId);
  try {
    await write();
    return 'saved';
  } catch {
    return 'failed';
  } finally {
    pendingWrites.delete(installationId);
    for (const listener of settledListeners) listener(installationId);
  }
}
