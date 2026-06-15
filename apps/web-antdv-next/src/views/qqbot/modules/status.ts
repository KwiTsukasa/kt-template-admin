import type { TagProps } from 'antdv-next';

export const qqbotStatusLabels = {
  disabled: '已停用',
  enabled: '已启用',
  failed: '失败',
  offline: '离线',
  online: '在线',
  pending: '处理中',
  unknown: '未知',
} as const;

export type QqbotStatusKey = keyof typeof qqbotStatusLabels;

export function getQqbotStatusLabel(status: string | undefined): string {
  if (!status) return qqbotStatusLabels.unknown;
  return qqbotStatusLabels[status as QqbotStatusKey] ?? status;
}

export function getQqbotStatusColor(
  status: string | undefined,
): TagProps['color'] {
  if (status === 'online' || status === 'enabled') return 'success';
  if (status === 'offline' || status === 'disabled') return 'default';
  if (status === 'failed') return 'error';
  if (status === 'pending') return 'processing';
  return 'default';
}
