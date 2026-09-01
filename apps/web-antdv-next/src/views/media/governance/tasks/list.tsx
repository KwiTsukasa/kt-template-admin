import type { TableColumnType } from 'antdv-next';

import type { VNodeChild } from 'vue';

import type { MediaGovernanceTaskEventCursor } from '../composables/mediaGovernanceTaskEvent';
import type { MediaGovernanceTaskDrawerExposed } from './components/MediaGovernanceTaskDrawer';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type {
  KtActionGroupItem,
  KtTableApi,
  KtTablePageResult,
  KtTableRowAction,
} from '#/components/kt-table';

import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { EyeOutlined } from '@antdv-next/icons';
import { Button, Card, Progress, Tag, Tooltip } from 'antdv-next';

import {
  getMediaGovernanceSummary,
  getMediaGovernanceTaskPage,
} from '#/api/media-governance';
import { KtCardList, KtCardListCard } from '#/components/kt-card-list';
import { KtActionGroup, KtTable, useKtTable } from '#/components/kt-table';

import { mergeMediaGovernanceTaskRows } from '../composables/mediaGovernanceTaskEvent';
import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';
import MediaGovernanceTaskDrawer from './components/MediaGovernanceTaskDrawer';

import './list.scss';

const AButton = Button as any;
const ACard = Card as any;
const AKtCardList = KtCardList as any;
const AKtCardListCard = KtCardListCard as any;
const AKtActionGroup = KtActionGroup as any;
const AKtTable = KtTable as any;
const AProgress = Progress as any;
const ATag = Tag as any;
const ATooltip = Tooltip as any;

type TaskSearchValues = Pick<
  MediaGovernanceApi.TaskPageQuery,
  'governanceProfile' | 'keyword' | 'runState' | 'stage'
>;

const EMPTY_SUMMARY: MediaGovernanceApi.Summary = {
  attentionRequired: 0,
  blocked: 0,
  closed: 0,
  downloading: 0,
  evidenceDriftCount: 0,
  governing: 0,
  healthLabel: '正在核对运行状态',
  mechanicalClosureRate: 0,
  mixedSubtitleSeasonCount: 0,
  stagingResidualCount: null,
  stuckRunCount: 0,
  total: 0,
};

const GOVERNANCE_PROFILE_LABELS: Record<
  MediaGovernanceApi.GovernanceProfile,
  string
> = {
  embedded: '内嵌字幕',
  'sidecar-bundled': '同包外挂字幕',
  'sidecar-linked': '关联外挂字幕',
};

const TASK_OPERATION_KIND_LABELS: Record<
  NonNullable<MediaGovernanceApi.Task['operationKind']>,
  string
> = {
  'legacy-pipeline': '历史执行',
  'magnet-batch': '批量磁链',
  'rss-intake': 'RSS 入队',
  'rss-intake-auto': 'RSS 自动入队',
  'source-intake': '来源接收',
};

