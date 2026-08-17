import type { TableColumnType } from 'antdv-next';

import type { VNodeChild } from 'vue';

import type { MediaGovernanceTaskEventCursor } from '../composables/mediaGovernanceTaskEvent';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type { KtTableApi, KtTableRowAction } from '#/components/kt-table';

import { defineComponent, onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Tag, Typography } from 'antdv-next';

import { getMediaGovernanceTaskPage } from '#/api/media-governance';
import { KtTable, useKtTable } from '#/components/kt-table';

import { mergeMediaGovernanceTaskRows } from '../composables/mediaGovernanceTaskEvent';
import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';

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

/**
 * 将 Agent 会话状态映射为状态标签颜色。
 *
 * @param status - Agent 会话状态；未知值使用默认颜色。
 * @returns 与 Agent 状态对应的标签颜色；未知状态使用 default。
 */
function agentStatusColor(
  status: MediaGovernanceApi.AgentSession['status'] | undefined,
) {
  if (status === 'failed') return 'error';
  if (status === 'needs-operator') return 'warning';
  if (status === 'succeeded') return 'success';
  return 'processing';
}

/**
 * 读取 Agent 当前治理单元，并在未定位时回退到首个单元。
 *
 * @param task - 提供当前单元标识与治理单元列表的 Agent 队列任务快照。
 * @returns 任务当前单元标识匹配的治理单元；未匹配时回退到首个单元。
 */
function getCurrentUnit(task: MediaGovernanceApi.Task) {
  const currentUnitId = task.agentSession?.currentUnitId;
  return task.units.find((unit) => unit.id === currentUnitId) || task.units[0];
}

/**
 * 根据任务单元类型与季号生成“电影”或“第 N 季”标签。
 *
 * @param unit - 需要生成标签或渲染字幕合同的媒体治理单元。
 * @returns 电影单元或带季号的单元展示文本；缺少单元时显示“未分配”。
 */
function getUnitLabel(unit: MediaGovernanceApi.TaskUnit | undefined) {
  if (!unit) return '待定位';
  return unit.seasonNumber || '电影单元';
}

/**
 * 将元数据字段标识转换为中文展示名。
 *
 * @param field - 需要映射为中文说明的元数据缺口字段名。
 * @returns 元数据字段的中文名称；未知字段保留原字段名。
 */
function getMetadataFieldLabel(field: string) {
  return METADATA_FIELD_LABELS[field] || '未识别元数据字段';
}

/**
 * 渲染 Agent 当前单元的分级元数据缺口。
 *
 * @param task - 提供当前治理单元及其分级元数据缺口的任务快照。
 * @returns 元数据缺口标签列表；没有缺口时渲染“无”。
 */
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
  const gapTags: VNodeChild[] = [];
  if (projection.missingA.length > 0) {
    gapTags.push(
      <ATag color="error">硬门禁 {projection.missingA.length}</ATag>,
    );
  }
  if (projection.missingB.length > 0) {
    gapTags.push(
      <ATag color="warning">关键展示 {projection.missingB.length}</ATag>,
    );
  }
  if (projection.missingC.length > 0) {
    gapTags.push(<ATag>增强展示 {projection.missingC.length}</ATag>);
  }

  return (
    <div class="grid min-w-0 gap-1">
      <div class="flex flex-wrap gap-1">{gapTags}</div>
      <ATypographyParagraph
        class="!mb-0"
        ellipsis={{ rows: 2, tooltip: fields.join('、') }}
      >
        {fields.join('、')}
      </ATypographyParagraph>
    </div>
  );
}

/**
 * 汇总并展示任务各单元已经执行的修复尝试次数。
 *
 * @param task - 提供各治理单元修复与身份刷新次数的任务快照。
 * @returns 治理、修复与验收尝试次数的标签集合。
 */
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
    const router = useRouter();
    const taskEventCursors = new Map<string, MediaGovernanceTaskEventCursor>();
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
        onClick: (task) =>
          void router.push({
            name: 'MediaGovernanceAgentSession',
            params: { taskId: task.id },
          }),
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
    /**
     * 用当前筛选条件重新读取并替换 Agent 队列快照。
     */
    async function reconcileSnapshot() {
      const search = await tableApi.getSearchValues();
      const page = await getMediaGovernanceTaskPage({
        ...search,
        metadataStatus: 'requires-agent',
        pageNo: 1,
        pageSize: tableApi.getProps().pageSize,
      });
      const rows = tableApi.getRows();
      rows.splice(0, rows.length, ...page.items);
      taskEventCursors.clear();
    }

    /**
     * 将单条任务事件合并进队列，并在缺口出现时回读快照。
     *
     * @param event - 服务端推送的任务修订、运行游标与任务补丁。
     */
    async function handleTaskChanged(
      event: MediaGovernanceApi.TaskChangedEvent,
    ) {
      const search = await tableApi.getSearchValues();
      const result = mergeMediaGovernanceTaskRows(
        tableApi.getRows(),
        event,
        taskEventCursors,
        (task) => matchesAgentQueue(task, search),
        tableApi.getProps().pageSize,
      );
      const missingVisibleTask =
        result === 'missing' &&
        event.patchMode === 'full' &&
        matchesAgentQueuePatch(event.task, search);
      if (result === 'gap' || missingVisibleTask) await reconcileSnapshot();
    }

    const stream = useMediaGovernanceStream({
      onSnapshotRequired: () => void reconcileSnapshot(),
      onTaskChanged: (event) => void handleTaskChanged(event),
    });

    onMounted(stream.start);
    onBeforeUnmount(stream.close);

    return () => (
      <Page autoContentHeight>
        <div class="media-governance-agent-queue-page grid min-h-0 min-w-0 gap-4">
          <AAlert
            showIcon
            title="这里只列出确定性修复后仍需 CodexAgent 或操作员处理的任务；使用“查看”进入治理详情。"
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
        </div>
      </Page>
    );
  },
});

/**
 * 判断完整任务是否符合当前 Agent 队列筛选条件。
 *
 * @param task - 要与 Agent 队列关键词及状态条件比较的完整任务快照。
 * @param search - 任务列表或 Agent 队列当前的关键词与状态筛选值。
 * @returns 完整任务满足队列关键词与状态筛选时为 true。
 */
function matchesAgentQueue(
  task: MediaGovernanceApi.Task,
  search: AgentQueueSearchValues,
) {
  if (task.metadataStatus !== 'requires-agent') return false;
  const keyword = search.keyword?.trim().toLowerCase();
  if (!keyword) return true;
  return [task.id, task.titleHint, task.workItemId ?? ''].some((value) =>
    value.toLowerCase().includes(keyword),
  );
}

/**
 * 判断事件中的任务补丁是否可能进入当前 Agent 队列。
 *
 * @param task - 事件携带、用于预判队列归属的任务补丁；缺失时不匹配。
 * @param search - 任务列表或 Agent 队列当前的关键词与状态筛选值。
 * @returns 事件补丁确定或可能满足当前筛选时为 true；明确不符时为 false。
 */
function matchesAgentQueuePatch(
  task: MediaGovernanceApi.TaskChangedEvent['task'],
  search: AgentQueueSearchValues,
) {
  if (!task || task.metadataStatus !== 'requires-agent') return false;
  const keyword = search.keyword?.trim().toLowerCase();
  if (!keyword) return true;
  return [task.id, task.titleHint ?? '', task.workItemId ?? ''].some((value) =>
    value.toLowerCase().includes(keyword),
  );
}
