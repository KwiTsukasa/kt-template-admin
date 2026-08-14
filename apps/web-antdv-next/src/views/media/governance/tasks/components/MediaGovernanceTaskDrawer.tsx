import type { MediaGovernanceApi } from '#/api/media-governance';

import { computed, defineComponent, ref } from 'vue';

import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  message,
  Progress,
  Space,
  Spin,
  Tabs,
  Tag,
} from 'antdv-next';

import {
  getMediaGovernanceEvidence,
  getMediaGovernanceTask,
} from '#/api/media-governance';

const AAlert = Alert as any;
const AButton = Button as any;
const ADescriptions = Descriptions as any;
const ADrawer = Drawer as any;
const AEmpty = Empty as any;
const AProgress = Progress as any;
const ASpace = Space as any;
const ASpin = Spin as any;
const ATabs = Tabs as any;
const ATag = Tag as any;

export interface MediaGovernanceTaskDrawerExposed {
  open: (taskId: string, initialTab?: MediaGovernanceTaskDrawerTabKey) => void;
  refresh: () => Promise<void>;
}

export type MediaGovernanceTaskDrawerTabKey =
  | 'agent'
  | 'evidence'
  | 'mapping'
  | 'metadata'
  | 'overview'
  | 'runs'
  | 'sources'
  | 'subtitles';

export default defineComponent({
  name: 'MediaGovernanceTaskDrawer',
  emits: ['edit'],
  setup(_, { emit, expose }) {
    const activeTab = ref('overview');
    const evidence = ref<MediaGovernanceApi.Evidence>();
    const loading = ref(false);
    const open = ref(false);
    const task = ref<MediaGovernanceApi.Task>();
    const taskId = ref('');
    const title = computed(() => task.value?.titleHint || '媒体治理任务详情');
    const tabItems = computed(() => {
      const item = task.value;
      if (!item) return [];
      return [
        { content: renderOverview(item), key: 'overview', label: '概览' },
        { content: renderSources(item), key: 'sources', label: '来源' },
        { content: renderMappings(item), key: 'mapping', label: '映射' },
        { content: renderSubtitles(item), key: 'subtitles', label: '字幕' },
        { content: renderMetadata(item), key: 'metadata', label: '元数据' },
        { content: renderAgent(item), key: 'agent', label: 'CodexAgent' },
        { content: renderRun(item), key: 'runs', label: '运行' },
        {
          content: renderEvidence(item, evidence.value),
          key: 'evidence',
          label: '证据',
        },
      ];
    });

    function show(
      taskIdentity: string,
      initialTab: MediaGovernanceTaskDrawerTabKey = 'overview',
    ) {
      taskId.value = taskIdentity;
      activeTab.value = initialTab;
      open.value = true;
      void refresh();
    }

    async function refresh() {
      if (!taskId.value) return;
      loading.value = true;
      try {
        const [nextTask, nextEvidence] = await Promise.all([
          getMediaGovernanceTask(taskId.value),
          getMediaGovernanceEvidence(taskId.value),
        ]);
        task.value = nextTask;
        evidence.value = nextEvidence;
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : '任务详情加载失败',
        );
      } finally {
        loading.value = false;
      }
    }

    expose({ open: show, refresh } satisfies MediaGovernanceTaskDrawerExposed);

    return () => (
      <ADrawer
        destroyOnClose={false}
        mask
        onClose={() => (open.value = false)}
        open={open.value}
        size="large"
        title={title.value}
      >
        <ASpin spinning={loading.value}>
          {task.value ? (
            <div class="grid gap-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <ASpace wrap>
                  <ATag color="processing">
                    {task.value.semanticProjection.stageLabel}
                  </ATag>
                  <ATag>{task.value.semanticProjection.runStateLabel}</ATag>
                  <span class="text-sm text-muted-foreground">
                    任务版本 {task.value.revision}
                  </span>
                </ASpace>
                <ASpace>
                  <AButton onClick={() => void refresh()}>刷新</AButton>
                  <AButton
                    disabled={!canEditIdentity(task.value)}
                    onClick={() => emit('edit', task.value)}
                    type="primary"
                  >
                    编辑作品身份
                  </AButton>
                </ASpace>
              </div>
              <ATabs
                activeKey={activeTab.value}
                items={tabItems.value}
                key={`${task.value.id}:${task.value.revision}`}
                onChange={(key: string) => (activeTab.value = key)}
              />
            </div>
          ) : (
            <AEmpty description="尚未加载任务详情" />
          )}
        </ASpin>
      </ADrawer>
    );
  },
});