export default defineComponent({
  name: 'MediaGovernanceTaskList',
  setup() {
    const router = useRouter();
    const detailDrawer = ref<MediaGovernanceTaskDrawerExposed>();
    const summary = ref<MediaGovernanceApi.Summary>({ ...EMPTY_SUMMARY });
    const tableRows = ref<MediaGovernanceApi.Task[]>([]);
    const boardLoading = ref(true);
    const taskEventCursors = new Map<string, MediaGovernanceTaskEventCursor>();
    const columns: Array<TableColumnType<MediaGovernanceApi.Task>> = [
      {
        dataIndex: 'titleHint',
        ellipsis: false,
        key: 'titleHint',
        minWidth: 280,
        title: '任务 / Work',
      },
      {
        dataIndex: 'operationKind',
        key: 'operationKind',
        title: '任务语义',
        width: 130,
      },
      {
        dataIndex: 'mediaType',
        key: 'mediaType',
        title: '类型 / 单元',
        width: 170,
      },
      {
        dataIndex: 'governanceProfile',
        key: 'governanceProfile',
        title: '治理类型',
        width: 145,
      },
      {
        dataIndex: 'semanticProjection',
        key: 'stage',
        title: '阶段 / 状态',
        width: 170,
      },
      {
        dataIndex: 'semanticProjection',
        ellipsis: false,
        key: 'currentAction',
        minWidth: 340,
        title: '当前动作',
      },
      {
        dataIndex: 'progress',
        ellipsis: false,
        key: 'progress',
        minWidth: 280,
        title: '量化进度',
      },
      {
        dataIndex: 'gateReason',
        ellipsis: false,
        key: 'gateReason',
        minWidth: 240,
        title: '阻塞',
      },
    ];
    const api: KtTableApi<MediaGovernanceApi.Task, TaskSearchValues> = {
      list: async (params) => {
        boardLoading.value = true;
        try {
          return await getMediaGovernanceTaskPage(params);
        } finally {
          boardLoading.value = false;
        }
      },
    };
    const rowActions: Array<
      KtTableRowAction<MediaGovernanceApi.Task, TaskSearchValues>
    > = [
      {
        key: 'view',
        label: '查看',
        onClick: openDetail,
        permissionCodes: ['Media:Governance:List'],
        rowVisible: true,
      },
    ];
    const [registerTable, tableApi] = useKtTable<
      MediaGovernanceApi.Task,
      TaskSearchValues
    >({
      afterFetch: (result) => {
        tableRows.value = readPageItems(result);
        boardLoading.value = false;
        return result;
      },
      api,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
              placeholder: '搜索作品名或任务编号',
            },
            fieldName: 'keyword',
            label: '关键词',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '接收资料', value: 'intake' },
                { label: 'NAS 下载', value: 'download' },
                { label: '本地治理', value: 'governance' },
                { label: '机械验收', value: 'acceptance' },
                { label: '已闭环', value: 'closed' },
              ],
            },
            fieldName: 'stage',
            label: '阶段',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '草稿', value: 'draft' },
                { label: '队列中', value: 'queued' },
                { label: '执行中', value: 'running' },
                { label: '等待处理', value: 'blocked' },
                { label: '已完成', value: 'succeeded' },
              ],
            },
            fieldName: 'runState',
            label: '状态',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: Object.entries(GOVERNANCE_PROFILE_LABELS).map(
                ([value, label]) => ({ label, value }),
              ),
            },
            fieldName: 'governanceProfile',
            label: '治理类型',
          },
        ],
      },
      pageSize: 20,
      rowActions,
      rowKey: 'id',
      tableTitle: '媒体治理任务',
    });

    /**
     * 从后端刷新媒体治理任务的阶段与状态聚合计数。
     */
    async function loadSummary() {
      summary.value = await getMediaGovernanceSummary();
    }

    /**
     * 按当前筛选重新读取列表与摘要权威快照。
     */
    async function reconcileSnapshot() {
      const search = await tableApi.getSearchValues();
      const pageSize = tableApi.getProps().pageSize;
      const [page, nextSummary] = await Promise.all([
        getMediaGovernanceTaskPage({ ...search, pageNo: 1, pageSize }),
        getMediaGovernanceSummary(),
      ]);
      const rows = tableApi.getRows();
      rows.splice(0, rows.length, ...page.items);
      tableRows.value = rows;
      summary.value = nextSummary;
      taskEventCursors.clear();
    }

    /**
     * 合并任务实时事件，并在断档或缺行时回读快照。
     *
     * @param event - 服务端推送的任务修订、运行游标与任务补丁。
     */
    async function handleTaskChanged(
      event: MediaGovernanceApi.TaskChangedEvent,
    ) {
      summary.value = event.summary;
      const search = await tableApi.getSearchValues();
      const rows = tableApi.getRows();
      const result = mergeMediaGovernanceTaskRows(
        rows,
        event,
        taskEventCursors,
        (task) => matchesTaskSearch(task, search),
        tableApi.getProps().pageSize,
      );
      tableRows.value = rows;
      const missingVisibleTask =
        result === 'missing' &&
        event.patchMode === 'full' &&
        matchesTaskPatchSearch(event.task, search);
      if (result === 'gap' || missingVisibleTask) await reconcileSnapshot();
    }

    /**
     * 把目标任务标识传入详情抽屉并打开任务页签。
     *
     * @param row - 要打开详情或执行看板操作的媒体治理任务。
     */
    function openDetail(row: MediaGovernanceApi.Task) {
      if (row.seriesId) {
        const query: Record<string, string> = {
          tab: 'tasks',
          taskId: row.id,
        };
        if (row.workId) query.workId = row.workId;
        void router.push({
          name: 'MediaGovernanceSeriesDetail',
          params: { seriesId: row.seriesId },
          query,
        });
        return;
      }
      detailDrawer.value?.open(row.id);
    }

    const stream = useMediaGovernanceStream({
      onSnapshotRequired: () => void reconcileSnapshot(),
      onTaskChanged: (event) => void handleTaskChanged(event),
    });

    onMounted(() => {
      void loadSummary();
      stream.start();
    });
    onBeforeUnmount(stream.close);

    return () => (
      <Page autoContentHeight>
        <div class="media-governance-task-page grid min-h-0 gap-4">
          {renderSummary(summary.value)}
          <div
            class={[
              'media-governance-task-table-shell min-h-0 min-w-0',
              'media-governance-task-page--board',
            ]}
          >
            <AKtTable
              onRegister={registerTable}
              v-slots={{
                bodyCell: ({ column, record }: any) =>
                  renderBodyCell(column.key, record),
                footer: () =>
                  renderBoard(tableRows.value, boardLoading.value, openDetail),
              }}
            />
          </div>
        </div>
        <MediaGovernanceTaskDrawer readOnly ref={detailDrawer} />
      </Page>
    );
  },
});

