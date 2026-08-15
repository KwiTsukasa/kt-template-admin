/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { MediaGovernanceApi } from '#/api/media-governance';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MediaGovernanceTaskList from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/list';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  discardMediaGovernanceTask,
  getMediaGovernanceSummary,
  getMediaGovernanceTaskPage,
} from '#/api/media-governance';

const mocks = vi.hoisted(() => ({
  closeStream: vi.fn(),
  detailOpen: vi.fn(),
  formOpenCreate: vi.fn(),
  formOpenEdit: vi.fn(),
  messageSuccess: vi.fn(),
  registerTable: vi.fn(),
  startStream: vi.fn(),
  tableOptions: undefined as any,
  tableReload: vi.fn(async () => undefined),
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
      emits: ['click'],
      setup(_, { emit, slots }) {
        return () =>
          h(
            'button',
            { onClick: (event) => emit('click', event) },
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
    message: { success: mocks.messageSuccess },
  };
});

vi.mock('#/components/ktTable', () => ({
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
    return [mocks.registerTable, { reload: mocks.tableReload }];
  }),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/media/governance/composables/useMediaGovernanceStream',
  () => ({
    useMediaGovernanceStream: () => ({
      close: mocks.closeStream,
      start: mocks.startStream,
    }),
  }),
);

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskDrawer',
  () => ({
    canEditIdentity: (task: MediaGovernanceApi.Task) =>
      task.stage === 'intake' && task.runState === 'draft',
    default: defineComponent({
      name: 'MockMediaGovernanceTaskDrawer',
      setup(_, { expose }) {
        expose({ open: mocks.detailOpen, refresh: vi.fn() });
        return () => h('div');
      },
    }),
  }),
);

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskFormDrawer',
  () => ({
    default: defineComponent({
      name: 'MockMediaGovernanceTaskFormDrawer',
      setup(_, { expose }) {
        expose({
          openCreate: mocks.formOpenCreate,
          openEdit: mocks.formOpenEdit,
        });
        return () => h('div');
      },
    }),
  }),
);

vi.mock('#/api/media-governance', () => ({
  discardMediaGovernanceTask: vi.fn(),
  getMediaGovernanceSummary: vi.fn(),
  getMediaGovernanceTaskPage: vi.fn(),
}));

function createTask(): MediaGovernanceApi.Task {
  return {
    activeRunId: null,
    agentSession: null,
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
    metadataStatus: 'pending',
    nextCommandLabel: '添加新的主媒体来源',
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
      metadataStatusLabel: '待校验',
      runStateLabel: '草稿',
      sourceHealthLabel: '尚未检查',
      stageLabel: '接收资料',
    },
    sources: [],
    stage: 'intake',
    titleHint: '测试作品',
    units: [
      {
        evidenceSha256: null,
        expectedEpisodeNumbers: [],
        id: 'media-unit-s01',
        localAcceptedAt: null,
        metadataProjection: {
          missingA: [],
          missingB: [],
          missingC: [],
          repairAttempts: 0,
          validBFallbacks: [],
        },
        seasonNumber: 'S01',
        subtitleContract: null,
        unitKind: 'season',
      },
    ],
    workItemId: null,
  };
}

