import type { TableColumnType } from 'antdv-next';

import type { VNodeChild } from 'vue';

import type { MediaGovernanceTaskEventCursor } from '../composables/mediaGovernanceTaskEvent';
import type { MediaGovernanceTaskDrawerExposed } from './components/MediaGovernanceTaskDrawer';
import type { MediaGovernanceTaskFormDrawerExposed } from './components/MediaGovernanceTaskFormDrawer';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type {
  KtActionGroupItem,
  KtTableApi,
  KtTableButton,
  KtTablePageResult,
  KtTableRowAction,
} from '#/components/kt-table';

import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { EyeOutlined, RobotOutlined } from '@antdv-next/icons';
import {
  Button,
  Card,
  message,
  Modal,
  Progress,
  Tag,
  Tooltip,
} from 'antdv-next';

import {
  discardMediaGovernanceTask,
  getMediaGovernanceSummary,
  getMediaGovernanceTaskPage,
  startMediaGovernanceAgent,
} from '#/api/media-governance';
import { KtCardList } from '#/components/kt-card-list';
import { KtActionGroup, KtTable, useKtTable } from '#/components/kt-table';

import { mergeMediaGovernanceTaskRows } from '../composables/mediaGovernanceTaskEvent';
import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';
import MediaGovernanceTaskDrawer, {
  canEditIdentity,
} from './components/MediaGovernanceTaskDrawer';
import MediaGovernanceTaskFormDrawer from './components/MediaGovernanceTaskFormDrawer';
import {
  canDiscardMediaGovernanceTask,
  canOpenMediaGovernanceAgent,
  canStartMediaGovernanceAgent,
  getAgentStartConfirmation,
  getDiscardConfirmation,
} from './task-operation-contract';

import './list.scss';

const AButton = Button as any;
const ACard = Card as any;
const AKtCardList = KtCardList as any;
const AKtActionGroup = KtActionGroup as any;
const AKtTable = KtTable as any;
const AProgress = Progress as any;
const ATag = Tag as any;
const ATooltip = Tooltip as any;

type TaskSearchValues = Pick<
  MediaGovernanceApi.TaskPageQuery,
  'governanceProfile' | 'keyword' | 'metadataStatus' | 'runState' | 'stage'
>;

