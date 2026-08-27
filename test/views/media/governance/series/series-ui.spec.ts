/* @vitest-environment happy-dom */

import type { MediaGovernanceApi } from '#/api/media-governance';

import { readFileSync } from 'node:fs';

import {
  nextBatchEpisodeNumber,
  normalizeSeriesWorks,
  validateBatchMagnetRows,
} from '@test-source/apps/web-antdv-next/src/views/media/governance/series/detail';
import {
  applyCatalogChangedSeries,
  canDeleteSeries,
} from '@test-source/apps/web-antdv-next/src/views/media/governance/series/list';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@vben/common-ui', () => ({ Page: {}, useVbenModal: vi.fn() }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('#/adapter/form', () => ({ useVbenForm: vi.fn(), z: {} }));
vi.mock('@antdv-next/icons', () => ({
  AppstoreAddOutlined: {},
  CloudDownloadOutlined: {},
  DeleteOutlined: {},
  EyeOutlined: {},
  FileAddOutlined: {},
  FolderAddOutlined: {},
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
  Steps: {},
  Switch: {},
  Tabs: {},
  Tag: {},
  Tooltip: {},
  message: {},
}));
vi.mock('#/api/media-governance', () => ({}));
vi.mock('#/components/kt-card-list', () => ({
  KtCardList: {},
  KtCardListCard: {},
}));
vi.mock(
  '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskDrawer',
  () => ({ default: {} }),
);
vi.mock('#/components/kt-table', () => ({
  KtActionGroup: {},
  KtTable: {},
  useKtTable: () => [vi.fn()],
}));

const DETAIL_SOURCE = readFileSync(
  'apps/web-antdv-next/src/views/media/governance/series/detail.tsx',
  'utf8',
);
const DETAIL_STYLE = readFileSync(
  'apps/web-antdv-next/src/views/media/governance/series/detail.scss',
  'utf8',
);
const LIST_SOURCE = readFileSync(
  'apps/web-antdv-next/src/views/media/governance/series/list.tsx',
  'utf8',
);
const HASH_A = 'a'.repeat(40);
const HASH_B = 'b'.repeat(40);

