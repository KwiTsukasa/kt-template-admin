import type { TableColumnType } from 'antdv-next';

import type { MediaGovernanceTaskDrawerExposed } from '../tasks/components/MediaGovernanceTaskDrawer';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type { KtTableApi, KtTableRowAction } from '#/components/ktTable';

import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Tag, Typography } from 'antdv-next';

import { getMediaGovernanceTaskPage } from '#/api/media-governance';
import { KtTable, useKtTable } from '#/components/ktTable';

import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';
import MediaGovernanceTaskDrawer from '../tasks/components/MediaGovernanceTaskDrawer';

import './list.scss';

const AAlert = Alert as any;
const AKtTable = KtTable as any;
const ATag = Tag as any;
const ATypographyParagraph = Typography.Paragraph as any;

interface AgentQueueSearchValues {
  keyword?: string;
}

const METADATA_FIELD_LABELS: Record<string, string> = {
  'artwork.banner': '横幅图',
  'artwork.fanart': '背景图',
  'artwork.logo': '标志图',
  'artwork.movie': '电影海报',
  'artwork.poster': '主海报',
  'artwork.s00': '特别篇季海报',
  'artwork.season': '季海报',
  'artwork.series': '剧集海报',
  'audio.commentary': '评论音轨信息',
  'cleanup.downloadOwner': '下载任务清理',
  'cleanup.staging': '暂存目录清理',
  'company.production': '制作公司',
  contentRating: '内容分级',
  'credits.cast': '演员信息',
  'credits.director': '导演信息',
  'credits.writer': '编剧信息',
  'date.episode': '单集播出日期',
  'date.release': '发行日期',
  'date.season': '季度播出日期',
  'extras.description': '附加内容说明',
  'file.playable': '媒体可播放性',
  'fnos.association': '飞牛影视关联',
  genre: '类型',
  'identity.mediaType': '媒体类型',
  'identity.provider': '元数据来源',
  'identity.providerId': '资料库编号',
  'identity.releaseYear': '发行年份',
  'language.extra': '附加语言信息',
  'mapping.seasonEpisode': '季集映射',
  'mapping.targetUnique': '唯一目标映射',
  'metadata.local-nfo': '本地 NFO',
  'path.canonical': '规范媒体路径',
  rating: '评分',
  'stream.audioVideo': '音视频轨道',
  'subtitle.coverage': '字幕覆盖',
  'subtitle.releaseGroup': '字幕发布组',
  'subtitle.runtimeTimeline': '字幕时间轴',
  'summary.episode': '单集简介',
  'summary.series': '剧集简介',
  tag: '标签',
  'title.episode': '单集标题',
  'title.original': '原始标题',
  trailer: '预告片',
  'transaction.sealed': '治理事务密封',
};

function agentStatusColor(
  status: MediaGovernanceApi.AgentSession['status'] | undefined,
) {
  if (status === 'failed') return 'error';
  if (status === 'needs-operator') return 'warning';
  if (status === 'succeeded') return 'success';
  return 'processing';
}

function getCurrentUnit(task: MediaGovernanceApi.Task) {
  const currentUnitId = task.agentSession?.currentUnitId;
  return task.units.find((unit) => unit.id === currentUnitId) || task.units[0];
}

function getUnitLabel(unit: MediaGovernanceApi.TaskUnit | undefined) {
  if (!unit) return '待定位';
  return unit.seasonNumber || '电影单元';
}

function getMetadataFieldLabel(field: string) {
  return METADATA_FIELD_LABELS[field] || '未识别元数据字段';
}

function renderMetadataGaps(task: MediaGovernanceApi.Task) {
  const unit = getCurrentUnit(task);
  if (!unit) return <span class="text-muted-foreground">等待缺口投影</span>;

  const projection = unit.metadataProjection;
  const fields = [
    ...projection.missingA,
    ...projection.missingB,
    ...projection.missingC,
  ].map((field) => getMetadataFieldLabel(field));
  if (fields.length === 0) {
    return <span class="text-muted-foreground">等待 Agent 结论</span>;
  }

  return (
    <div class="grid min-w-0 gap-1">
      <div class="flex flex-wrap gap-1">
        {projection.missingA.length > 0 ? (
          <ATag color="error">硬门禁 {projection.missingA.length}</ATag>
        ) : null}
        {projection.missingB.length > 0 ? (
          <ATag color="warning">关键展示 {projection.missingB.length}</ATag>
        ) : null}
        {projection.missingC.length > 0 ? (
          <ATag>增强展示 {projection.missingC.length}</ATag>
        ) : null}
      </div>
      <ATypographyParagraph
        class="!mb-0"
        ellipsis={{ rows: 2, tooltip: fields.join('、') }}
      >
        {fields.join('、')}
      </ATypographyParagraph>
    </div>
  );
}

