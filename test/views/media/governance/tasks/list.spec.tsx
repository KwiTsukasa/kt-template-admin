/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { VNodeChild } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MediaGovernanceTaskList from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/list';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getMediaGovernanceSummary,
  getMediaGovernanceTaskPage,
} from '#/api/media-governance';

const mocks = vi.hoisted(() => ({
  closeStream: vi.fn(),
  detailOpen: vi.fn(),
  registerTable: vi.fn(),
  routerPush: vi.fn(async () => undefined),
  startStream: vi.fn(),
  streamOptions: undefined as any,
  tableRows: [] as MediaGovernanceApi.Task[],
  tableSearch: {} as Record<string, unknown>,
  tableOptions: undefined as any,
  tableReload: vi.fn(async () => undefined),
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    name: 'MockPage',
    props: { autoContentHeight: Boolean },
    setup(props, { slots }) {
      return () =>
        h(
          'main',
          {
            'data-auto-content-height': String(props.autoContentHeight),
            'data-testid': 'page-root',
          },
          slots.default?.(),
        );
    },
  }),
}));

vi.mock('antdv-next', () => {
  const SlotStub = defineComponent({
    name: 'SlotStub',
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  });
  return {
    Button: defineComponent({
      name: 'MockButton',
      props: { disabled: Boolean },
      emits: ['click'],
      setup(props, { emit, slots }) {
        return () =>
          h(
            'button',
            {
              disabled: props.disabled,
              onClick: (event) => {
                if (props.disabled) return;
                emit('click', event);
              },
            },
            slots.default?.(),
          );
      },
    }),
    Card: SlotStub,
    Empty: defineComponent({
      name: 'MockEmpty',
      props: { description: { default: '', type: String } },
      setup(props) {
        return () =>
          h('div', { 'data-testid': 'board-empty' }, props.description);
      },
    }),
    Progress: defineComponent({
      name: 'MockProgress',
      props: { percent: { default: 0, type: Number } },
      setup(props) {
        return () => h('div', `${props.percent}%`);
      },
    }),
    Popover: defineComponent({
      name: 'MockPopover',
      setup(_, { slots }) {
        return () =>
          h('span', { 'data-testid': 'action-more-popover' }, [
            slots.default?.(),
            slots.content?.(),
          ]);
      },
    }),
    Spin: SlotStub,
    Tag: SlotStub,
    Tabs: defineComponent({
      name: 'MockTabs',
      props: {
        activeKey: { default: 'table', type: String },
        items: { default: () => [], type: Array },
      },
      emits: ['update:activeKey'],
      setup(props, { emit }) {
        return () =>
          h(
            'div',
            { 'data-testid': 'view-tabs' },
            (props.items as Array<{ key: string; label: string }>).map((item) =>
              h(
                'button',
                {
                  'data-active': String(props.activeKey === item.key),
                  'data-testid': `view-tab-${item.key}`,
                  onClick: () => emit('update:activeKey', item.key),
                },
                item.label,
              ),
            ),
          );
      },
    }),
    Tooltip: defineComponent({
      name: 'MockTooltip',
      props: { title: { default: '', type: String } },
      setup(props, { slots }) {
        return () =>
          h('span', { 'data-tooltip': props.title }, slots.default?.());
      },
    }),
  };
});