describe('media governance series UI', () => {
  it('keeps every legacy Series reference in the read-only primary Work projection', () => {
    const detail = {
      references: [
        {
          id: 'series-ref-bangumi-302286',
          provider: 'bangumi',
          providerId: '302286',
          referenceRole: 'catalog-evidence',
          releaseYear: 2022,
          seriesId: 'media-series-bleach',
          title: '死神 千年血战篇',
        },
        {
          id: 'series-ref-bangumi-412916',
          provider: 'bangumi',
          providerId: '412916',
          referenceRole: 'catalog-evidence',
          releaseYear: 2023,
          seriesId: 'media-series-bleach',
          title: '死神 千年血战篇-诀别谭-',
        },
        {
          id: 'series-ref-tmdb-30984',
          provider: 'tmdb',
          providerId: '30984',
          referenceRole: 'canonical',
          releaseYear: 2004,
          seriesId: 'media-series-bleach',
          title: '死神',
        },
      ],
      rssSubscriptions: [],
      seasons: [],
      series: {
        canonicalProvider: 'tmdb',
        canonicalProviderId: '30984',
        createTime: '2026-08-24T00:00:00.000Z',
        id: 'media-series-bleach',
        mediaType: 'tv',
        originalTitle: 'BLEACH',
        primaryWorkId: null,
        releaseYear: 2004,
        revision: 1,
        status: 'active',
        title: '死神',
        updateTime: '2026-08-24T00:00:00.000Z',
      },
      taskBindings: [],
    } as unknown as MediaGovernanceApi.SeriesDetail;

    const normalized = normalizeSeriesWorks(detail);

    expect(normalized.works[0]?.references).toMatchObject([
      {
        provider: 'bangumi',
        providerId: '302286',
        providerNamespace: 'subject',
      },
      {
        provider: 'bangumi',
        providerId: '412916',
        providerNamespace: 'subject',
      },
      { provider: 'tmdb', providerId: '30984', providerNamespace: 'tv' },
    ]);
  });

  it('replaces a matching current-page series card and rejects pagination boundaries', () => {
    const previous = {
      canonicalProviderId: '90001',
      id: 'media-series-auto-0001',
      title: '旧标题',
    } as MediaGovernanceApi.SeriesCard;
    const next = {
      ...previous,
      revision: 2,
      taskCount: 2,
      title: '自动归类作品',
    } as MediaGovernanceApi.SeriesCard;
    const event = {
      changeType: 'updated',
      observedAt: '2026-08-24T00:00:00.000Z',
      revision: 2,
      series: next,
      seriesId: next.id,
      taskId: 'media-task-auto-0001',
      taskIds: ['media-task-auto-0001'],
      updatedAt: '2026-08-24T00:00:00.000Z',
    } as MediaGovernanceApi.CatalogChangedEvent;
    const rows = [previous];

    expect(applyCatalogChangedSeries(rows, event)).toBe(true);
    expect(rows).toEqual([next]);
    expect(applyCatalogChangedSeries(rows, event, '不匹配')).toBe(false);
    expect(
      applyCatalogChangedSeries(rows, {
        ...event,
        seriesId: 'media-series-other-0001',
      }),
    ).toBe(false);
  });

  it('removes a deleted Series event and only exposes deletion for empty shells', () => {
    const empty = {
      bindingCount: 0,
      episodeCount: 0,
      id: 'media-series-empty',
      revision: 1,
      rssTotalCount: 0,
      seasonCount: 0,
      taskCount: 0,
    } as MediaGovernanceApi.SeriesCard;
    const populated = { ...empty, taskCount: 1 };
    const rows = [empty];

    expect(canDeleteSeries(empty)).toBe(true);
    expect(canDeleteSeries(populated)).toBe(false);
    expect(
      applyCatalogChangedSeries(rows, {
        changeType: 'deleted',
        observedAt: '2026-08-27T00:00:00.000Z',
        revision: 2,
        series: null,
        seriesId: empty.id,
        taskId: null,
        taskIds: [],
        updatedAt: '2026-08-27T00:00:00.000Z',
      }),
    ).toBe(true);
    expect(rows).toEqual([]);
  });

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

  it('uses global classification with a compact non-duplicated card summary', () => {
    expect(LIST_SOURCE).toContain(
      'getMediaGovernanceSeriesHistoryClassification',
    );
    expect(LIST_SOURCE).toContain('series.workCount');
    expect(LIST_SOURCE).toContain('series.taskCount');
    expect(LIST_SOURCE).toContain('series.boundEpisodeCount');
    expect(LIST_SOURCE).toContain('series.coveragePercent');
    expect(LIST_SOURCE).toContain('media-governance-series-card__facts');
    expect(LIST_SOURCE).toContain('loading={loading}');
    expect(LIST_SOURCE).not.toContain('<span>{series.rssTotalCount}');
    expect(LIST_SOURCE).not.toContain('series.seasonSummaries.map');
    expect(LIST_SOURCE).not.toContain('media-governance-series-card__metrics');
    expect(LIST_SOURCE).toContain('series.canonicalProvider.toUpperCase()');
    expect(LIST_SOURCE).toContain('series.canonicalProviderId');
    expect(LIST_SOURCE).not.toContain('summarizeSeriesRows');
    expect(LIST_SOURCE).toContain('useMediaGovernanceStream');
    expect(LIST_SOURCE).toContain('onCatalogChanged');
    expect(LIST_SOURCE).toContain('rows.splice(rowIndex, 1, event.series)');
    expect(LIST_SOURCE).toContain('tableApi.reload()');
  });

  it('flattens Work and Season into one card Tabs context row', () => {
    expect(DETAIL_SOURCE).toContain('<AKtCardListCard');
    expect(DETAIL_SOURCE).toContain('<AKtTable');
    expect(DETAIL_SOURCE).toContain('showPagination={false}');
    expect(DETAIL_SOURCE).not.toContain('virtual');
    expect(DETAIL_SOURCE).toContain('taskDrawer.value?.open(taskId)');
    expect(DETAIL_SOURCE).toContain('<MediaGovernanceTaskDrawer');
    expect(DETAIL_SOURCE).not.toContain("name: 'MediaGovernanceTaskDetail'");
    expect(DETAIL_SOURCE).toContain('useVbenModal');
    expect(DETAIL_SOURCE).toContain('useVbenForm');
    expect(DETAIL_SOURCE).toContain('<BatchModal');
    expect(DETAIL_SOURCE).toContain('<BatchForm');
    expect(DETAIL_SOURCE).toContain('<RssModal');
    expect(DETAIL_SOURCE).toContain('<RssForm');
    expect(DETAIL_SOURCE).toContain('<RssDiscoveryPanel');
    expect(DETAIL_SOURCE).toContain('workId={selectedWork.value.id}');
    expect(DETAIL_SOURCE).toContain('createMediaGovernanceWorkTask');
    expect(DETAIL_SOURCE).toContain('renderSeriesContextNavigation');
    expect(DETAIL_SOURCE).not.toContain('MediaGovernanceTaskFormDrawer');
    expect(DETAIL_SOURCE).not.toContain('旧接口只读');
    expect(DETAIL_SOURCE).toContain('applyRssDiscoverySelection');
    expect(DETAIL_SOURCE).toContain('rssSelectedIdentity.value');
    expect(DETAIL_SOURCE).toContain('identity.releaseYear');
    expect(DETAIL_SOURCE).toContain(
      'onInvalidate={invalidateRssDiscoverySelection}',
    );
    expect(DETAIL_SOURCE).toContain('confirmDisabled: true');
    expect(DETAIL_SOURCE).toContain('RSS 地址由聚合结果锁定');
    expect(DETAIL_SOURCE).not.toContain('<AModal');
    expect(DETAIL_SOURCE).not.toContain('<AForm');
    expect(DETAIL_SOURCE).toContain(
      'class="media-governance-series-detail__context-tabs"',
    );
    expect(DETAIL_SOURCE.match(/type="card"/gu)).toHaveLength(1);
    expect(DETAIL_SOURCE).not.toContain('renderWorkSeasonSelector');
    expect(DETAIL_SOURCE).toContain('tabBarExtraContent={actions}');
    expect(DETAIL_SOURCE).not.toContain('legacyContext');
    expect(DETAIL_SOURCE).toMatch(
      /aria-label="添加作品"[^>]*>\s*<AppstoreAddOutlined \/>/u,
    );
    expect(DETAIL_SOURCE).toMatch(
      /aria-label="创建执行任务"[^>]*>\s*<FileAddOutlined \/>/u,
    );
    expect(DETAIL_SOURCE).toMatch(
      /aria-label="添加季"[^>]*>\s*<FolderAddOutlined \/>/u,
    );
    expect(DETAIL_SOURCE).toMatch(
      /aria-label="批量添加磁链"[\s\S]*?<CloudDownloadOutlined \/>/u,
    );
    expect(DETAIL_SOURCE).toMatch(
      /aria-label="创建 RSS 订阅"[^>]*>\s*<LinkOutlined \/>/u,
    );
    expect(DETAIL_SOURCE).not.toContain('media-governance-work-navigation');
    expect(DETAIL_SOURCE).not.toContain('media-governance-season-navigation');
    expect(DETAIL_SOURCE).toMatch(
      /media-governance-series-detail__workspace[\s\S]*media-governance-series-detail__navigators/u,
    );
    expect(DETAIL_SOURCE).toContain('media-governance-series-workspace-header');
    expect(DETAIL_SOURCE).toContain('<Page autoContentHeight>');
    expect(DETAIL_SOURCE).not.toContain('<Page autoContentHeight title=');
    expect(DETAIL_SOURCE).toContain('spinning={loading}');
    expect(DETAIL_SOURCE).toContain('useMediaGovernanceStream');
    expect(DETAIL_SOURCE).toContain('handleCatalogChanged');
    expect(DETAIL_SOURCE).toContain('onBeforeUnmount(stream.close)');
    expect(DETAIL_STYLE).toContain('grid-template-rows: auto minmax(0, 1fr)');
    expect(DETAIL_STYLE).toContain(
      'grid-template-rows: auto auto auto minmax(0, 1fr)',
    );
    expect(DETAIL_STYLE).not.toContain('.media-governance-work-navigation');
    expect(DETAIL_STYLE).not.toContain('.media-governance-season-navigation');
    expect(DETAIL_STYLE).not.toMatch(
      /\.media-governance-series-detail__navigators\s*\{[^}]*(?:padding|border)/u,
    );
    expect(DETAIL_STYLE).toContain('border-width: 0 1px 1px');
    expect(DETAIL_STYLE).toContain('border-radius: 0 0 10px 10px');
    expect(DETAIL_STYLE).not.toMatch(
      /\.media-governance-series-detail__context-tabs\s*\{[^}]*background/u,
    );
  });

  it('keeps RSS subscription information full width with the shared card action footer', () => {
    expect(DETAIL_SOURCE).toContain(
      'class="media-governance-rss-card__content"',
    );
    expect(DETAIL_SOURCE).toContain('class="media-governance-rss-card__meta"');
    expect(DETAIL_SOURCE).toContain('RSS_SUBSCRIPTION_STATUS_PRESENTATION');
    expect(DETAIL_SOURCE).not.toContain('<ASwitch');
    expect(DETAIL_STYLE).toContain('.media-governance-rss-card__feed');
    expect(DETAIL_STYLE).toContain('text-overflow: ellipsis');
  });
});
