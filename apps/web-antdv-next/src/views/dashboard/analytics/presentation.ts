import type { EnvironmentHealthStatus } from './types';

export const HEALTH_PRESENTATION: Record<
  EnvironmentHealthStatus,
  { color: string; label: string }
> = {
  blocked: { color: 'error', label: '阻断' },
  degraded: { color: 'warning', label: '异常' },
  down: { color: 'error', label: '离线' },
  isolated: { color: 'purple', label: '隔离' },
  ok: { color: 'success', label: '正常' },
  unknown: { color: 'default', label: '待确认' },
  unwired: { color: 'default', label: '未接入' },
};

export const STREAM_LABELS = {
  idle: '未连接',
  closed: '已断开',
  connecting: '连接中',
  error: '连接异常',
  open: '实时连接',
};