vi.mock('#/components/kt-table', () => ({
  KtActionGroup: defineComponent({
    name: 'MockKtActionGroup',
    inheritAttrs: false,
    props: {
      items: { default: () => [], type: Array },
      moreLabel: { default: '更多操作', type: String },
      visibleCount: { default: 2, type: Number },
    },
    setup(props, { attrs }) {
      return () => {
        const items = props.items as Array<{
          content: unknown;
          key: string;
          overflowContent?: unknown;
        }>;
        const inlineItems = items.slice(0, props.visibleCount);
        const overflowItems = items.slice(props.visibleCount);
        const children = inlineItems.map((item) => item.content as VNodeChild);
        if (overflowItems.length > 0) {
          children.push(
            h('button', { 'aria-label': props.moreLabel }, props.moreLabel),
            ...overflowItems.map(
              (item) => (item.overflowContent ?? item.content) as VNodeChild,
            ),
          );
        }
        return h(
          'div',
          {
            ...attrs,
            'data-inline-action-count': inlineItems.length,
            'data-overflow-action-count': overflowItems.length,
          },
          children,
        );
      };
    },
  }),
  KtTable: defineComponent({
    name: 'MockKtTable',
    emits: ['register'],
    setup(_, { emit, slots }) {
      emit('register', {});
      return () =>
        h('section', { 'data-testid': 'media-task-table' }, [
          slots.headerControls?.(),
          slots.footer?.(),
        ]);
    },
  }),
  useKtTable: vi.fn((options) => {
    mocks.tableOptions = options;
    return [
      mocks.registerTable,
      {
        getProps: () => ({ pageSize: 20 }),
        getRows: () => mocks.tableRows,
        getSearchValues: async () => mocks.tableSearch,
        reload: mocks.tableReload,
      },
    ];
  }),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/media/governance/composables/useMediaGovernanceStream',
  () => ({
    useMediaGovernanceStream: (options: unknown) => {
      mocks.streamOptions = options;
      return {
        close: mocks.closeStream,
        start: mocks.startStream,
      };
    },
  }),
);

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskDrawer',
  () => ({
    canEditIdentity: (task: MediaGovernanceApi.Task) =>
      task.stage === 'intake' &&
      (task.runState === 'draft' || task.runState === 'blocked'),
    default: defineComponent({
      name: 'MockMediaGovernanceTaskDrawer',
      setup(_, { expose }) {
        expose({ open: mocks.detailOpen, refresh: vi.fn() });
        return () => h('div');
      },
    }),
  }),
);

vi.mock('#/api/media-governance', () => ({
  getMediaGovernanceSummary: vi.fn(),
  getMediaGovernanceTaskPage: vi.fn(),
}));

function createTask(): MediaGovernanceApi.Task {
  return {
    activeRunId: null,
    closedAt: null,
    closedMode: null,
    gateReason: null,
    governanceProfile: null,
    id: 'media-task-draft',
    identityPreview: {
      mediaTypeLabel: 'TV 正常剧集',
      providerLabel: '资料库身份待核验',
      releaseYearLabel: '年份待核验',
      seasonLabel: 'S01',
      status: 'pending-provider-verification',
      statusLabel: '待资料源核验',
      title: '测试作品',
    },
    mediaType: 'tv',
    metadataIdentity: null,
    nextCommandLabel: '添加新的主媒体来源',
    operationKind: 'source-intake',
    payloadSeal: null,
    persistenceMode: 'database',
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
    providerRef: null,
    releaseYear: null,
    revision: 4,
    runState: 'draft',
    sealedPlan: null,
    sealedPlanSha256: null,
    semanticProjection: {
      currentActionLabel: '添加新的主媒体来源',
      discardAllowed: true,
      discardReasonLabel: null,
      gateReasonLabel: '无阻塞',
      runStateLabel: '草稿',
      sourceHealthLabel: '尚未检查',
      stageLabel: '接收资料',
    },
    sources: [],
    stage: 'intake',
    seriesId: 'media-series-draft',
    titleHint: '测试作品',
    units: [
      {
        evidenceSha256: null,
        expectedEpisodeNumbers: [],
        id: 'media-unit-s01',
        localAcceptedAt: null,
        seasonNumber: 'S01',
        subtitleContract: null,
        unitKind: 'season',
      },
    ],
    workId: 'media-work-draft',
    workItemId: null,
  };
}

describe('media governance task list CRUD shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.streamOptions = undefined;
    mocks.tableRows.splice(0);
    mocks.tableSearch = {};
    mocks.tableOptions = undefined;
    vi.mocked(getMediaGovernanceTaskPage).mockResolvedValue({
      items: [createTask()],
      total: 1,
    });
    vi.mocked(getMediaGovernanceSummary).mockResolvedValue({
      attentionRequired: 1,
      blocked: 0,
      closed: 0,
      downloading: 0,
      evidenceDriftCount: 0,
      governing: 0,
      healthLabel: '运行核对正常',
      mechanicalClosureRate: 0,
      mixedSubtitleSeasonCount: 0,
      stagingResidualCount: null,
      stuckRunCount: 0,
      total: 1,
    });
  });

  it('registers KtTable with searchable CRUD actions and semantic filters', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();

    expect(wrapper.get('[data-testid="page-root"]').attributes()).toMatchObject(
      {
        'data-auto-content-height': 'true',
      },
    );
    expect(wrapper.findAll('[data-testid="media-task-table"]')).toHaveLength(1);
    expect(mocks.registerTable).toHaveBeenCalledOnce();
    expect(mocks.startStream).toHaveBeenCalledOnce();
    expect(
      mocks.tableOptions.formOptions.schema.map((item: any) => item.fieldName),
    ).toEqual(['keyword', 'stage', 'runState', 'governanceProfile']);
    expect(mocks.tableOptions.buttons).toBeUndefined();
    expect(
      mocks.tableOptions.rowActions.map((item: any) => item.label),
    ).toEqual(['查看']);
    expect(
      mocks.tableOptions.rowActions.every(
        (item: any) =>
          item.rowVisible !== undefined && item.disabled === undefined,
      ),
    ).toBe(true);
    expect(mocks.tableOptions.onRowClick).toBeUndefined();

    await expect(
      mocks.tableOptions.api.list({ pageNo: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ total: 1 });
    expect(getMediaGovernanceTaskPage).toHaveBeenCalledWith({
      pageNo: 1,
      pageSize: 20,
    });
  });

  it('routes a bound Task view into its owning Series and Work', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    const viewAction = mocks.tableOptions.rowActions[0];

    await viewAction.onClick(task);
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'MediaGovernanceSeriesDetail',
      params: { seriesId: task.seriesId },
      query: { tab: 'tasks', taskId: task.id, workId: task.workId },
    });
  });

  it('opens an unbound legacy Task in the fallback read-only drawer', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    task.seriesId = null;
    task.workId = null;
    await mocks.tableOptions.rowActions[0].onClick(task);

    expect(mocks.detailOpen).toHaveBeenCalledWith(task.id);
    expect(mocks.routerPush).not.toHaveBeenCalled();
  });

  it('keeps content-heavy custom columns flexible and readable', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();

    const columns = new Map(
      mocks.tableOptions.columns.map((column: any) => [column.key, column]),
    );
    for (const key of [
      'currentAction',
      'gateReason',
      'progress',
      'titleHint',
    ]) {
      const column = columns.get(key) as any;
      expect(column.width).toBeUndefined();
      expect(column.minWidth).toBeGreaterThanOrEqual(220);
      expect(column.ellipsis).toBe(false);
    }
  });

  it('merges consecutive SSE progress ticks in place without reloading the table', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    task.activeRunId = 'media-run-realtime';
    task.runState = 'running';
    mocks.tableRows.push(task);
    const summary = await getMediaGovernanceSummary();
    const progressEvent = (runSequence: number, percent: number) => ({
      changeType: 'state-updated',
      observedAt: `2026-08-17T10:00:0${runSequence}.000Z`,
      patchMode: 'progress',
      revision: task.revision,
      runId: task.activeRunId,
      runSequence,
      summary,
      task: {
        id: task.id,
        progress: { ...task.progress, completedBytes: percent, percent },
        revision: task.revision,
      },
      taskId: task.id,
      updatedAt: `2026-08-17T10:00:0${runSequence}.000Z`,
    });
    mocks.tableReload.mockClear();

    mocks.streamOptions.onTaskChanged(progressEvent(2, 10));
    await flushPromises();
    mocks.streamOptions.onTaskChanged(progressEvent(3, 20));
    await flushPromises();

    expect(mocks.tableRows[0]?.progress.percent).toBe(20);
    expect(mocks.tableReload).not.toHaveBeenCalled();
  });

  it('keeps the global Task table read-only in every task state', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    task.stage = 'closed';
    task.runState = 'succeeded';
    task.semanticProjection.discardAllowed = false;
    task.semanticProjection.discardReasonLabel = '任务已闭环。';
    expect(mocks.tableOptions.rowActions).toHaveLength(1);
    expect(mocks.tableOptions.rowActions[0]).toMatchObject({
      key: 'view',
      rowVisible: true,
    });
  });

  it('renders the card board directly without a table-board switch', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();
    mocks.tableOptions.afterFetch({ items: [createTask()], total: 1 });
    await flushPromises();

    expect(wrapper.text()).toContain('测试作品');
    expect(wrapper.find('[data-testid="view-tab-table"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="view-tab-board"]').exists()).toBe(false);
  });

  it('renders one semantic view icon and no write action on task cards', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    mocks.tableOptions.afterFetch({ items: [task], total: 1 });
    await flushPromises();

    const actionGroup = wrapper.get(
      '.kt-card-list-card__actions [data-inline-action-count]',
    );
    expect(actionGroup.attributes('data-inline-action-count')).toBe('1');
    expect(actionGroup.attributes('data-overflow-action-count')).toBe('0');
    const viewButton = wrapper.get('[aria-label="查看"]');
    await viewButton.trigger('click');
    expect(mocks.routerPush).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MediaGovernanceSeriesDetail' }),
    );
    expect(wrapper.text()).not.toContain('删除任务');
    expect(wrapper.text()).not.toContain('人工治理');
  });

  it('uses KtCardList for the full-height empty board', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();
    mocks.tableOptions.afterFetch({ items: [], total: 0 });
    await flushPromises();

    expect(wrapper.get('[data-testid="board-empty"]').text()).toBe(
      '当前筛选条件下没有任务',
    );
  });

  it('pins the browser-audited layout and component-library boundaries', () => {
    const root = resolve(
      'apps/web-antdv-next/src/views/media/governance/tasks',
    );
    const listSource = readFileSync(resolve(root, 'list.tsx'), 'utf8');
    const styleSource = readFileSync(resolve(root, 'list.scss'), 'utf8');
    const tableSource = readFileSync(
      resolve('apps/web-antdv-next/src/components/kt-table/KtTable.tsx'),
      'utf8',
    );
    const cardListSource = readFileSync(
      resolve('apps/web-antdv-next/src/components/kt-card-list/KtCardList.tsx'),
      'utf8',
    );
    const cardSource = readFileSync(
      resolve(
        'apps/web-antdv-next/src/components/kt-card-list/KtCardListCard.tsx',
      ),
      'utf8',
    );
    const cardListStyle = readFileSync(
      resolve('apps/web-antdv-next/src/components/kt-card-list/style.scss'),
      'utf8',
    );
    const drawerSource = readFileSync(
      resolve(root, 'components/MediaGovernanceTaskDrawer.tsx'),
      'utf8',
    );
    const mappingSource = readFileSync(
      resolve(root, 'components/MediaGovernanceSourceMappingDrawer.tsx'),
      'utf8',
    );

    expect(styleSource).toContain('grid-template-rows: auto minmax(0, 1fr)');
    expect(styleSource).toContain('height: 100%');
    expect(styleSource).toContain(
      'animation: media-governance-task-view-enter',
    );
    expect(styleSource).toContain('flex: 1 1 0');
    expect(cardListStyle).toContain('min-height: 100%');
    expect(cardListStyle).toContain('auto-fill');
    expect(styleSource).not.toContain('media-governance-task-board');
    expect(listSource).toContain(
      'media-governance-task-table-shell min-h-0 min-w-0',
    );
    expect(listSource).toContain('media-governance-task-page--board');
    expect(listSource).not.toContain('viewMode.value');
    expect(listSource).toContain('class="min-w-0 flex-1"');
    expect(listSource).not.toContain('class="kt-table__header-tabs"');
    expect(listSource).not.toContain("{ key: 'table', label: '表格' }");
    expect(listSource).not.toContain("{ key: 'board', label: '看板' }");
    expect(listSource).not.toContain('Segmented');
    expect(listSource).toContain('<AKtCardList');
    expect(listSource).toContain('<AKtCardListCard');
    expect(listSource).toContain('emptyDescription="当前筛选条件下没有任务"');
    expect(listSource).toContain('loading={loading}');
    expect(cardListSource).toContain('<AEmpty');
    expect(cardListSource).toContain('kt-card-list__skeleton-card');
    expect(cardSource).toContain('kt-card-list-card__actions');
    expect(listSource).not.toContain('onRowClick: openDetail');
    expect(tableSource).toContain('<KtActionGroup');
    expect(listSource).toContain('visibleCount={1}');
    expect(listSource).toContain('<MediaGovernanceTaskDrawer readOnly');
    expect(listSource).toContain('moreTrigger="hover"');
    expect(listSource).toContain('type="text"');
    expect(cardListStyle).toContain('border-top: 1px solid hsl(var(--border))');
    expect(cardListStyle).toContain(
      '.kt-action-group__item + .kt-action-group__item',
    );
    expect(cardListStyle).toContain('border-width: 0');
    expect(tableSource).toContain(
      'if (isKtTableRowActionEvent(event)) return;',
    );
    expect(drawerSource).toContain('<MediaGovernanceTaskOverviewPanel');
    expect(drawerSource).toContain('items={createTabItems(currentTask)}');
    expect(drawerSource).toContain(
      'onSnapshotRequired: () => void refresh(true)',
    );
    expect(drawerSource).toContain('if (!silent) loading.value = true');
    expect(drawerSource).toContain('if (!silent) loading.value = false');
    expect(drawerSource).toMatch(
      /key=\{`\$\{currentTask\.id\}:\$\{currentTask\.revision\}`\}/u,
    );
    expect(drawerSource).not.toContain('renderOverview');
    expect(mappingSource).toContain('const AKtTable = KtTable as any;');
    expect(mappingSource).toContain("overflow: 'hidden'");
    expect(mappingSource).toContain('showPagination={false}');
    expect(mappingSource).not.toContain('scroll={{ x: 960, y: 520 }}');

    for (const source of [listSource, drawerSource, mappingSource]) {
      expect(source).not.toMatch(/<(?:button|form|input|select|textarea)\b/);
    }
  });
});
