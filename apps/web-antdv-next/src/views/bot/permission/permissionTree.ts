import type { BotApi } from '#/api/bot';

export type PermissionTreeRow = BotApi.Permission & {
  children?: PermissionTreeRow[];
  groupLabel?: string;
};

/**
 * 将筛选后的名单按 Bot 账号分组；无账号记录归全局，未知账号仍保留其原始身份。
 * @param rows - 完整筛选结果中的白名单或黑名单项。
 * @param accounts - 全部未删除 Bot 账号的显示名称与身份。
 * @returns 全局优先、账号顺序稳定的两层树表数据。
 */
export function buildPermissionTree(
  rows: BotApi.Permission[],
  accounts: BotApi.PermissionOptions['accounts'],
): PermissionTreeRow[] {
  const groups = new Map<
    string,
    PermissionTreeRow & { children: PermissionTreeRow[] }
  >();
  for (const row of rows) {
    const selfId = row.selfId || '';
    let group = groups.get(selfId);
    if (!group) {
      let label = '全局';
      if (selfId)
        label =
          accounts.find((account) => account.value === selfId)?.label || selfId;
      group = {
        children: [],
        enabled: false,
        groupLabel: label,
        id: `account:${selfId || 'global'}`,
        preciseUser: false,
        selfId,
        targetId: '',
        targetType: row.targetType,
      };
      groups.set(selfId, group);
    }
    group.children.push(row);
  }
  return [...groups.values()].toSorted((left, right) => {
    if (!left.selfId) return -1;
    if (!right.selfId) return 1;
    return left.selfId.localeCompare(right.selfId);
  });
}
