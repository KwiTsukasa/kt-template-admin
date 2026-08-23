/* @vitest-environment happy-dom */

import { readFileSync } from 'node:fs';

import {
  nextBatchEpisodeNumber,
  validateBatchMagnetRows,
} from '@test-source/apps/web-antdv-next/src/views/media/governance/series/detail';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@vben/common-ui', () => ({ Page: {} }));
vi.mock('@antdv-next/icons', () => ({
  CloudDownloadOutlined: {},
  DeleteOutlined: {},
  EyeOutlined: {},
  LinkOutlined: {},
  PauseCircleOutlined: {},
  PlayCircleOutlined: {},
  PlusOutlined: {},
  ReloadOutlined: {},
}));
vi.mock('antdv-next', () => ({
  Button: {},
  Card: {},
  Empty: {},
  Form: {},
  FormItem: {},
  Input: {},
  InputNumber: {},
  Modal: {},
  Pagination: {},
  Progress: {},
  Select: {},
  Spin: {},
  Switch: {},
  Tabs: {},
  Tag: {},
  Tooltip: {},
  message: {},
}));
vi.mock('#/api/media-governance', () => ({}));
vi.mock('#/components/kt-card-list', () => ({ KtCardList: {} }));
vi.mock('#/components/kt-table', () => ({
  KtActionGroup: {},
  KtTable: {},
  useKtTable: () => [vi.fn()],
}));

const DETAIL_SOURCE = readFileSync(
  'apps/web-antdv-next/src/views/media/governance/series/detail.tsx',
  'utf8',
);
const LIST_SOURCE = readFileSync(
  'apps/web-antdv-next/src/views/media/governance/series/list.tsx',
  'utf8',
);
const HASH_A = 'a'.repeat(40);
const HASH_B = 'b'.repeat(40);

describe('media governance series UI', () => {
  it('keeps batch magnets in explicit episode rows without a shared textarea', () => {
    expect(DETAIL_SOURCE).not.toContain('Input.TextArea');
    expect(DETAIL_SOURCE).not.toContain('batchStartEpisode');
    expect(DETAIL_SOURCE).not.toContain('batchMagnets');
    expect(DETAIL_SOURCE).toContain('media-governance-batch-editor__row');
    expect(DETAIL_SOURCE).toContain('添加下一集');
  });

  it('increments a newly added row from the last explicit episode', () => {
    expect(nextBatchEpisodeNumber([], 25, 23)).toBe(25);
    expect(
      nextBatchEpisodeNumber(
        [
          { episodeNumber: 27, id: 1, magnetUri: '' },
          { episodeNumber: 28, id: 2, magnetUri: '' },
        ],
        1,
        50,
      ),
    ).toBe(29);
    expect(
      nextBatchEpisodeNumber(
        [{ episodeNumber: 47, id: 1, magnetUri: '' }],
        25,
        23,
      ),
    ).toBeUndefined();
  });

  it('normalizes valid rows and rejects duplicate episodes or BTIH values', () => {
    expect(
      validateBatchMagnetRows(
        [
          {
            episodeNumber: 27,
            id: 1,
            magnetUri: ` magnet:?xt=urn:btih:${HASH_A}&dn=episode-27 `,
          },
          {
            episodeNumber: 28,
            id: 2,
            magnetUri: `magnet:?xt=urn:btih:${HASH_B}&dn=episode-28`,
          },
        ],
        1,
        50,
      ),
    ).toEqual({
      error: null,
      items: [
        {
          episodeNumber: 27,
          magnetUri: `magnet:?xt=urn:btih:${HASH_A}&dn=episode-27`,
        },
        {
          episodeNumber: 28,
          magnetUri: `magnet:?xt=urn:btih:${HASH_B}&dn=episode-28`,
        },
      ],
    });
    expect(
      validateBatchMagnetRows(
        [
          {
            episodeNumber: 27,
            id: 1,
            magnetUri: `magnet:?xt=urn:btih:${HASH_A}`,
          },
          {
            episodeNumber: 27,
            id: 2,
            magnetUri: `magnet:?xt=urn:btih:${HASH_B}`,
          },
        ],
        1,
        50,
      ).error,
    ).toContain('E27');
    expect(
      validateBatchMagnetRows(
        [
          {
            episodeNumber: 27,
            id: 1,
            magnetUri: `magnet:?xt=urn:btih:${HASH_A}&dn=first`,
          },
          {
            episodeNumber: 28,
            id: 2,
            magnetUri: `magnet:?xt=urn:btih:${HASH_A}&dn=second`,
          },
        ],
        1,
        50,
      ).error,
    ).toContain('重复');
  });

  it('rejects missing, invalid and out-of-range row fields before requests', () => {
    expect(
      validateBatchMagnetRows(
        [{ episodeNumber: undefined, id: 1, magnetUri: '' }],
        25,
        50,
      ).error,
    ).toContain('未填写集号');
    expect(
      validateBatchMagnetRows(
        [
          {
            episodeNumber: 24,
            id: 1,
            magnetUri: `magnet:?xt=urn:btih:${HASH_A}`,
          },
        ],
        25,
        23,
      ).error,
    ).toContain('超出当前季');
    expect(
      validateBatchMagnetRows(
        [{ episodeNumber: 27, id: 1, magnetUri: 'https://example.com' }],
        25,
        50,
      ).error,
    ).toContain('40 位 BTIH');
  });

  it('uses global classification and explicit distinct card statistics', () => {
    expect(LIST_SOURCE).toContain(
      'getMediaGovernanceSeriesHistoryClassification',
    );
    expect(LIST_SOURCE).toContain('series.taskCount');
    expect(LIST_SOURCE).toContain('series.boundEpisodeCount');
    expect(LIST_SOURCE).toContain('series.coveragePercent');
    expect(LIST_SOURCE).toContain('series.rssTotalCount');
    expect(LIST_SOURCE).toContain('series.seasonSummaries.map');
    expect(LIST_SOURCE).not.toContain('summarizeSeriesRows');
  });
});