const EMPTY_SUMMARY: MediaGovernanceApi.Summary = {
  agentPending: 0,
  attentionRequired: 0,
  blocked: 0,
  closed: 0,
  downloading: 0,
  evidenceDriftCount: 0,
  governing: 0,
  healthLabel: '正在核对运行状态',
  metadataAutoClosureRate: 0,
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

export default defineComponent({
  name: 'MediaGovernanceTaskList',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const router = useRouter();
    const detailDrawer = ref<MediaGovernanceTaskDrawerExposed>();
    const formDrawer = ref<MediaGovernanceTaskFormDrawerExposed>();
    const summary = ref<MediaGovernanceApi.Summary>({ ...EMPTY_SUMMARY });
    const tableRows = ref<MediaGovernanceApi.Task[]>([]);
    const taskEventCursors = new Map<string, MediaGovernanceTaskEventCursor>();
    const columns: Array<TableColumnType<MediaGovernanceApi.Task>> = [
      {
        dataIndex: 'titleHint',
        ellipsis: false,
        key: 'titleHint',
        minWidth: 280,
        title: '作品',
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
        dataIndex: 'metadataStatus',
        key: 'metadataStatus',
        title: '元数据',
        width: 125,
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
      list: async (params) => await getMediaGovernanceTaskPage(params),
    };
    const buttons: Array<
      KtTableButton<MediaGovernanceApi.Task, TaskSearchValues>
    > = [
      {
        key: 'create',
        label: '新建治理任务',
        onClick: () => formDrawer.value?.openCreate(),
        permissionCodes: ['Media:Governance:Create'],
        type: 'primary',
      },
    ];
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
      {
        key: 'edit',
        label: '编辑',
        onClick: (row) => formDrawer.value?.openEdit(row),
        permissionCodes: ['Media:Governance:Create'],
        rowVisible: canEditIdentity,
      },
      {
        confirm: getAgentStartConfirmation,
        key: 'start-agent',
        label: '创建本地 Codex 对话',
        onClick: (row, context) => startAgentTask(row, context.reload),
        permissionCodes: ['Media:Governance:AgentStart'],
        rowVisible: canStartMediaGovernanceAgent,
      },
      {
        key: 'open-agent',
        label: '进入本地 Codex 对话',
        onClick: openAgentSession,
        permissionCodes: ['Media:Governance:AgentOperate'],
        rowVisible: canOpenMediaGovernanceAgent,
      },
      {
        confirm: getDiscardConfirmation,
        danger: true,
        key: 'discard',
        label: '删除任务',
        onClick: (row, context) => discardTask(row, context.reload),
        permissionCodes: ['Media:Governance:Create'],
        rowVisible: canDiscardMediaGovernanceTask,
      },
    ];
    const [registerTable, tableApi] = useKtTable<
      MediaGovernanceApi.Task,
      TaskSearchValues
    >({
      afterFetch: (result) => {
        tableRows.value = readPageItems(result);
        return result;
      },
      api,
      buttons,
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
                { label: '元数据核验', value: 'metadata' },
                { label: '独立验收', value: 'acceptance' },
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
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '待校验', value: 'pending' },
                { label: '需要人工治理', value: 'requires-agent' },
                { label: '已验证', value: 'verified' },
              ],
            },
            fieldName: 'metadataStatus',
            label: '元数据',
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
     * 在删除任务后并行刷新聚合摘要与当前表格页。
     *
     * @param task - 要按修订号删除并用于刷新摘要的任务快照。
     * @param reload - 任务变更成功后重新加载当前表格页的异步回调。
     */
    async function discardTask(
      task: MediaGovernanceApi.Task,
      reload: () => Promise<void>,
    ) {
      const result = await discardMediaGovernanceTask(task.id, task.revision);
      let successMessage = '任务已删除';
      if (result.clearedWorkItemId) {
        successMessage = `任务与本地账本 ${result.clearedWorkItemId} 已删除`;
      }
      message.success(successMessage);
      await Promise.all([loadSummary(), reload()]);
    }

    /**
     * 从看板弹出任务删除确认框。
     *
     * @param task - 提供删除确认文案与实际删除回调所需字段的看板任务。
     */
    function confirmBoardDiscard(task: MediaGovernanceApi.Task) {
      Modal.confirm({
        cancelText: '取消',
        content: getDiscardConfirmation(task),
        okText: '确认删除',
        onOk: () => discardTask(task, tableApi.reload),
        title: '删除任务',
      });
    }

    /**
     * 从看板弹出 Agent 启动确认框。
     *
     * @param task - 提供 Agent 启动确认文案与启动回调所需字段的看板任务。
     */
    function confirmBoardAgentStart(task: MediaGovernanceApi.Task) {
      Modal.confirm({
        cancelText: '取消',
        content: getAgentStartConfirmation(task),
        okText: '确认启动',
        onOk: () => startAgentTask(task, tableApi.reload),
        title: '创建本地 Codex 对话',
      });
    }

    /**
     * 启动任务 Agent、同步列表并进入同一会话。
     *
     * @param task - 要按当前修订启动 Agent 并跳转会话页的任务快照。
     * @param reload - 任务变更成功后重新加载当前表格页的异步回调。
     */
    async function startAgentTask(
      task: MediaGovernanceApi.Task,
      reload: () => Promise<void>,
    ) {
      await startMediaGovernanceAgent(task.id, task.revision);
      message.success('本地 Codex 对话已创建');
      await Promise.all([loadSummary(), reload()]);
      await router.push({
        name: 'MediaGovernanceAgentSession',
        params: { taskId: task.id },
      });
    }

    /**
     * 将任务标识写入路由并跳转到 Agent 完整会话页。
     *
     * @param task - 提供 Agent 会话路由任务标识的任务记录。
     */
    function openAgentSession(task: MediaGovernanceApi.Task) {
      void router.push({
        name: 'MediaGovernanceAgentSession',
        params: { taskId: task.id },
      });
    }

    /**
     * 并行刷新摘要与列表，并按需刷新已打开详情。
     *
     * @param refreshDetail - 列表刷新后是否同时刷新已打开的任务详情；未传入时使用 `false`。
     */
    async function refreshAll(refreshDetail = false) {
      await Promise.all([loadSummary(), tableApi.reload()]);
      if (refreshDetail) await detailDrawer.value?.refresh();
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
      detailDrawer.value?.open(row.id);
    }

    /**
     * 表单保存后刷新列表并打开最新任务详情。
     *
     * @param task - 表单保存后返回、需要打开最新详情的任务快照。
     */
    async function handleSaved(task: MediaGovernanceApi.Task) {
      await refreshAll(false);
      detailDrawer.value?.open(task.id);
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
                  renderBoard(
                    tableRows.value,
                    openDetail,
                    (task) => formDrawer.value?.openEdit(task),
                    openAgentSession,
                    confirmBoardAgentStart,
                    confirmBoardDiscard,
                    hasAccessByCodes(['Media:Governance:AgentStart']),
                    hasAccessByCodes(['Media:Governance:AgentOperate']),
                  ),
              }}
            />
          </div>
        </div>
        <MediaGovernanceTaskDrawer
          onChanged={() => void refreshAll(false)}
          onEdit={(task: MediaGovernanceApi.Task) =>
            formDrawer.value?.openEdit(task)
          }
          ref={detailDrawer}
        />
        <MediaGovernanceTaskFormDrawer
          onSaved={(task: MediaGovernanceApi.Task) => void handleSaved(task)}
          ref={formDrawer}
        />
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
 * @param search - 任务列表或 Agent 队列当前的关键词与状态筛选值。
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
  if (search.metadataStatus && task.metadataStatus !== search.metadataStatus) {
    return false;
  }
  return true;
}