export function canEditIdentity(task: MediaGovernanceApi.Task) {
  return (
    task.stage === 'intake' &&
    (task.runState === 'draft' || task.runState === 'blocked') &&
    task.activeRunId === null &&
    task.payloadSeal === null &&
    task.sealedPlan === null &&
    task.sealedPlanSha256 === null &&
    task.closedAt === null &&
    task.agentSession === null &&
    task.metadataIdentity === null &&
    task.metadataStatus === 'pending'
  );
}

export function getDiscardDisabledReason(task: MediaGovernanceApi.Task) {
  if (task.stage !== 'intake' || task.runState !== 'draft') {
    return '任务已进入治理流程，只能查看和继续处理。';
  }
  if (task.activeRunId || task.sources.length > 0) {
    return '任务已有来源或运行记录，不能作为空草稿删除。';
  }
  if (task.workItemId) return '任务已绑定本地媒体账本，不能删除。';
  if (
    task.payloadSeal ||
    task.sealedPlan ||
    task.sealedPlanSha256 ||
    task.closedAt ||
    task.agentSession ||
    task.metadataIdentity ||
    task.metadataStatus !== 'pending' ||
    task.units.some(
      (unit) =>
        unit.evidenceSha256 || unit.localAcceptedAt || unit.subtitleContract,
    )
  ) {
    return '任务已有治理状态或验收证据，不能删除。';
  }
  return undefined;
}

function renderOverview(task: MediaGovernanceApi.Task) {
  return (
    <div class="grid gap-4">
      <AAlert
        description={`当前动作：${task.semanticProjection.currentActionLabel}`}
        message={task.nextCommandLabel}
        showIcon
        type={task.gateReason ? 'warning' : 'info'}
      />
      <AProgress percent={task.progress.percent} status="active" />
      <ADescriptions
        bordered
        column={{ lg: 2, md: 2, sm: 1, xl: 2, xs: 1, xxl: 2 }}
        items={[
          {
            content: task.identityPreview.mediaTypeLabel,
            key: 'type',
            label: '作品类型',
          },
          {
            content: task.identityPreview.seasonLabel,
            key: 'season',
            label: '治理单元',
          },
          {
            content: task.identityPreview.providerLabel,
            key: 'provider',
            label: '资料库身份',
          },
          {
            content: task.identityPreview.releaseYearLabel,
            key: 'year',
            label: '首播/上映年份',
          },
          {
            content: task.progress.progressLabel,
            key: 'progress',
            label: '量化进度',
          },
          {
            content: task.progress.heartbeatLabel,
            key: 'heartbeat',
            label: '最后心跳',
          },
          {
            content: task.progress.speedLabel,
            key: 'speed',
            label: '当前速率',
          },
          { content: task.progress.etaLabel, key: 'eta', label: '预计剩余' },
        ]}
      />
    </div>
  );
}