/**
 * 从 KtTable 支持的响应形态中提取任务行。
 *
 * @param result - 分页接口对象或静态行数组形式的 KtTable 数据源结果。
 * @returns 分页对象的 items 或直接传入的任务数组。
 */
function readPageItems(
  result:
    | KtTablePageResult<MediaGovernanceApi.Task>
    | MediaGovernanceApi.Task[],
) {
  if (Array.isArray(result)) return result;
  return result.items || result.list || result.records || [];
}

/**
 * 根据关键词、阶段和状态判断完整任务是否留在当前列表。
 *
 * @param task - 要与关键词、阶段及状态筛选条件比较的完整任务快照。
 * @param search - 任务列表当前的关键词与状态筛选值。
 * @returns 完整任务满足关键词、阶段与状态筛选时为 true。
 */
function matchesTaskSearch(
  task: MediaGovernanceApi.Task,
  search: TaskSearchValues,
) {
  const keyword = search.keyword?.trim().toLowerCase();
  if (
    keyword &&
    ![task.id, task.titleHint, task.workItemId ?? ''].some((value) =>
      value.toLowerCase().includes(keyword),
    )
  ) {
    return false;
  }
  if (search.stage && task.stage !== search.stage) return false;
  if (search.runState && task.runState !== search.runState) return false;
  if (
    search.governanceProfile &&
    task.governanceProfile !== search.governanceProfile
  ) {
    return false;
  }
  return true;
}

/**
 * 判断事件中的任务补丁是否可能符合当前筛选条件。
 *
 * @param task - 事件携带、用于预判列表归属的任务补丁；缺失字段按可能匹配处理。
 * @param search - 任务列表当前的关键词与状态筛选值。
 * @returns 事件补丁确定或可能满足当前筛选时为 true；明确不符时为 false。
 */
function matchesTaskPatchSearch(
  task: MediaGovernanceApi.TaskChangedEvent['task'],
  search: TaskSearchValues,
) {
  if (!task) return false;
  const keyword = search.keyword?.trim().toLowerCase();
  if (
    keyword &&
    ![task.id, task.titleHint ?? '', task.workItemId ?? ''].some((value) =>
      value.toLowerCase().includes(keyword),
    )
  ) {
    return false;
  }
  if (search.stage && task.stage !== search.stage) return false;
  if (search.runState && task.runState !== search.runState) return false;
  if (
    search.governanceProfile &&
    task.governanceProfile !== search.governanceProfile
  ) {
    return false;
  }
  return true;
}