/**
 * 判断事件中的任务补丁是否可能符合当前筛选条件。
 *
 * @param task - 事件携带、用于预判列表归属的任务补丁；缺失字段按可能匹配处理。
 * @param search - 任务列表或 Agent 队列当前的关键词与状态筛选值。
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
  if (search.metadataStatus && task.metadataStatus !== search.metadataStatus) {
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
  if (key === 'metadataStatus') {
    let color = 'warning';
    if (task.metadataStatus === 'verified') {
      color = 'success';
    }
    return (
      <ATag color={color}>{task.semanticProjection.metadataStatusLabel}</ATag>
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
 * @param openDetail - 打开目标任务详情抽屉的回调。
 * @param openEdit - 打开目标任务身份编辑表单的回调。
 * @param openAgent - 打开目标任务 Agent 会话的回调。
 * @param confirmAgentStart - 用户确认后启动目标任务 Agent 的回调。
 * @param confirmDiscard - 用户确认后删除目标任务的回调。
 * @param canStartAgent - 当前任务状态是否允许启动或重试 Agent。
 * @param canOperateAgent - 当前账号是否拥有 Agent 操作权限。
 * @returns 包含任务卡片与操作入口的看板；无任务时显示空态。
 */
function renderBoard(
  tasks: MediaGovernanceApi.Task[],
  openDetail: (task: MediaGovernanceApi.Task) => void,
  openEdit: (task: MediaGovernanceApi.Task) => void,
  openAgent: (task: MediaGovernanceApi.Task) => void,
  confirmAgentStart: (task: MediaGovernanceApi.Task) => void,
  confirmDiscard: (task: MediaGovernanceApi.Task) => void,
  canStartAgent: boolean,
  canOperateAgent: boolean,
) {
  return (
    <AKtCardList
      emptyDescription="当前筛选条件下没有任务"
      itemCount={tasks.length}
    >
      {tasks.map((task) => (
        <ACard
          class="media-governance-task-card"
          hoverable
          key={task.id}
          onClick={() => openDetail(task)}
          onKeydown={(event: KeyboardEvent) => {
            if (event.key === 'Enter') openDetail(task);
          }}
          role="button"
          tabindex={0}
        >
          <div class="media-governance-task-card-content">
            <div class="flex min-w-0 items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="truncate font-semibold">{task.titleHint}</div>
                <div class="mt-1 text-xs text-muted-foreground">
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
              <div class="flex justify-between gap-3">
                <span class="text-muted-foreground">元数据</span>
                <span>{task.semanticProjection.metadataStatusLabel}</span>
              </div>
            </div>
            <AProgress percent={task.progress.percent} size="small" />
            {renderBoardActions(
              task,
              openDetail,
              openEdit,
              openAgent,
              confirmAgentStart,
              confirmDiscard,
              canStartAgent,
              canOperateAgent,
            )}
          </div>
        </ACard>
      ))}
    </AKtCardList>
  );
}