function renderSources(task: MediaGovernanceApi.Task) {
  if (task.sources.length === 0)
    return <AEmpty description="尚未添加媒体或字幕来源" />;
  return (
    <div class="grid gap-3">
      {task.sources.map((source) => (
        <div
          class="rounded border border-solid border-border p-4"
          key={source.id}
        >
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <strong>
              {source.sourceRole === 'primary_media'
                ? '主媒体来源'
                : '补充字幕来源'}
            </strong>
            <ATag>
              {source.transportKind === 'magnet' ? '磁链' : '种子文件'}
            </ATag>
            <ATag
              color={source.sourceHealth === 'viable' ? 'success' : 'warning'}
            >
              {source.sourceHealthLabel}
            </ATag>
          </div>
          <div class="grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
            <span>发布组：{source.releaseGroup || '未声明'}</span>
            <span>季号：{source.seasonNumbers.join('、') || '电影单元'}</span>
            <span>已选文件：{source.selectedFileCount}</span>
            <span>来源检查：{source.sourceHealthReasonLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderMappings(task: MediaGovernanceApi.Task) {
  const mappings = task.sources.flatMap(
    (source) => source.selectedFileMappings,
  );
  if (mappings.length === 0) return <AEmpty description="尚未密封文件映射" />;
  return (
    <div class="grid gap-2">
      {task.units.map((unit) => {
        const unitMappings = mappings.filter(
          (mapping) => mapping.unitId === unit.id,
        );
        return (
          <div
            class="rounded border border-solid border-border p-3"
            key={unit.id}
          >
            <strong>{unit.seasonNumber || '电影单元'}</strong>
            <div class="mt-1 text-sm text-muted-foreground">
              已映射{' '}
              {unitMappings.filter((item) => item.fileRole === 'video').length}{' '}
              个视频、
              {
                unitMappings.filter((item) => item.fileRole === 'subtitle')
                  .length
              }{' '}
              个字幕、
              {
                unitMappings.filter((item) => item.fileRole === 'font').length
              }{' '}
              个字体文件
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderSubtitles(task: MediaGovernanceApi.Task) {
  return (
    <div class="grid gap-2">
      {task.units.map((unit) => (
        <div
          class="rounded border border-solid border-border p-3"
          key={unit.id}
        >
          <div class="flex items-center justify-between gap-3">
            <strong>{unit.seasonNumber || '电影单元'}</strong>
            <ATag color={unit.subtitleContract ? 'success' : 'default'}>
              {unit.subtitleContract
                ? '字幕合同已密封'
                : '使用媒体字幕或待补齐'}
            </ATag>
          </div>
          {unit.subtitleContract ? (
            <div class="mt-2 text-sm text-muted-foreground">
              发布组 {unit.subtitleContract.releaseGroup} · 覆盖{' '}
              {unit.subtitleContract.expectedEpisodeNumbers.length} 集
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function renderMetadata(task: MediaGovernanceApi.Task) {
  return (
    <div class="grid gap-3">
      <AAlert
        message={`元数据状态：${task.semanticProjection.metadataStatusLabel}`}
        showIcon
        type={task.metadataStatus === 'verified' ? 'success' : 'info'}
      />
      {task.units.map((unit) => (
        <div
          class="rounded border border-solid border-border p-3"
          key={unit.id}
        >
          <strong>{unit.seasonNumber || '电影单元'}</strong>
          <div class="mt-2 grid gap-1 text-sm text-muted-foreground md:grid-cols-3">
            <span>身份缺失：{unit.metadataProjection.missingA.length}</span>
            <span>关键展示缺失：{unit.metadataProjection.missingB.length}</span>
            <span>增强展示缺失：{unit.metadataProjection.missingC.length}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderAgent(task: MediaGovernanceApi.Task) {
  if (!task.agentSession)
    return <AEmpty description="当前任务尚未进入 CodexAgent 人工治理" />;
  return (
    <ADescriptions
      bordered
      column={1}
      items={[
        {
          content: task.agentSession.statusLabel,
          key: 'status',
          label: 'Agent 状态',
        },
        {
          content: task.agentSession.currentActionLabel,
          key: 'action',
          label: '当前动作',
        },
        {
          content: task.agentSession.lastHeartbeatLabel,
          key: 'heartbeat',
          label: '最后心跳',
        },
        {
          content: task.agentSession.policyBoundaryLabel,
          key: 'policy',
          label: '运行边界',
        },
      ]}
    />
  );
}

function renderRun(task: MediaGovernanceApi.Task) {
  return (
    <ADescriptions
      bordered
      column={1}
      items={[
        {
          content: task.activeRunId || '当前没有运行中的执行器',
          key: 'run',
          label: '当前运行',
        },
        {
          content: task.semanticProjection.currentActionLabel,
          key: 'action',
          label: '当前动作',
        },
        {
          content: task.semanticProjection.gateReasonLabel,
          key: 'gate',
          label: '阻塞原因',
        },
        {
          content: `${task.progress.completedItems}/${task.progress.totalItems} 项`,
          key: 'items',
          label: '项目进度',
        },
      ]}
    />
  );
}

function renderEvidence(
  task: MediaGovernanceApi.Task,
  evidence?: MediaGovernanceApi.Evidence,
) {
  if (!evidence) return <AEmpty description="证据摘要尚未加载" />;
  const writeLabels: Record<string, string> = {
    cloud: '云端写入',
    database: '数据库直写',
    media: '正式媒体写入',
    nas: 'NAS 越界写入',
    uiMutationOutsideAdmin: 'Admin 外 UI 写入',
  };
  return (
    <div class="grid gap-4">
      <ADescriptions
        bordered
        column={1}
        items={[
          {
            content: evidence.descriptorCount,
            key: 'descriptors',
            label: '来源描述数量',
          },
          {
            content: evidence.localAcceptedUnitCount,
            key: 'accepted',
            label: '本地验收单元',
          },
          {
            content: evidence.metadataStatusLabel,
            key: 'metadata',
            label: '元数据状态',
          },
          {
            content: evidence.agentStatusLabel,
            key: 'agent',
            label: 'Agent 状态',
          },
        ]}
      />
      <div class="grid gap-2 md:grid-cols-2">
        {Object.entries(evidence.writeBoundaries).map(([key, value]) => (
          <div class="rounded border border-solid border-border p-3" key={key}>
            <span class="text-sm text-muted-foreground">
              {writeLabels[key] || key}
            </span>
            <div class="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div class="text-xs text-muted-foreground">任务编号：{task.id}</div>
    </div>
  );
}
