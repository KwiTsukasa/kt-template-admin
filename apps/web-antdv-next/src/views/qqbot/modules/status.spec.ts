import { describe, expect, it } from 'vitest';

import {
  getQqbotStatusColor,
  getQqbotStatusLabel,
  qqbotStatusLabels,
} from './status';

describe('qqbot shared status helpers', () => {
  it('maps common QQBot status keys to Chinese labels', () => {
    expect(qqbotStatusLabels).toMatchObject({
      disabled: '已停用',
      enabled: '已启用',
      failed: '失败',
      offline: '离线',
      online: '在线',
      pending: '处理中',
      unknown: '未知',
    });
    expect(getQqbotStatusLabel(undefined)).toBe('未知');
    expect(getQqbotStatusLabel('custom')).toBe('custom');
  });

  it('uses stable tag colors for common QQBot status keys', () => {
    expect(getQqbotStatusColor('online')).toBe('success');
    expect(getQqbotStatusColor('enabled')).toBe('success');
    expect(getQqbotStatusColor('offline')).toBe('default');
    expect(getQqbotStatusColor('disabled')).toBe('default');
    expect(getQqbotStatusColor('failed')).toBe('error');
    expect(getQqbotStatusColor('pending')).toBe('processing');
    expect(getQqbotStatusColor(undefined)).toBe('default');
  });
});