/**
 * 将任务聚合摘要渲染为状态卡片。
 *
 * @param summary - 需要渲染为状态卡片的媒体治理聚合计数。
 * @returns 按阶段和状态渲染的任务聚合卡片组。
 */
function renderSummary(summary: MediaGovernanceApi.Summary) {
  const cards = [
    { label: '全部任务', tone: 'blue', value: summary.total },
    { label: '下载中', tone: 'cyan', value: summary.downloading },
    { label: '治理中', tone: 'purple', value: summary.governing },
    { label: '等待处理', tone: 'orange', value: summary.attentionRequired },
    { label: '已闭环', tone: 'green', value: summary.closed },
  ];
  return (
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <ACard key={card.label} size="small">
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm text-muted-foreground">{card.label}</span>
            <ATag color={card.tone}>{card.value}</ATag>
          </div>
        </ACard>
      ))}
    </div>
  );
}

/**
 * 根据表格列渲染任务的业务状态单元格。
 *
 * @param key - 决定渲染哪一种任务业务单元格的列键。
 * @param task - 提供目标列所需阶段、状态、来源与执行信息的任务记录。
 * @returns 目标列的业务节点；未接管列返回 undefined。
 */
function renderBodyCell(key: string, task: MediaGovernanceApi.Task) {
  if (key === 'titleHint') {
    return (
      <div class="grid gap-1">
        <span class="font-medium">{task.titleHint}</span>
        <span class="break-all text-xs text-muted-foreground">{task.id}</span>
      </div>
    );
  }
  if (key === 'mediaType') {
    return (
      <div class="grid gap-1">
        <span>{task.identityPreview.mediaTypeLabel}</span>
        <span class="text-xs text-muted-foreground">
          {task.identityPreview.seasonLabel}
        </span>
      </div>
    );
  }
  if (key === 'operationKind') {
    return <ATag>{taskOperationKindLabel(task)}</ATag>;
  }
  if (key === 'governanceProfile') {
    if (task.governanceProfile) {
      return (
        <ATag color="blue">
          {GOVERNANCE_PROFILE_LABELS[task.governanceProfile]}
        </ATag>
      );
    }
    return <span class="text-muted-foreground">待选择</span>;
  }
  if (key === 'stage') {
    return (
      <div class="flex flex-wrap gap-1">
        <ATag color="processing">{task.semanticProjection.stageLabel}</ATag>
        <ATag>{task.semanticProjection.runStateLabel}</ATag>
      </div>
    );
  }
  if (key === 'currentAction') {
    return (
      <div class="grid gap-1">
        <span class="whitespace-normal break-words">
          {task.semanticProjection.currentActionLabel}
        </span>
        <span class="whitespace-normal break-words text-xs text-muted-foreground">
          下一步：{task.nextCommandLabel}
        </span>
      </div>
    );
  }
  if (key === 'progress') {
    return (
      <div class="grid gap-1">
        <AProgress percent={task.progress.percent} size="small" />
        <span class="whitespace-normal break-words text-xs text-muted-foreground">
          {task.progress.progressLabel} · {task.progress.speedLabel}
        </span>
      </div>
    );
  }
  if (key === 'gateReason') {
    if (task.gateReason) {
      return (
        <ATag class="whitespace-normal" color="error">
          {task.semanticProjection.gateReasonLabel}
        </ATag>
      );
    }
    return <span class="text-muted-foreground">无阻塞</span>;
  }
  return undefined;
}

/**
 * 将当前任务页渲染为可交互看板。
 *
 * @param tasks - 当前页需要渲染为看板卡片的媒体治理任务。
 * @param loading - 当前分页、筛选或刷新请求是否仍在读取。
 * @param openDetail - 打开目标任务详情抽屉的回调。
 * @returns 只提供 Series/Work 上下文查看入口的任务看板；无任务时显示空态。
 */