describe('media governance task list CRUD shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tableOptions = undefined;
    vi.mocked(getMediaGovernanceTaskPage).mockResolvedValue({
      items: [createTask()],
      total: 1,
    });
    vi.mocked(getMediaGovernanceSummary).mockResolvedValue({
      agentPending: 0,
      attentionRequired: 1,
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
      total: 1,
    });
    vi.mocked(discardMediaGovernanceTask).mockResolvedValue({
      clearedWorkItemId: null,
      deletedTaskId: 'media-task-draft',
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
    ).toEqual([
      'keyword',
      'stage',
      'runState',
      'governanceProfile',
      'metadataStatus',
    ]);
    expect(mocks.tableOptions.buttons.map((item: any) => item.label)).toEqual([
      '新建治理任务',
    ]);
    expect(
      mocks.tableOptions.rowActions.map((item: any) => item.label),
    ).toEqual(['查看', '编辑', '删除草稿']);
    expect(mocks.tableOptions.onRowClick).toBeUndefined();

    await expect(
      mocks.tableOptions.api.list({ pageNo: 1, pageSize: 20 }),
    ).resolves.toMatchObject({ total: 1 });
    expect(getMediaGovernanceTaskPage).toHaveBeenCalledWith({
      pageNo: 1,
      pageSize: 20,
    });
  });

  it('deletes only through the revision-gated row action and reloads counters', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();
    const discardAction = mocks.tableOptions.rowActions.find(
      (item: any) => item.key === 'discard',
    );
    const task = createTask();

    expect(discardAction.disabled(task)).toBe(false);
    await discardAction.onClick(task, { reload: mocks.tableReload });

    expect(discardMediaGovernanceTask).toHaveBeenCalledWith(
      task.id,
      task.revision,
    );
    expect(mocks.messageSuccess).toHaveBeenCalledWith('任务草稿已删除');
    expect(mocks.tableReload).toHaveBeenCalledOnce();
    expect(getMediaGovernanceSummary).toHaveBeenCalledTimes(2);
  });

  it('uses the shared Tabs pattern to switch between table and board views', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();
    mocks.tableOptions.afterFetch({ items: [createTask()], total: 1 });
    await flushPromises();

    expect(
      wrapper.get('[data-testid="view-tab-table"]').attributes('data-active'),
    ).toBe('true');
    expect(wrapper.text()).not.toContain('测试作品');

    await wrapper.get('[data-testid="view-tab-board"]').trigger('click');
    await flushPromises();

    expect(
      wrapper.get('[data-testid="view-tab-board"]').attributes('data-active'),
    ).toBe('true');
    expect(wrapper.text()).toContain('测试作品');
  });

  it('uses the shared Empty component for the full-height empty board', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();

    await wrapper.get('[data-testid="view-tab-board"]').trigger('click');
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
      resolve('apps/web-antdv-next/src/components/ktTable/KtTable.tsx'),
      'utf8',
    );
    const drawerSource = readFileSync(
      resolve(root, 'components/MediaGovernanceTaskDrawer.tsx'),
      'utf8',
    );
    const formSource = readFileSync(
      resolve(root, 'components/MediaGovernanceTaskFormDrawer.tsx'),
      'utf8',
    );

    expect(styleSource).toContain('grid-template-rows: auto minmax(0, 1fr)');
    expect(styleSource).toContain('height: 100%');
    expect(styleSource).toContain(
      'animation: media-governance-task-view-enter',
    );
    expect(styleSource).toContain('flex: 1 1 0');
    expect(styleSource).toContain('min-height: 100%');
    expect(styleSource).toContain(
      '.media-governance-task-board--empty {\n  display: flex;',
    );
    expect(listSource).toContain(
      'media-governance-task-table-shell min-h-0 min-w-0',
    );
    expect(listSource).toContain('media-governance-task-page--');
    expect(listSource).toContain('viewMode.value');
    expect(listSource).toContain('class="min-w-0 flex-1"');
    expect(listSource).toContain('class="kt-table__header-tabs"');
    expect(listSource).toContain("{ key: 'table', label: '表格' }");
    expect(listSource).toContain("{ key: 'board', label: '看板' }");
    expect(listSource).not.toContain('Segmented');
    expect(listSource).toContain(
      '<AEmpty description="当前筛选条件下没有任务" />',
    );
    expect(listSource).not.toContain('onRowClick: openDetail');
    expect(tableSource).toContain(
      '<ASpace class="kt-table__row-actions" size={0}>',
    );
    expect(tableSource).toContain(
      'if (isKtTableRowActionEvent(event)) return;',
    );
    expect(drawerSource).toContain('<MediaGovernanceTaskOverviewPanel');
    expect(drawerSource).toContain('items={createTabItems(currentTask)}');
    expect(drawerSource).toMatch(
      /key=\{`\$\{currentTask\.id\}:\$\{currentTask\.revision\}`\}/u,
    );
    expect(drawerSource).not.toContain('renderOverview');
    expect(formSource).toContain('footer: () =>');
    expect(formSource).not.toContain('sticky bottom-0');

    for (const source of [listSource, drawerSource, formSource]) {
      expect(source).not.toMatch(/<(?:button|form|input|select|textarea)\b/);
    }
  });
});
