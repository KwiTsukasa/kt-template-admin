import type { TableColumnType } from 'antdv-next';

import type { MediaGovernanceTaskDrawerExposed } from './components/MediaGovernanceTaskDrawer';
import type { MediaGovernanceTaskFormDrawerExposed } from './components/MediaGovernanceTaskFormDrawer';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type {
  KtTableApi,
  KtTableButton,
  KtTablePageResult,
  KtTableRowAction,
} from '#/components/ktTable';

import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Empty, message, Progress, Tabs, Tag } from 'antdv-next';

import {
  discardMediaGovernanceTask,
  getMediaGovernanceSummary,
  getMediaGovernanceTaskPage,
} from '#/api/media-governance';
import { KtTable, useKtTable } from '#/components/ktTable';

import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';
import MediaGovernanceTaskDrawer, {
  canEditIdentity,
  getDiscardDisabledReason,
} from './components/MediaGovernanceTaskDrawer';
import MediaGovernanceTaskFormDrawer from './components/MediaGovernanceTaskFormDrawer';

import './list.scss';

const AButton = Button as any;
const ACard = Card as any;
const AEmpty = Empty as any;
const AKtTable = KtTable as any;
const AProgress = Progress as any;
const ATabs = Tabs as any;
const ATag = Tag as any;

type TaskSearchValues = Pick<
  MediaGovernanceApi.TaskPageQuery,
  'governanceProfile' | 'keyword' | 'metadataStatus' | 'runState' | 'stage'
