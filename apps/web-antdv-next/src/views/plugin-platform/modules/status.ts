import type { TagProps } from 'antdv-next';

export const botStatusLabels = {
  disabled: '已停用',
  enabled: '已启用',
  failed: '失败',
  uploaded: '已上传',
  validated: '已校验',
  installed: '已安装',
  uninstalled: '已卸载',
  starting: '启动中',
  healthy: '健康',
  unhealthy: '异常',
  stopped: '已停止',
  crashed: '已崩溃',
  drift: '漂移',
  offline: '离线',
  ok: '正常',
  online: '在线',
  pending: '处理中',
  cooldown: '降载冷却',
  manual_only: '仅手动',
  unknown: '未知',
} as const;

export type BotStatusKey = keyof typeof botStatusLabels;

/**
 * 将 Bot 与插件状态码映射为中文标签，未知非空状态保留原文，空值按未知展示。
 *
 * @param status - Bot 或插件运行与配置状态；空值显示未知，未收录状态保留原文本。
 * @returns 状态码对应的中文标签；未知非空状态保留原文，空值显示“未知”。
 */
export function getBotStatusLabel(status: string | undefined): string {
  if (!status) return botStatusLabels.unknown;
  return botStatusLabels[status as BotStatusKey] ?? status;
}

/**
 * 按 Bot 在线、插件安装和运行状态选择语义颜色，未知码保留默认色。
 *
 * @param status - Bot、插件安装或运行状态；未收录状态使用默认标签色。
 * @returns 成功、处理中、异常或中性状态对应的 Tag 颜色。
 */
export function getBotStatusColor(
  status: string | undefined,
): TagProps['color'] {
  if (status === 'online' || status === 'enabled' || status === 'healthy')
    return 'success';
  if (status === 'ok') return 'success';
  if (
    status === 'offline' ||
    status === 'disabled' ||
    status === 'stopped' ||
    status === 'uninstalled'
  )
    return 'default';
  if (status === 'failed' || status === 'unhealthy' || status === 'crashed')
    return 'error';
  if (
    status === 'uploaded' ||
    status === 'validated' ||
    status === 'installed' ||
    status === 'starting'
  )
    return 'processing';
  if (status === 'drift' || status === 'cooldown' || status === 'manual_only') {
    return 'warning';
  }
  if (status === 'pending') return 'processing';
  return 'default';
}
