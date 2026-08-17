import type { TagProps } from 'antdv-next';

export const qqbotStatusLabels = {
  disabled: '已停用',
  enabled: '已启用',
  failed: '失败',
  drift: '漂移',
  offline: '离线',
  ok: '正常',
  online: '在线',
  pending: '处理中',
  cooldown: '降载冷却',
  manual_only: '仅手动',
  unknown: '未知',
} as const;

export type QqbotStatusKey = keyof typeof qqbotStatusLabels;

/**
 * 将 QQBot 状态码映射为中文标签，未知非空状态保留原文，空值按未知展示。
 *
 * @param status - QQBot 运行或配置状态；空值显示未知，未收录状态保留原文本。
 * @returns 状态码对应的中文标签；未知非空状态保留原文，空值显示“未知”。
 */
export function getQqbotStatusLabel(status: string | undefined): string {
  if (!status) return qqbotStatusLabels.unknown;
  return qqbotStatusLabels[status as QqbotStatusKey] ?? status;
}

/**
 * 根据 QQBot 在线、失败、漂移、冷却和等待状态选择语义颜色。
 *
 * @param status - QQBot 运行或配置状态；未收录状态使用默认标签色。
 * @returns 适用于当前状态的根据 QQBot 在线、失败、漂移、冷却和等待状态选择语义颜色。
 */
export function getQqbotStatusColor(
  status: string | undefined,
): TagProps['color'] {
  if (status === 'online' || status === 'enabled') return 'success';
  if (status === 'ok') return 'success';
  if (status === 'offline' || status === 'disabled') return 'default';
  if (status === 'failed') return 'error';
  if (status === 'drift' || status === 'cooldown' || status === 'manual_only') {
    return 'warning';
  }
  if (status === 'pending') return 'processing';
  return 'default';
}
