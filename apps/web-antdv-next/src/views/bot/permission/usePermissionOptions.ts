import type { BotApi } from '#/api/bot';

import { ref } from 'vue';

import { getBotPermissionOptions } from '#/api/bot';

/**
 * 为单个权限表单隔离下拉状态，并丢弃切换账号、会话或关闭后返回的旧请求。
 * @returns 可加载、清空的候选状态和加载标记。
 */
export function usePermissionOptions() {
  const data = ref<BotApi.PermissionOptions>({
    accounts: [],
    notice: '',
    source: 'observed',
    targets: [],
    users: [],
  });
  const loading = ref(false);
  let revision = 0;
  const clear = () => {
    revision += 1;
    loading.value = false;
    data.value = { ...data.value, notice: '', targets: [], users: [] };
  };
  const load = async (
    query: BotApi.PermissionOptionsQuery = {},
    saved?: { targetId?: string; userId?: string; userIds?: string[] },
  ) => {
    clear();
    const current = revision;
    loading.value = true;
    try {
      const result = await getBotPermissionOptions(query);
      if (current !== revision) return;
      if (
        saved?.targetId &&
        !result.targets.some((item) => item.value === saved.targetId)
      ) {
        result.targets.push({
          label: `${saved.targetId}（已保存）`,
          value: saved.targetId,
        });
      }
      const savedUsers =
        saved?.userIds ||
        [saved?.userId].filter((value): value is string => !!value);
      for (const value of savedUsers) {
        if (!result.users.some((item) => item.value === value))
          result.users.push({ label: `${value}（已保存）`, value });
      }
      data.value = result;
    } catch {
      if (current === revision)
        data.value.notice = '候选读取失败，请重新选择账号重试';
    } finally {
      if (current === revision) loading.value = false;
    }
  };
  return { clear, data, load, loading };
}
