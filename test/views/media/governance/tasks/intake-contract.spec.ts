import {
  buildCreateTaskInput,
  buildIdentityPreview,
  buildUpdateTaskIdentityInput,
  validateIntakeForm,
  validateTaskIdentityForm,
} from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/intake-contract';
import { describe, expect, it } from 'vitest';

describe('media governance intake contract', () => {
  it('normalizes TV seasons while preserving S00 as an independent unit', () => {
    const form = {
      mediaType: 'tv' as const,
      provider: 'tmdb' as const,
      providerId: '105476',
      releaseYear: '2021',
      seasonText: 'S01, s00',
      titleHint: '异世界迷宫黑心企业',
    };

    expect(validateIntakeForm(form)).toEqual([]);
    expect(buildCreateTaskInput(form)).toEqual({
      mediaType: 'tv',
      providerRef: { provider: 'tmdb', providerId: '105476' },
      releaseYear: 2021,
      seasonNumbers: ['S00', 'S01'],
      titleHint: '异世界迷宫黑心企业',
    });
    expect(buildIdentityPreview(form)).toContain('S00、S01');
  });

  it('rejects an unexplained partial provider reference and invalid year', () => {
    expect(
      validateIntakeForm({
        mediaType: 'movie',
        provider: 'tmdb',
        providerId: '',
        releaseYear: '17',
        seasonText: '',
        titleHint: '测试电影',
      }),
    ).toEqual([
      '选择媒体资料库后必须填写对应作品编号',
      '首播/上映年份应为 1888 至当前年份后 2 年之间的四位数字',
    ]);
  });

  it('keeps Movie and Theatrical distinct from S00', () => {
    expect(
      validateIntakeForm({
        mediaType: 'theatrical',
        provider: '',
        providerId: '',
        releaseYear: '',
        seasonText: 'S00',
        titleHint: '剧场版测试',
      }),
    ).toEqual(['电影或剧场版不填写季号，也不能使用 S00 代替作品类型']);
  });

  it('builds every editable identity field before download', () => {
    const form = {
      mediaType: 'tv' as const,
      provider: 'tmdb' as const,
      providerId: ' 63145 ',
      releaseYear: '2015',
      seasonText: 'S02, S00',
      titleHint: ' 下载前身份修正 ',
    };

    expect(validateIntakeForm(form)).toEqual([]);
    expect(buildUpdateTaskIdentityInput(form, 7)).toEqual({
      expectedRevision: 7,
      mediaType: 'tv',
      providerRef: { provider: 'tmdb', providerId: '63145' },
      releaseYear: 2015,
      seasonNumbers: ['S00', 'S02'],
      titleHint: '下载前身份修正',
    });
  });

  it('explains invalid provider and release-year identity fields', () => {
    expect(
      validateTaskIdentityForm({
        provider: '' as const,
        providerId: '',
        releaseYear: '17',
      }),
    ).toEqual([
      '必须选择媒体资料库并填写对应作品编号',
      '首播/上映年份应为 1888 至当前年份后 2 年之间的四位数字',
    ]);
  });
});