>;
type ViewMode = 'board' | 'table';

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
    const detailDrawer = ref<MediaGovernanceTaskDrawerExposed>();
    const formDrawer = ref<MediaGovernanceTaskFormDrawerExposed>();
    const summary = ref<MediaGovernanceApi.Summary>({ ...EMPTY_SUMMARY });
    const tableRows = ref<MediaGovernanceApi.Task[]>([]);
    const viewMode = ref<ViewMode>('table');
    const columns: Array<TableColumnType<MediaGovernanceApi.Task>> = [
      { dataIndex: 'titleHint', key: 'titleHint', title: '作品', width: 230 },
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
        key: 'currentAction',
        title: '当前动作',
        width: 230,
      },
      { dataIndex: 'progress', key: 'progress', title: '量化进度', width: 220 },
      {
        dataIndex: 'metadataStatus',
        key: 'metadataStatus',
        title: '元数据',
        width: 125,
      },
      { dataIndex: 'gateReason', key: 'gateReason', title: '阻塞', width: 160 },
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
        disabled: (row) => !canEditIdentity(row),
        disabledReason: (row) =>
          canEditIdentity(row)
            ? undefined
            : '作品身份只能在下载和治理开始前修改。',
        key: 'edit',
        label: '编辑',
        onClick: (row) => formDrawer.value?.openEdit(row),
        permissionCodes: ['Media:Governance:Create'],
        rowVisible: (row) => row.stage !== 'closed',
      },
      {
        confirm: (row) =>
          `确认删除空草稿「${row.titleHint}」吗？本操作只删除任务草稿和未使用的治理单元。`,
        danger: true,
        disabled: (row) => Boolean(getDiscardDisabledReason(row)),
        disabledReason: getDiscardDisabledReason,
        key: 'discard',
        label: '删除空草稿',
        onClick: async (row, context) => {
          await discardMediaGovernanceTask(row.id, row.revision);
          message.success('空任务草稿已删除');
          await Promise.all([loadSummary(), context.reload()]);
        },
        permissionCodes: ['Media:Governance:Create'],
        rowVisible: true,
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

    async function loadSummary() {
      summary.value = await getMediaGovernanceSummary();
    }

    async function refreshAll(refreshDetail = false) {
      await Promise.all([loadSummary(), tableApi.reload()]);
      if (refreshDetail) await detailDrawer.value?.refresh();
    }

    function openDetail(row: MediaGovernanceApi.Task) {
      detailDrawer.value?.open(row.id);
    }

    async function handleSaved(task: MediaGovernanceApi.Task) {
      await refreshAll(false);
      detailDrawer.value?.open(task.id);
    }

    const stream = useMediaGovernanceStream({
      onSnapshotRequired: () => void refreshAll(true),
      onTaskChanged: () => void refreshAll(true),
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
              `media-governance-task-page--${viewMode.value}`,
            ]}
          >
            <AKtTable
              onRegister={registerTable}
              v-slots={{
                bodyCell: ({ column, record }: any) =>
                  renderBodyCell(column.key, record),
                footer: () =>
                  viewMode.value === 'board'
                    ? renderBoard(tableRows.value, openDetail, (task) =>
                        formDrawer.value?.openEdit(task),
                      )
                    : null,
                headerControls: () => (
                  <div class="kt-table__header-control-group">
                    <ATabs
                      class="kt-table__header-tabs"
                      items={[
                        { key: 'table', label: '表格' },
                        { key: 'board', label: '看板' },
                      ]}
                      v-model:activeKey={viewMode.value}
                    />
                  </div>
                ),
              }}
            />
          </div>
        </div>
        <MediaGovernanceTaskDrawer
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

function readPageItems(
  result:
    | KtTablePageResult<MediaGovernanceApi.Task>
    | MediaGovernanceApi.Task[],
) {
  if (Array.isArray(result)) return result;
  return result.items || result.list || result.records || [];
}

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

function renderBodyCell(key: string, task: MediaGovernanceApi.Task) {
  if (key === 'titleHint') {
    return (
      <div class="grid gap-1">
        <span class="font-medium">{task.titleHint}</span>
        <span class="text-xs text-muted-foreground">{task.id}</span>
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
    return task.governanceProfile ? (
      <ATag color="blue">
        {GOVERNANCE_PROFILE_LABELS[task.governanceProfile]}
      </ATag>
    ) : (
      <span class="text-muted-foreground">待选择</span>
    );
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
        <span>{task.semanticProjection.currentActionLabel}</span>
        <span class="text-xs text-muted-foreground">
          下一步：{task.nextCommandLabel}
        </span>
      </div>
    );
  }
  if (key === 'progress') {
    return (
      <div class="grid gap-1">
        <AProgress percent={task.progress.percent} size="small" />
        <span class="text-xs text-muted-foreground">
          {task.progress.progressLabel} · {task.progress.speedLabel}
        </span>
      </div>
    );
  }
  if (key === 'metadataStatus') {
    return (
      <ATag color={task.metadataStatus === 'verified' ? 'success' : 'warning'}>
        {task.semanticProjection.metadataStatusLabel}
      </ATag>
    );
  }
  if (key === 'gateReason') {
    return task.gateReason ? (
      <ATag color="error">{task.semanticProjection.gateReasonLabel}</ATag>
    ) : (
      <span class="text-muted-foreground">无阻塞</span>
    );
  }
  return undefined;
}

function renderBoard(
  tasks: MediaGovernanceApi.Task[],
  openDetail: (task: MediaGovernanceApi.Task) => void,
  openEdit: (task: MediaGovernanceApi.Task) => void,
) {
  if (tasks.length === 0) {
    return (
      <div class="media-governance-task-board media-governance-task-board--empty">
        <AEmpty description="当前筛选条件下没有任务" />
      </div>
    );
  }
  return (
    <div class="media-governance-task-board">
      {tasks.map((task) => (
        <ACard
          hoverable
          key={task.id}
          onClick={() => openDetail(task)}
          onKeydown={(event: KeyboardEvent) => {
            if (event.key === 'Enter') openDetail(task);
          }}
          role="button"
          tabindex={0}
        >
          <div class="grid gap-4">
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
            <div class="flex justify-end gap-2">
              <AButton
                onClick={(event: MouseEvent) => {
                  event.stopPropagation();
                  openDetail(task);
                }}
                size="small"
              >
                查看
              </AButton>
              <AButton
                disabled={!canEditIdentity(task)}
                onClick={(event: MouseEvent) => {
                  event.stopPropagation();
                  openEdit(task);
                }}
                size="small"
                type="primary"
              >
                编辑
              </AButton>
            </div>
          </div>
        </ACard>
      ))}
    </div>
  );
}