/**
 * 根据权限与任务状态组装看板操作组。
 *
 * @param task - 提供当前权限前置条件与可执行操作投影的看板任务。
 * @param openDetail - 打开目标任务详情抽屉的回调。
 * @param openEdit - 打开目标任务身份编辑表单的回调。
 * @param openAgent - 打开目标任务 Agent 会话的回调。
 * @param confirmAgentStart - 用户确认后启动目标任务 Agent 的回调。
 * @param confirmDiscard - 用户确认后删除目标任务的回调。
 * @param canStartAgent - 当前任务状态是否允许启动或重试 Agent。
 * @param canOperateAgent - 当前账号是否拥有 Agent 操作权限。
 * @returns 根据权限与任务状态生成的看板操作组。
 */
function renderBoardActions(
  task: MediaGovernanceApi.Task,
  openDetail: (task: MediaGovernanceApi.Task) => void,
  openEdit: (task: MediaGovernanceApi.Task) => void,
  openAgent: (task: MediaGovernanceApi.Task) => void,
  confirmAgentStart: (task: MediaGovernanceApi.Task) => void,
  confirmDiscard: (task: MediaGovernanceApi.Task) => void,
  canStartAgent: boolean,
  canOperateAgent: boolean,
) {
  const items: KtActionGroupItem[] = [];

  if (canStartAgent && canStartMediaGovernanceAgent(task)) {
    items.push(
      createBoardActionItem(
        'start-agent',
        '创建本地 Codex 对话',
        () => {
          confirmAgentStart(task);
        },
        <RobotOutlined />,
      ),
    );
  } else if (canOperateAgent && canOpenMediaGovernanceAgent(task)) {
    items.push(
      createBoardActionItem(
        'open-agent',
        '进入本地 Codex 对话',
        () => {
          openAgent(task);
        },
        <RobotOutlined />,
      ),
    );
  }

  items.push(
    createBoardActionItem(
      'view',
      '查看',
      () => {
        openDetail(task);
      },
      <EyeOutlined />,
    ),
  );

  if (canEditIdentity(task)) {
    items.push(
      createBoardActionItem(
        'edit',
        '编辑',
        () => {
          openEdit(task);
        },
        null,
      ),
    );
  }

  if (canDiscardMediaGovernanceTask(task)) {
    items.push(
      createBoardActionItem(
        'discard',
        '删除任务',
        () => {
          confirmDiscard(task);
        },
        null,
        true,
      ),
    );
  }

  return (
    <AKtActionGroup
      class="media-governance-task-card-actions"
      items={items}
      layout="balanced"
      moreLabel="更多"
      moreTrigger="hover"
      size="small"
      visibleCount={2}
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
 * @param danger - 是否以危险操作样式展示按钮；未传入时使用 `false`。
 * @returns 阻止卡片冒泡并执行指定回调的操作项配置。
 */
function createBoardActionItem(
  key: string,
  label: string,
  onClick: () => void,
  icon: VNodeChild,
  danger = false,
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
    <AButton
      block
      danger={danger}
      onClick={handleClick}
      size="small"
      type="text"
    >
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
          danger={danger}
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
