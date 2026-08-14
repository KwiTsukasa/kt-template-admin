/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { MediaGovernanceApi } from '#/api/media-governance';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MediaGovernanceTaskList from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/list';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addMediaGovernanceMagnetSource,
  bindMediaGovernanceSubtitleContract,
  createMediaGovernanceTask,
  getMediaGovernanceSummary,
  getMediaGovernanceTask,
  getMediaGovernanceTaskPage,
  inspectMediaGovernanceSource,
  probeMediaGovernanceSource,
  startMediaGovernanceDownload,
  startMediaGovernanceRun,
  updateMediaGovernanceSourceSelection,
} from '#/api/media-governance';

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    name: 'MockPage',
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    resolve: ({ params }: { params: { taskId: string } }) => ({
      href: `#/media/governance/tasks/${params.taskId}`,
    }),
  }),
}));

vi.mock('antdv-next', () => ({
  Alert: defineComponent({
    name: 'MockAlert',
    props: { message: { default: '', type: String } },
    setup(props) {
      return () => h('div', { role: 'alert' }, props.message);
    },
  }),
  Card: defineComponent({
    name: 'MockCard',
    props: { title: { default: '', type: String } },
    setup(props, { slots }) {
      return () => h('section', [h('h2', props.title), slots.default?.()]);
    },
  }),
  Tag: defineComponent({
    name: 'MockTag',
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
  Progress: defineComponent({
    name: 'MockProgress',
    props: { percent: { default: 0, type: Number } },
    setup(props) {
      return () => h('div', `${props.percent}%`);
    },
  }),
}));

vi.mock('#/components/ktTable', () => ({
  KtTable: defineComponent({
    name: 'MockKtTable',
    setup() {
      return () => h('div', { 'data-testid': 'kt-table' }, '媒体治理任务表');
    },
  }),
  useKtTable: vi.fn(() => [vi.fn(), { reload: vi.fn(async () => undefined) }]),
}));

vi.mock('#/api/media-governance', () => ({
  addMediaGovernanceMagnetSource: vi.fn(),
  bindMediaGovernanceSubtitleContract: vi.fn(),
  createMediaGovernanceTask: vi.fn(),
  getMediaGovernanceSummary: vi.fn(),
  getMediaGovernanceTask: vi.fn(),
  getMediaGovernanceTaskPage: vi.fn(),
  inspectMediaGovernanceSource: vi.fn(),
  probeMediaGovernanceSource: vi.fn(),
  startMediaGovernanceDownload: vi.fn(),
  startMediaGovernanceRun: vi.fn(),
  updateMediaGovernanceSourceSelection: vi.fn(),
  uploadMediaGovernanceTorrentSource: vi.fn(),
  getMediaGovernanceEventsUrl: vi.fn(() => '/media-governance/events/stream'),
}));

const createdTask = {
  activeRunId: null,
  agentSession: null,
  gateReason: null,
  governanceProfile: null,
  id: 'media-task-demo',
  identityPreview: {
    mediaTypeLabel: 'TV 正常剧集',
    providerLabel: 'TMDB · 105476',
    releaseYearLabel: '2021 年',
    seasonLabel: 'S00、S01',
    status: 'pending-provider-verification' as const,
    statusLabel: '待资料源核验',
    title: '异世界迷宫黑心企业',
  },
  mediaType: 'tv' as const,
  metadataStatus: 'pending' as const,
  nextCommandLabel: '补充并检查来源',
  persistenceMode: 'process-simulator' as const,
  progress: {
    completedBytes: 0,
    completedItems: 0,
    etaLabel: '尚未开始',
    heartbeatLabel: '尚未开始',
    percent: 0,
    progressLabel: '等待来源',
    speedLabel: '0 B/s',
    totalBytes: 0,
    totalItems: 0,
  },
  providerRef: { provider: 'tmdb' as const, providerId: '105476' },
  releaseYear: 2021,
  revision: 1,
  runState: 'draft' as const,
  semanticProjection: {
    currentActionLabel: '等待补充来源',
    gateReasonLabel: '无阻塞',
    metadataStatusLabel: '待校验',
    runStateLabel: '草稿',
    sourceHealthLabel: '未检查',
    stageLabel: '接收资料',
  },
  sources: [],
  stage: 'intake' as const,
  titleHint: '异世界迷宫黑心企业',
  units: [
    {
      expectedEpisodeNumbers: [],
      id: 'media-unit-s00',
      seasonNumber: 'S00',
      subtitleContract: null,
      unitKind: 'season' as const,
    },
    {
      expectedEpisodeNumbers: [],
      id: 'media-unit-s01',
      seasonNumber: 'S01',
      subtitleContract: null,
      unitKind: 'season' as const,
    },
  ],
};

const createdSource = {
  contentKind: 'embedded_subtitle_media' as const,
  descriptorObjectId: 'simulator-private/source',
  descriptorSha256: 'a'.repeat(64),
  id: 'media-source-demo',
  infoHash: '0123456789abcdef0123456789abcdef01234567',
  manifest: [],
  manifestSha256: null,
  manifestState: 'pending-inspection' as const,
  releaseGroup: 'DBD-Raws',
  seasonNumbers: ['S01'],
  selectedBytes: 0,
  selectedFileCount: 0,
  selectedFileIndices: [],
  selectedFileMappings: [],
  sourceHealth: 'unchecked' as const,
  sourceHealthLabel: '尚未检查',
  sourceHealthReasonLabel: '等待运行时探针',
  sourceRole: 'primary_media' as const,
  transportKind: 'magnet' as const,
};

describe('media governance task intake page', () => {
  let currentTask: MediaGovernanceApi.Task;

  beforeEach(() => {
    vi.clearAllMocks();
    currentTask = structuredClone(createdTask);
    vi.mocked(getMediaGovernanceTaskPage).mockResolvedValue({
      items: [],
      total: 0,
    });
    vi.mocked(getMediaGovernanceSummary).mockResolvedValue({
      agentPending: 0,
      attentionRequired: 0,
      blocked: 0,
      closed: 0,
      downloading: 0,
      evidenceDriftCount: 0,
      governing: 0,
      healthLabel: '运行核对正常',
      metadataAutoClosureRate: 0,
      mixedSubtitleSeasonCount: 0,
      stagingResidualCount: null,
      stuckRunCount: 0,
      total: 0,
    });
    vi.mocked(getMediaGovernanceTask).mockImplementation(
      async () => currentTask,
    );
    vi.mocked(createMediaGovernanceTask).mockImplementation(async () => {
      currentTask = structuredClone(createdTask);
      return currentTask;
    });
    vi.mocked(addMediaGovernanceMagnetSource).mockImplementation(
      async (_taskId, input) => {
        const source = {
          ...structuredClone(createdSource),
          contentKind: input.contentKind,
          id:
            input.sourceRole === 'primary_media'
              ? 'media-source-demo'
              : `media-source-subtitle-${input.seasonNumbers?.[0]}`,
          releaseGroup: input.releaseGroup || null,
          seasonNumbers: input.seasonNumbers || [],
          sourceRole: input.sourceRole,
        };
        currentTask = {
          ...currentTask,
          governanceProfile:
            input.contentKind === 'subtitleless_media'
              ? 'sidecar-linked'
              : currentTask.governanceProfile || 'embedded',
          revision: currentTask.revision + 1,
          sources: [...currentTask.sources, source],
        };
        return source;
      },
    );
    vi.mocked(bindMediaGovernanceSubtitleContract).mockImplementation(
      async (_taskId, unitId, input) => {
        const unit = currentTask.units.find((item) => item.id === unitId);
        if (!unit) throw new Error('测试单元不存在');
        const updatedUnit = {
          ...unit,
          expectedEpisodeNumbers: input.expectedEpisodeNumbers,
          subtitleContract: {
            expectedEpisodeNumbers: input.expectedEpisodeNumbers,
            mappings: input.mappings,
            releaseGroup: input.releaseGroup,
            sourceId: input.sourceId,
          },
        };
        currentTask = {
          ...currentTask,
          revision: currentTask.revision + 1,
          units: currentTask.units.map((item) =>
            item.id === unitId ? updatedUnit : item,
          ),
        };
        return updatedUnit;
      },
    );
    vi.mocked(inspectMediaGovernanceSource).mockImplementation(
      async (_taskId, sourceId) => {
        const target = currentTask.sources.find((item) => item.id === sourceId);
        if (!target) throw new Error('测试来源不存在');
        const seasonNumber = target.seasonNumbers[0] || 'S01';
        const manifest =
          target.sourceRole === 'supplemental_subtitle'
            ? [1, 2].map((episodeNumber, index) => ({
                executable: false,
                index,
                relativePath: `${seasonNumber}/${String(episodeNumber).padStart(2, '0')}.chs.ass`,
                sizeBytes: 128,
              }))
            : [
                {
                  executable: false,
                  index: 0,
                  relativePath: 'S01E01.mkv',
                  sizeBytes: 1024,
                },
              ];
        const source = {
          ...target,
          manifest,
          manifestSha256: 'b'.repeat(64),
          manifestState: 'inspected' as const,
          selectedBytes: manifest.reduce(
            (total, entry) => total + entry.sizeBytes,
            0,
          ),
          selectedFileCount: manifest.length,
          selectedFileIndices: manifest.map((entry) => entry.index),
          selectedFileMappings: [],
        };
        currentTask = {
          ...currentTask,
          revision: currentTask.revision + 1,
          sources: currentTask.sources.map((item) =>
            item.id === sourceId ? source : item,
          ),
        };
        return source;
      },
    );
    vi.mocked(updateMediaGovernanceSourceSelection).mockImplementation(
      async (_taskId, sourceId, input) => {
        const target = currentTask.sources.find((item) => item.id === sourceId);
        if (!target) throw new Error('测试来源不存在');
        const source = {
          ...target,
          selectedBytes: target.manifest
            .filter((entry) => input.selectedFileIndices.includes(entry.index))
            .reduce((total, entry) => total + entry.sizeBytes, 0),
          selectedFileCount: input.selectedFileIndices.length,
          selectedFileIndices: input.selectedFileIndices,
          selectedFileMappings: input.fileMappings.map((mapping) => ({
            episodeNumber: mapping.episodeNumber ?? null,
            fileRole: mapping.fileRole,
            index: mapping.index,
            language: mapping.language ?? null,
            unitId: mapping.unitId,
          })),
        };
        currentTask = {
          ...currentTask,
          revision: currentTask.revision + 1,
          sources: currentTask.sources.map((item) =>
            item.id === sourceId ? source : item,
          ),
        };
        return source;
      },
    );
    vi.mocked(probeMediaGovernanceSource).mockImplementation(
      async (_taskId, sourceId) => {
        const target = currentTask.sources.find((item) => item.id === sourceId);
        if (!target) throw new Error('测试来源不存在');
        const source = {
          ...target,
          sourceHealth: 'viable' as const,
          sourceHealthLabel: '演示探针通过',
        };
        currentTask = {
          ...currentTask,
          revision: currentTask.revision + 1,
          sources: currentTask.sources.map((item) =>
            item.id === sourceId ? source : item,
          ),
        };
        return source;
      },
    );
    vi.mocked(startMediaGovernanceDownload).mockImplementation(async () => {
      currentTask = {
        ...currentTask,
        progress: {
          ...currentTask.progress,
          completedItems: 1,
          percent: 100,
          progressLabel: '来源载荷已就绪',
          totalItems: 1,
        },
        revision: currentTask.revision + 1,
        runState: 'succeeded',
        stage: 'download',
      };
      return currentTask;
    });
    vi.mocked(startMediaGovernanceRun).mockImplementation(async () => {
      currentTask = {
        ...currentTask,
        revision: 6,
        runState: 'running',
        stage: 'governance',
      };
      return currentTask;
    });
  });

  it('shows Chinese field guidance and an identity candidate preview', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();

    expect(wrapper.text()).toContain('媒体资料库编号（可选）');
    expect(wrapper.text()).toContain('填错会关联到另一部作品');
    expect(wrapper.text()).toContain('首播/上映年份（可选）');
    expect(wrapper.text()).toContain('同名作品较多时用于缩小范围');
    expect(wrapper.text()).toContain('待资料源核验');
    expect(wrapper.text()).toContain('TV 必须填写季号；特别篇/番外篇使用 S00');
    expect(wrapper.get('[data-testid="kt-table"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('运行核对正常');
    expect(wrapper.text()).toContain('需要关注');
    expect(wrapper.text()).toContain('失联运行');
    expect(wrapper.text()).toContain('证据漂移');
    expect(wrapper.text()).not.toContain('暂存目录残留');
  });

  it('submits a normalized TV draft and renders the API result', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();

    await wrapper
      .get('[data-testid="title-hint"]')
      .setValue('异世界迷宫黑心企业');
    await wrapper.get('[data-testid="season-numbers"]').setValue('S01, s00');
    await wrapper.get('[data-testid="release-year"]').setValue('2021');
    await wrapper.get('[data-testid="provider"]').setValue('tmdb');
    await wrapper.get('[data-testid="provider-id"]').setValue('105476');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(createMediaGovernanceTask).toHaveBeenCalledWith({
      mediaType: 'tv',
      providerRef: { provider: 'tmdb', providerId: '105476' },
      releaseYear: 2021,
      seasonNumbers: ['S00', 'S01'],
      titleHint: '异世界迷宫黑心企业',
    });
    expect(wrapper.text()).toContain('添加来源并继续');
    expect(wrapper.text()).toContain('描述文件只进入媒体专用私有存储');
    expect(wrapper.text()).toContain('无字幕媒体（需关联整季字幕）');
    expect(wrapper.text()).not.toContain('revision');
    expect(getMediaGovernanceTaskPage).toHaveBeenCalledTimes(2);
  });

  it('rejects Movie with S00 locally before calling the API', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();

    await wrapper.get('[data-testid="title-hint"]').setValue('测试电影');
    await wrapper.get('[data-testid="media-type"]').setValue('movie');
    await wrapper.get('[data-testid="season-numbers"]').setValue('S00');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(createMediaGovernanceTask).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain(
      '电影或剧场版不填写季号，也不能使用 S00 代替作品类型',
    );
  });

  it('walks the six-step Demo through source inspection and download readiness', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();

    await wrapper.get('[data-testid="title-hint"]').setValue('完整流程');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    await wrapper
      .get('[data-testid="magnet-uri"]')
      .setValue('magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const clickButton = async (label: string) => {
      const button = wrapper
        .findAll('button')
        .find((item) => item.text().includes(label));
      expect(button).toBeDefined();
      await button?.trigger('click');
      await flushPromises();
    };

    await clickButton('检查来源清单');
    await clickButton('密封文件映射并继续');
    await clickButton('字幕合同已确认，继续');
    await clickButton('探针通过后启动下载');

    expect(wrapper.text()).toContain('来源载荷已就绪');
    expect(wrapper.text()).toContain('开始本地治理');
    expect(wrapper.text()).not.toContain('本地治理演示');
    expect(addMediaGovernanceMagnetSource).toHaveBeenCalledTimes(1);
    expect(inspectMediaGovernanceSource).toHaveBeenCalledTimes(1);
    expect(updateMediaGovernanceSourceSelection).toHaveBeenCalledTimes(1);
    expect(probeMediaGovernanceSource).toHaveBeenCalledTimes(1);
    expect(startMediaGovernanceDownload).toHaveBeenCalledTimes(1);

    await clickButton('开始本地治理');
    expect(startMediaGovernanceRun).toHaveBeenCalledWith('media-task-demo', 6);
  });

  it('binds one complete subtitle source per season with independent release groups', async () => {
    vi.mocked(createMediaGovernanceTask).mockImplementation(async () => {
      currentTask = {
        ...structuredClone(createdTask),
        identityPreview: {
          ...createdTask.identityPreview,
          seasonLabel: 'S01、S02',
        },
        units: [
          {
            expectedEpisodeNumbers: [],
            id: 'media-unit-s01',
            seasonNumber: 'S01',
            subtitleContract: null,
            unitKind: 'season',
          },
          {
            expectedEpisodeNumbers: [],
            id: 'media-unit-s02',
            seasonNumber: 'S02',
            subtitleContract: null,
            unitKind: 'season',
          },
        ],
      };
      return currentTask;
    });
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();

    await wrapper.get('[data-testid="title-hint"]').setValue('分季字幕测试');
    await wrapper.get('[data-testid="season-numbers"]').setValue('S01, S02');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    await wrapper
      .get('[data-testid="content-kind"]')
      .setValue('subtitleless_media');
    await wrapper
      .get('[data-testid="magnet-uri"]')
      .setValue('magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const clickButton = async (label: string) => {
      const button = wrapper
        .findAll('button')
        .find((item) => item.text().includes(label));
      expect(button).toBeDefined();
      await button?.trigger('click');
      await flushPromises();
    };
    await clickButton('检查来源清单');
    await clickButton('密封文件映射并继续');

    await wrapper
      .get('[data-testid="subtitle-magnet-S01"]')
      .setValue('magnet:?xt=urn:btih:1111111111111111111111111111111111111111');
    await wrapper
      .get('[data-testid="subtitle-release-group-S01"]')
      .setValue('Subtitle-Group-A');
    await wrapper.get('[data-testid="subtitle-episodes-S01"]').setValue('1, 2');
    await wrapper
      .get('[data-testid="subtitle-magnet-S02"]')
      .setValue('magnet:?xt=urn:btih:2222222222222222222222222222222222222222');
    await wrapper
      .get('[data-testid="subtitle-release-group-S02"]')
      .setValue('Subtitle-Group-B');
    await wrapper.get('[data-testid="subtitle-episodes-S02"]').setValue('1, 2');
    await clickButton('准备并密封整季字幕');
    await clickButton('准备并密封整季字幕');

    expect(addMediaGovernanceMagnetSource).toHaveBeenNthCalledWith(
      2,
      'media-task-demo',
      expect.objectContaining({
        expectedRevision: 4,
        releaseGroup: 'Subtitle-Group-A',
        seasonNumbers: ['S01'],
        sourceRole: 'supplemental_subtitle',
      }),
    );
    expect(addMediaGovernanceMagnetSource).toHaveBeenNthCalledWith(
      3,
      'media-task-demo',
      expect.objectContaining({
        expectedRevision: 5,
        releaseGroup: 'Subtitle-Group-B',
        seasonNumbers: ['S02'],
        sourceRole: 'supplemental_subtitle',
      }),
    );
    expect(bindMediaGovernanceSubtitleContract).toHaveBeenNthCalledWith(
      1,
      'media-task-demo',
      'media-unit-s01',
      expect.objectContaining({
        expectedRevision: 9,
        releaseGroup: 'Subtitle-Group-A',
      }),
    );
    expect(bindMediaGovernanceSubtitleContract).toHaveBeenNthCalledWith(
      2,
      'media-task-demo',
      'media-unit-s02',
      expect.objectContaining({
        expectedRevision: 11,
        releaseGroup: 'Subtitle-Group-B',
      }),
    );
    expect(wrapper.text()).toContain('探针通过后启动下载');
    expect(wrapper.text()).not.toContain('启动下载演示');
  });
});
