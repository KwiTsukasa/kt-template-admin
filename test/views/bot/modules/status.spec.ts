import {
  botStatusLabels,
  getBotStatusColor,
  getBotStatusLabel,
} from '@test-source/apps/web-antdv-next/src/views/bot/modules/status';
import { describe, expect, it } from 'vitest';

describe('bot shared status helpers', () => {
  it('maps common Bot status keys to Chinese labels', () => {
    expect(botStatusLabels).toMatchObject({
      disabled: '已停用',
      enabled: '已启用',
      failed: '失败',
      offline: '离线',
      online: '在线',
      pending: '处理中',
      unknown: '未知',
    });
    expect(getBotStatusLabel(undefined)).toBe('未知');
    expect(getBotStatusLabel('custom')).toBe('custom');
  });

  it('uses stable tag colors for common Bot status keys', () => {
    expect(getBotStatusColor('online')).toBe('success');
    expect(getBotStatusColor('enabled')).toBe('success');
    expect(getBotStatusColor('offline')).toBe('default');
    expect(getBotStatusColor('disabled')).toBe('default');
    expect(getBotStatusColor('failed')).toBe('error');
    expect(getBotStatusColor('pending')).toBe('processing');
    expect(getBotStatusColor(undefined)).toBe('default');
  });
});
