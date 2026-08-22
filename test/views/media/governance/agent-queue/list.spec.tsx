/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { MediaGovernanceApi } from '#/api/media-governance';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MediaGovernanceAgentQueue from '@test-source/apps/web-antdv-next/src/views/media/governance/agent-queue/list';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getMediaGovernanceTaskPage } from '#/api/media-governance';

const mocks = vi.hoisted(() => ({
  bodyCell: undefined as any,
  closeStream: vi.fn(),
  detailOpen: vi.fn(),
  registerTable: vi.fn(),
  routerPush: vi.fn(async () => undefined),
  startStream: vi.fn(),
  streamOptions: undefined as any,
  tableRows: [] as MediaGovernanceApi.Task[],
  tableOptions: undefined as any,
  tableReload: vi.fn(async () => undefined),
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
    Alert: defineComponent({
      name: 'MockAlert',
      props: { message: { default: '', type: String } },
      setup(props) {
        return () => h('div', props.message);
      },
    }),
    Tag: SlotStub,
    Typography: { Paragraph: SlotStub },
  };
});

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    name: 'MockKtTable',
    emits: ['register'],
    setup(_, { emit, slots }) {
      emit('register', {});
      mocks.bodyCell = slots.bodyCell;
      return () => h('section', { 'data-testid': 'agent-queue-table' });
    },
  }),
  useKtTable: vi.fn((options) => {
    mocks.tableOptions = options;
    return [
      mocks.registerTable,
      {
        getProps: () => ({ pageSize: 20 }),
        getRows: () => mocks.tableRows,
        getSearchValues: async () => ({}),
        reload: mocks.tableReload,
      },
    ];
  }),
}));

vi.mock('#/api/media-governance', () => ({
  getMediaGovernanceTaskPage: vi.fn(),
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
    default: defineComponent({
      name: 'MockMediaGovernanceTaskDrawer',
      setup(_, { expose }) {
        expose({ open: mocks.detailOpen, refresh: vi.fn() });
        return () => h('div');
      },
    }),
  }),
);

function createAgentTask(): MediaGovernanceApi.Task {
  return {
    activeRunId: 'run-agent-1',
    agentSession: {
      currentActionLabel: '正在核对 S01 季海报可信来源（3/4）',
      currentUnitId: 'unit-s01',
      lastHeartbeatLabel: '8 秒前',
      policyBoundaryLabel: '五层边界已密封',
      status: 'needs-operator',
      statusLabel: '需要操作员确认',
      threadId: 'thread-agent-1',
    },
    closedAt: null,
    closedMode: null,
    gateReason: 'metadata_requires_agent',
    governanceProfile: 'embedded',
    id: 'media-task-agent-1',
    identityPreview: {
      mediaTypeLabel: 'TV 正常剧集',
      providerLabel: 'TMDB 105473',
      releaseYearLabel: '2024 年',
      seasonLabel: 'S01',
      status: 'pending-provider-verification',
      statusLabel: '待资料源核验',
      title: '测试作品',
    },
    llmConversationId: null,
    mediaType: 'tv',
    metadataIdentity: {
      provider: 'tmdb',
      providerId: '105473',
      releaseYear: 2024,
    },
    metadataStatus: 'requires-agent',
    nextCommandLabel: '等待操作员选择可信候选',
    payloadSeal: {},
    persistenceMode: 'database',
    progress: {
      completedBytes: 0,
      completedItems: 3,
      etaLabel: '等待确认',
      heartbeatLabel: '8 秒前',
      percent: 75,
      progressLabel: '已核对 3/4 项',
      speedLabel: '不适用',
      totalBytes: 0,
      totalItems: 4,
    },
    providerRef: { provider: 'tmdb', providerId: '105473' },
    releaseYear: 2024,
    revision: 12,
    runState: 'blocked',
    sealedPlan: {},
    sealedPlanSha256: 'a'.repeat(64),
    semanticProjection: {
      currentActionLabel: '正在核对季海报可信来源',
      discardAllowed: false,
      discardReasonLabel: '已进入治理阶段，不能删除。',
      gateReasonLabel: '需要人工确认',
      metadataStatusLabel: '需要 Agent 治理',
      runStateLabel: '等待处理',
      sourceHealthLabel: '来源可用',
      stageLabel: '元数据治理',
    },
    sources: [],
    stage: 'metadata',
    titleHint: '测试作品',
    units: [
      {
        evidenceSha256: 'b'.repeat(64),
        expectedEpisodeNumbers: [1],
        id: 'unit-s01',
        localAcceptedAt: null,
        metadataProjection: {
          identityRefreshAttempts: 1,
          missingA: ['identity.provider'],
          missingB: ['artwork.poster', 'metadata.local-nfo'],
          missingC: [],
          repairAttempts: 2,
          validBFallbacks: [],
        },
        seasonNumber: 'S01',
        subtitleContract: null,
        unitKind: 'season',
      },
    ],
    workItemId: 'media-068',
  };
}