function renderBoard(
  tasks: MediaGovernanceApi.Task[],
  loading: boolean,
  openDetail: (task: MediaGovernanceApi.Task) => void,
) {
  return (
    <AKtCardList
      emptyDescription="当前筛选条件下没有任务"
      itemCount={tasks.length}
      loading={loading}
    >
      {tasks.map((task) => (
        <AKtCardListCard
          class="media-governance-task-card"
          hoverable
          key={task.id}
          onClick={() => openDetail(task)}
          onKeydown={(event: KeyboardEvent) => {
            if (event.key === 'Enter') openDetail(task);
          }}
          role="button"
          tabindex={0}
          v-slots={{
            actions: () => renderBoardActions(task, openDetail),
            default: () => (
              <>
                <div class="flex min-w-0 items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-semibold">{task.titleHint}</div>
                    <div class="mt-1 text-xs text-muted-foreground">
                      {taskOperationKindLabel(task)} ·{' '}
                      {task.identityPreview.seasonLabel}
                    </div>
                  </div>
                  <ATag color="processing">
                    {task.semanticProjection.stageLabel}
                  </ATag>
                </div>
                <div class="grid gap-2 text-sm">
                  <div class="flex justify-between gap-3">
                    <span class="text-muted-foreground">当前动作</span>
                    <span class="text-right">
                      {task.semanticProjection.currentActionLabel}
                    </span>
                  </div>
                </div>
                <AProgress percent={task.progress.percent} size="small" />
              </>
            ),
          }}
        />
      ))}
    </AKtCardList>
  );
}

/**
 * 将持久化任务类型投影为执行语义标签，并为迁移前任务提供明确兜底。
 * @param task - 携带可选 operationKind 的执行任务。
 * @returns 用户可识别的任务来源与执行类型。
 */
function taskOperationKindLabel(task: MediaGovernanceApi.Task) {
  if (!task.operationKind) return '历史任务';
  return TASK_OPERATION_KIND_LABELS[task.operationKind];
}

/**
 * 只把 Series/Work 深链查看投影到全局 Task 看板，明确不返回任何写操作项。
 *
 * @param task - 提供 Series/Work 深链上下文的看板任务。
 * @param openDetail - 打开目标任务详情抽屉的回调。
 * @returns 只含查看语义图标的看板操作组。
 */
function renderBoardActions(
  task: MediaGovernanceApi.Task,
  openDetail: (task: MediaGovernanceApi.Task) => void,
) {
  const items: KtActionGroupItem[] = [
    createBoardActionItem(
      'view',
      '查看',
      () => {
        openDetail(task);
      },
      <EyeOutlined />,
    ),
  ];

  return (
    <AKtActionGroup
      items={items}
      layout="balanced"
      moreLabel="更多"
      moreTrigger="hover"
      size="small"
      visibleCount={1}
    />
  );
}

/**
 * 创建阻止卡片冒泡且支持溢出菜单的看板操作项。
 *
 * @param key - 看板操作项的稳定键。
 * @param label - 看板操作项向用户展示的文本。
 * @param onClick - 操作项被点击且事件冒泡已阻止后执行的回调。
 * @param icon - 看板操作项左侧展示的 Vue 图标节点。
 * @returns 阻止卡片冒泡并执行指定回调的操作项配置。
 */
function createBoardActionItem(
  key: string,
  label: string,
  onClick: () => void,
  icon: VNodeChild,
): KtActionGroupItem {
  /**
   * 阻止卡片点击冒泡后执行操作项回调。
   *
   * @param event - 看板操作按钮收到、需要阻止向卡片冒泡的点击事件。
   */
  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    onClick();
  }

  const overflowContent = (
    <AButton block onClick={handleClick} size="small" type="text">
      {label}
    </AButton>
  );

  if (!icon) {
    return {
      content: overflowContent,
      key,
      overflowContent,
    };
  }

  return {
    content: (
      <ATooltip title={label}>
        <AButton
          aria-label={label}
          block
          onClick={handleClick}
          size="small"
          type="text"
        >
          {icon}
        </AButton>
      </ATooltip>
    ),
    key,
    overflowContent,
  };
}
