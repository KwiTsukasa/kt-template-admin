/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { VNodeChild } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MediaGovernanceTaskList from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/list';
import {
  getAgentStartConfirmation,
  getDiscardConfirmation,
} from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/task-operation-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  discardMediaGovernanceTask,
  getMediaGovernanceSummary,
  getMediaGovernanceTaskPage,
  startMediaGovernanceAgent,
} from '#/api/media-governance';

const mocks = vi.hoisted(() => ({
  closeStream: vi.fn(),
  detailOpen: vi.fn(),
  formOpenCreate: vi.fn(),
  formOpenEdit: vi.fn(),
  messageSuccess: vi.fn(),
  modalConfirm: vi.fn(),
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
    Modal: { confirm: mocks.modalConfirm },
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
    message: { success: mocks.messageSuccess },
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
  startMediaGovernanceAgent: vi.fn(),
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
    llmConversationId: null,
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
    mocks.streamOptions = undefined;
    mocks.tableRows.splice(0);
    mocks.tableSearch = {};
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
    vi.mocked(startMediaGovernanceAgent).mockResolvedValue({
      currentActionLabel: '正在核对当前阶段任务事实',
      currentUnitId: 'media-unit-s01',
      lastHeartbeatLabel: '刚刚',
      policyBoundaryLabel: '五层边界已启用',
      status: 'running',
      statusLabel: 'Agent 正在治理',
      threadId: 'thread-media-agent-draft',
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
    ).toEqual([
      '查看',
      '编辑',
      '创建本地 Codex 对话',
      '进入本地 Codex 对话',
      '删除任务',
    ]);
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

  it('starts CodexAgent only after the shared row confirmation contract', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    const startAction = mocks.tableOptions.rowActions.find(
      (item: any) => item.key === 'start-agent',
    );

    expect(startAction.rowVisible(task)).toBe(true);
    expect(startAction.confirm(task)).toBe(getAgentStartConfirmation(task));
    expect(startMediaGovernanceAgent).not.toHaveBeenCalled();

    await startAction.onClick(task, { reload: mocks.tableReload });

    expect(startMediaGovernanceAgent).toHaveBeenCalledOnce();
    expect(startMediaGovernanceAgent).toHaveBeenCalledWith(
      task.id,
      task.revision,
    );
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'MediaGovernanceAgentSession',
      params: { taskId: task.id },
    });
    expect(mocks.messageSuccess).toHaveBeenCalledWith('本地 Codex 对话已创建');
  });

  it('opens an existing Agent session without starting a duplicate turn', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    task.llmConversationId = '2041700000000190001';
    task.agentSession = {
      currentActionLabel: '正在核对当前阶段任务事实',
      currentUnitId: 'media-unit-s01',
      lastHeartbeatLabel: '刚刚',
      policyBoundaryLabel: '五层边界已启用',
      status: 'running',
      statusLabel: 'Agent 正在治理',
      threadId: 'thread-media-agent-draft',
    };
    const startAction = mocks.tableOptions.rowActions.find(
      (item: any) => item.key === 'start-agent',
    );
    const openAction = mocks.tableOptions.rowActions.find(
      (item: any) => item.key === 'open-agent',
    );

    expect(startAction.rowVisible(task)).toBe(false);
    expect(openAction.rowVisible(task)).toBe(true);
    await openAction.onClick(task);

    expect(startMediaGovernanceAgent).not.toHaveBeenCalled();
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'MediaGovernanceAgentSession',
      params: { taskId: task.id },
    });
  });

  it('hides every Agent entry after the task is closed', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    task.stage = 'closed';
    task.runState = 'succeeded';
    const agentActions = mocks.tableOptions.rowActions.filter((item: any) =>
      ['open-agent', 'start-agent'].includes(item.key),
    );

    expect(agentActions.every((action: any) => !action.rowVisible(task))).toBe(
      true,
    );
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

  it('deletes only through the revision-gated row action and reloads counters', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();
    const discardAction = mocks.tableOptions.rowActions.find(
      (item: any) => item.key === 'discard',
    );
    const task = createTask();

    expect(discardAction.rowVisible(task)).toBe(true);
    await discardAction.onClick(task, { reload: mocks.tableReload });

    expect(discardMediaGovernanceTask).toHaveBeenCalledWith(
      task.id,
      task.revision,
    );
    expect(mocks.messageSuccess).toHaveBeenCalledWith('任务已删除');
    expect(mocks.tableReload).toHaveBeenCalledOnce();
    expect(getMediaGovernanceSummary).toHaveBeenCalledTimes(2);
  });

  it('hides table actions that are unavailable for the current task state', async () => {
    mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    task.stage = 'closed';
    task.runState = 'succeeded';
    task.semanticProjection.discardAllowed = false;
    task.semanticProjection.discardReasonLabel = '任务已闭环。';
    const actions = new Map(
      mocks.tableOptions.rowActions.map((item: any) => [item.key, item]),
    );

    expect((actions.get('view') as any).rowVisible).toBe(true);
    expect((actions.get('edit') as any).rowVisible(task)).toBe(false);
    expect((actions.get('discard') as any).rowVisible(task)).toBe(false);
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

  it('reuses the revision-gated discard contract from a board card', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    mocks.tableOptions.afterFetch({ items: [task], total: 1 });
    await flushPromises();

    const discardButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '删除任务');
    expect(discardButton).toBeDefined();
    if (!discardButton) throw new Error('看板缺少删除任务按钮');
    await discardButton.trigger('click');

    expect(mocks.modalConfirm).toHaveBeenCalledOnce();
    const confirmation = mocks.modalConfirm.mock.calls.at(0)?.at(0);
    if (!confirmation) throw new Error('删除任务按钮没有打开确认框');
    expect(confirmation).toMatchObject({
      content: getDiscardConfirmation(task),
      title: '删除任务',
    });
    await confirmation.onOk();

    expect(discardMediaGovernanceTask).toHaveBeenCalledWith(
      task.id,
      task.revision,
    );
    expect(mocks.messageSuccess).toHaveBeenCalledWith('任务已删除');
    expect(mocks.tableReload).toHaveBeenCalledOnce();
    expect(getMediaGovernanceSummary).toHaveBeenCalledTimes(2);
  });

  it('keeps the board Agent start inert until the second confirmation is accepted', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    mocks.tableOptions.afterFetch({ items: [task], total: 1 });
    await flushPromises();

    const actionGroup = wrapper.get('.media-governance-task-card-actions');
    expect(actionGroup.attributes('data-inline-action-count')).toBe('2');
    expect(actionGroup.attributes('data-overflow-action-count')).toBe('2');
    expect(actionGroup.get('[aria-label="更多"]').text()).toBe('更多');

    const agentButton = wrapper
      .findAll('button')
      .find(
        (button) => button.attributes('aria-label') === '创建本地 Codex 对话',
      );
    if (!agentButton) throw new Error('看板缺少创建本地 Codex 对话按钮');
    await agentButton.trigger('click');

    expect(startMediaGovernanceAgent).not.toHaveBeenCalled();
    expect(mocks.modalConfirm).toHaveBeenCalledOnce();
    const confirmation = mocks.modalConfirm.mock.calls.at(0)?.at(0);
    if (!confirmation) throw new Error('Agent 治理按钮没有打开确认框');
    expect(confirmation).toMatchObject({
      content: getAgentStartConfirmation(task),
      okText: '确认启动',
      title: '创建本地 Codex 对话',
    });

    await confirmation.onOk();

    expect(startMediaGovernanceAgent).toHaveBeenCalledWith(
      task.id,
      task.revision,
    );
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'MediaGovernanceAgentSession',
      params: { taskId: task.id },
    });
  });

  it('hides non-discardable board actions instead of rendering disabled controls', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();
    const task = createTask();
    task.semanticProjection.discardAllowed = false;
    task.semanticProjection.discardReasonLabel = '已进入执行阶段，不能删除。';
    mocks.tableOptions.afterFetch({ items: [task], total: 1 });
    await flushPromises();

    const discardButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '删除任务');
    expect(discardButton).toBeUndefined();
    expect(
      wrapper
        .get('.media-governance-task-card-actions')
        .findAll('button')
        .every((button) => !Object.hasOwn(button.attributes(), 'disabled')),
    ).toBe(true);
    expect(mocks.modalConfirm).not.toHaveBeenCalled();
  });

  it('uses KtCardList for the full-height empty board', async () => {
    const wrapper = mount(MediaGovernanceTaskList);
    await flushPromises();

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
    const cardListStyle = readFileSync(
      resolve('apps/web-antdv-next/src/components/kt-card-list/style.scss'),
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
    expect(listSource).toContain('emptyDescription="当前筛选条件下没有任务"');
    expect(cardListSource).toContain('<AEmpty');
    expect(listSource).not.toContain('onRowClick: openDetail');
    expect(tableSource).toContain('<KtActionGroup');
    expect(listSource).toContain('class="media-governance-task-card-actions"');
    expect(listSource).toContain('visibleCount={2}');
    expect(listSource).toContain('moreTrigger="hover"');
    expect(listSource).toContain('type="text"');
    expect(styleSource).toContain('border-top: 1px solid hsl(var(--border))');
    expect(styleSource).toContain(
      '.kt-action-group__item + .kt-action-group__item',
    );
    expect(styleSource).toContain('border-width: 0');
    expect(tableSource).toContain(
      'if (isKtTableRowActionEvent(event)) return;',
    );
    expect(drawerSource).toContain('<MediaGovernanceTaskOverviewPanel');
    expect(drawerSource).toContain('items={createTabItems(currentTask)}');
    expect(drawerSource).toContain(
      'onSnapshotRequired: () => void refresh(false, true)',
    );
    expect(drawerSource).toContain('if (!silent) loading.value = true');
    expect(drawerSource).toContain('if (!silent) loading.value = false');
    expect(drawerSource).toMatch(
      /key=\{`\$\{currentTask\.id\}:\$\{currentTask\.revision\}`\}/u,
    );
    expect(drawerSource).not.toContain('renderOverview');
    expect(formSource).toContain('footer: () =>');
    expect(formSource).not.toContain('sticky bottom-0');
    expect(mappingSource).toContain('const AKtTable = KtTable as any;');
    expect(mappingSource).toContain("overflow: 'hidden'");
    expect(mappingSource).toContain('showPagination={false}');
    expect(mappingSource).not.toContain('scroll={{ x: 960, y: 520 }}');

    for (const source of [
      listSource,
      drawerSource,
      formSource,
      mappingSource,
    ]) {
      expect(source).not.toMatch(/<(?:button|form|input|select|textarea)\b/);
    }
  });
});