describe('media governance Agent queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bodyCell = undefined;
    mocks.streamOptions = undefined;
    mocks.tableRows.splice(0);
    mocks.tableOptions = undefined;
    vi.mocked(getMediaGovernanceTaskPage).mockResolvedValue({
      items: [createAgentTask()],
      total: 1,
    });
  });

  it('uses the full-height KtTable contract and fixed requires-agent query', async () => {
    const wrapper = mount(MediaGovernanceAgentQueue);
    await flushPromises();

    expect(wrapper.get('[data-testid="page-root"]').attributes()).toMatchObject(
      { 'data-auto-content-height': 'true' },
    );
    expect(wrapper.get('.media-governance-agent-queue-page').classes()).toEqual(
      expect.arrayContaining(['grid', 'min-h-0']),
    );
    expect(mocks.tableOptions.rowKey).toBe('id');
    expect(mocks.tableOptions.onRowClick).toBeUndefined();
    expect(mocks.tableOptions.formOptions.schema[0].fieldName).toBe('keyword');
    expect(
      mocks.tableOptions.rowActions.map((item: any) => item.label),
    ).toEqual(['查看']);

    await mocks.tableOptions.api.list({
      keyword: '测试',
      metadataStatus: 'verified',
      pageNo: 1,
      pageSize: 20,
    });
    expect(getMediaGovernanceTaskPage).toHaveBeenCalledWith({
      keyword: '测试',
      metadataStatus: 'requires-agent',
      pageNo: 1,
      pageSize: 20,
    });
  });

  it('renders Chinese gaps and opens the shared drawer on the Agent tab', async () => {
    mount(MediaGovernanceAgentQueue);
    await flushPromises();
    const task = createAgentTask();
    const renderCell = (key: string) =>
      mount(
        defineComponent({
          setup: () => () =>
            h('div', mocks.bodyCell({ column: { key }, record: task })),
        }),
      ).text();

    expect(renderCell('unit')).toBe('S01');
    expect(renderCell('status')).toContain('需要操作员确认');
    expect(renderCell('metadataGaps')).toContain('硬门禁 1');
    expect(renderCell('metadataGaps')).toContain(
      '元数据来源、主海报、本地 NFO',
    );
    expect(renderCell('attempts')).toContain('确定性修复 2 次');
    expect(renderCell('attempts')).toContain('身份刷新 1 次');
    expect(renderCell('heartbeat')).toBe('8 秒前');

    mocks.tableOptions.rowActions[0].onClick(task);
    expect(mocks.routerPush).toHaveBeenCalledWith({
      name: 'MediaGovernanceAgentSession',
      params: { taskId: task.id },
    });
  });

  it('starts and closes the shared semantic event stream', async () => {
    const wrapper = mount(MediaGovernanceAgentQueue);
    await flushPromises();
    expect(mocks.startStream).toHaveBeenCalledOnce();

    wrapper.unmount();
    expect(mocks.closeStream).toHaveBeenCalledOnce();
  });
});