function renderAttempts(task: MediaGovernanceApi.Task) {
  const repairAttempts = Math.max(
    0,
    ...task.units.map((unit) => unit.metadataProjection.repairAttempts),
  );
  const identityRefreshAttempts = Math.max(
    0,
    ...task.units.map(
      (unit) => unit.metadataProjection.identityRefreshAttempts || 0,
    ),
  );
  return (
    <div class="grid gap-1">
      <span>确定性修复 {repairAttempts} 次</span>
      <span class="text-xs text-muted-foreground">
        身份刷新 {identityRefreshAttempts} 次
      </span>
    </div>
  );
}

export default defineComponent({
  name: 'MediaGovernanceAgentQueue',
  setup() {
    const detailDrawer = ref<MediaGovernanceTaskDrawerExposed>();
    const columns: Array<TableColumnType<MediaGovernanceApi.Task>> = [
      { dataIndex: 'titleHint', key: 'titleHint', title: '作品', width: 220 },
      { key: 'unit', title: '治理单元', width: 110 },
      { key: 'status', title: 'Agent 状态', width: 130 },
      { key: 'metadataGaps', title: '待处理元数据', width: 340 },
      { key: 'attempts', title: '已执行尝试', width: 160 },
      { key: 'action', title: '当前动作', width: 280 },
      { key: 'heartbeat', title: '最后心跳', width: 130 },
      { dataIndex: 'revision', key: 'revision', title: '任务版本', width: 100 },
    ];
    const api: KtTableApi<MediaGovernanceApi.Task, AgentQueueSearchValues> = {
      list: async (params) =>
        await getMediaGovernanceTaskPage({
          ...params,
          metadataStatus: 'requires-agent',
        }),
    };
    const rowActions: Array<
      KtTableRowAction<MediaGovernanceApi.Task, AgentQueueSearchValues>
    > = [
      {
        key: 'view',
        label: '查看',
        onClick: (task) => detailDrawer.value?.open(task.id, 'agent'),
      },
    ];
    const [registerTable, tableApi] = useKtTable<
      MediaGovernanceApi.Task,
      AgentQueueSearchValues
    >({
      api,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: { allowClear: true },
            fieldName: 'keyword',
            label: '作品或任务编号',
          },
        ],
      },
      rowActions,
      rowKey: 'id',
      tableTitle: 'CodexAgent 人工治理队列',
    });
    const stream = useMediaGovernanceStream({
      onSnapshotRequired: () => void tableApi.reload(),
      onTaskChanged: () => void tableApi.reload(),
    });

    onMounted(stream.start);
    onBeforeUnmount(stream.close);

    return () => (
      <Page autoContentHeight>
        <div class="media-governance-agent-queue-page grid min-h-0 min-w-0 gap-4">
          <AAlert
            message="这里只列出确定性修复后仍需 CodexAgent 或操作员处理的任务；使用“查看”进入治理详情。"
            showIcon
            type="info"
          />
          <div class="media-governance-agent-queue-table min-h-0 min-w-0">
            <AKtTable
              onRegister={registerTable}
              v-slots={{
                bodyCell: ({ column, record }: any) => {
                  const task = record as MediaGovernanceApi.Task;
                  if (column.key === 'titleHint') {
                    return (
                      <div class="grid gap-1">
                        <span class="font-medium">{task.titleHint}</span>
                        <span class="text-xs text-muted-foreground">
                          {task.id}
                        </span>
                      </div>
                    );
                  }
                  if (column.key === 'unit') {
                    return getUnitLabel(getCurrentUnit(task));
                  }
                  if (column.key === 'status') {
                    return (
                      <ATag color={agentStatusColor(task.agentSession?.status)}>
                        {task.agentSession?.statusLabel || '等待启动'}
                      </ATag>
                    );
                  }
                  if (column.key === 'metadataGaps') {
                    return renderMetadataGaps(task);
                  }
                  if (column.key === 'attempts') return renderAttempts(task);
                  if (column.key === 'action') {
                    return (
                      task.agentSession?.currentActionLabel ||
                      task.nextCommandLabel
                    );
                  }
                  if (column.key === 'heartbeat') {
                    return task.agentSession?.lastHeartbeatLabel || '尚无心跳';
                  }
                  return undefined;
                },
              }}
            />
          </div>
          <MediaGovernanceTaskDrawer ref={detailDrawer} />
        </div>
      </Page>
    );
  },
});
