import type { TableColumnType } from 'antdv-next';

import type { SeriesWorkCreateModalExposed } from './SeriesWorkCreateModal';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type {
  KtActionGroupItem,
  KtTableApi,
  KtTableButton,
  KtTablePageResult,
} from '#/components/kt-table';

import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { DeleteOutlined, EyeOutlined, PlusOutlined } from '@antdv-next/icons';
import { Button, message, Modal, Progress, Tag, Tooltip } from 'antdv-next';

import {
  deleteMediaGovernanceSeries,
  getMediaGovernanceSeriesHistoryClassification,
  getMediaGovernanceSeriesPage,
} from '#/api/media-governance';
import { KtCardList, KtCardListCard } from '#/components/kt-card-list';
import { KtActionGroup, KtTable, useKtTable } from '#/components/kt-table';

import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';
import SeriesWorkCreateModal from './SeriesWorkCreateModal';

import './list.scss';

const AButton = Button as any;
const AKtCardList = KtCardList as any;
const AKtCardListCard = KtCardListCard as any;
const AKtActionGroup = KtActionGroup as any;
const AKtTable = KtTable as any;
const AProgress = Progress as any;
const ATag = Tag as any;
const ATooltip = Tooltip as any;

type SeriesSearch = Pick<MediaGovernanceApi.SeriesPageQuery, 'keyword'>;

const EMPTY_CLASSIFICATION_SUMMARY: MediaGovernanceApi.HistoricalClassificationReport['summary'] =
  {
    classifiable: 0,
    classified: 0,
    notApplicable: 0,
    pending: 0,
    total: 0,
  };

export default defineComponent({
  name: 'MediaGovernanceSeriesList',
  setup() {
    const router = useRouter();
    const { hasAccessByCodes } = useAccess();
    const allowDeleteSeries = hasAccessByCodes(['Media:Governance:Delete']);
    const createModal = ref<SeriesWorkCreateModalExposed>();
    const rows = ref<MediaGovernanceApi.SeriesCard[]>([]);
    const boardLoading = ref(true);
    const classificationError = ref<null | string>(null);
    const classificationLoading = ref(true);
    const classificationSummary = ref({ ...EMPTY_CLASSIFICATION_SUMMARY });
    const columns: Array<TableColumnType<MediaGovernanceApi.SeriesCard>> = [
      { dataIndex: 'title', key: 'title', title: '系列' },
    ];
    const api: KtTableApi<MediaGovernanceApi.SeriesCard, SeriesSearch> = {
      list: async (params) => {
        boardLoading.value = true;
        try {
          return await getMediaGovernanceSeriesPage(params);
        } finally {
          boardLoading.value = false;
        }
      },
    };
    const buttons: Array<
      KtTableButton<MediaGovernanceApi.SeriesCard, SeriesSearch>
    > = [
      {
        icon: <PlusOutlined />,
        key: 'create-series',
        label: '新建系列',
        onClick: () => createModal.value?.openCreateSeries(),
        permissionCodes: ['Media:Governance:Create'],
        type: 'primary',
      },
    ];
    const [registerTable, tableApi] = useKtTable<
      MediaGovernanceApi.SeriesCard,
      SeriesSearch
    >({
      afterFetch: (result) => {
        rows.value = readSeriesRows(result);
        boardLoading.value = false;
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
              placeholder: '搜索系列名或 canonical 资料编号',
            },
            fieldName: 'keyword',
            label: '关键词',
          },
        ],
      },
      pageSize: 20,
      rowKey: 'id',
      tableTitle: '系列资料库',
    });

    /**
     * 用 canonical Series ID 进入隐藏详情路由，不把历史 Task 当成作品入口。
     *
     * @param series - 提供详情路由标识的系列卡片。
     */
    function openSeries(series: MediaGovernanceApi.SeriesCard) {
      void router.push({
        name: 'MediaGovernanceSeriesDetail',
        params: { seriesId: series.id },
      });
    }

    /**
     * 新 Series 创建完成后刷新分页并进入服务端返回的唯一详情。
     *
     * @param detail - 创建接口返回的 Series/主 Work 详情。
     */
    async function handleSeriesCreated(
      detail: MediaGovernanceApi.SeriesDetail,
    ) {
      await tableApi.reload();
      openSeries(detail.series as MediaGovernanceApi.SeriesCard);
    }

    /**
     * 读取全量历史 Task 的权威归类统计；失败时保留卡片数据并显式标记统计不可用。
     */
    async function loadClassificationSummary() {
      classificationError.value = null;
      classificationLoading.value = true;
      try {
        const report = await getMediaGovernanceSeriesHistoryClassification();
        classificationSummary.value = report.summary;
      } catch {
        classificationSummary.value = { ...EMPTY_CLASSIFICATION_SUMMARY };
        classificationError.value =
          '历史任务归类统计读取失败，当前显示为零值且未使用本页数据替代';
      } finally {
        classificationLoading.value = false;
      }
    }

    /**
     * 同时重载系列分页和全量历史归类摘要，用于 SSE 游标失效或新 Series 改变分页边界。
     */
    async function reloadCatalogSnapshot() {
      await Promise.all([tableApi.reload(), loadClassificationSummary()]);
    }

    /**
     * 在二次确认后提交 revision-bound 空壳删除，并回读权威分页与历史归类摘要。
     *
     * @param series - 已通过前端空壳投影和权限显隐门禁的系列卡片。
     */
    function confirmDeleteSeries(series: MediaGovernanceApi.SeriesCard) {
      if (!allowDeleteSeries || !canDeleteSeries(series)) return;
      Modal.confirm({
        cancelText: '取消',
        content: `仅删除“${series.title}”的空 Series、Work 与资料引用；若服务端发现 Season、Episode、Task、绑定或 RSS，将拒绝操作。`,
        okText: '确认删除',
        okType: 'danger',
        onOk: async () => {
          await deleteMediaGovernanceSeries(series.id, series.revision);
          message.success('空系列已删除');
          await reloadCatalogSnapshot();
        },
        title: '删除空系列',
      });
    }

    /**
     * 对当前页已有系列原位替换完整卡片；新系列、筛选越界或非当前页变更静默回读权威分页。
     *
     * @param event - API 在目录事务提交后发布的完整系列卡片事件。
     */
    async function handleCatalogChanged(
      event: MediaGovernanceApi.CatalogChangedEvent,
    ) {
      const search = await tableApi.getSearchValues();
      const keyword = search.keyword?.trim().toLowerCase();
      if (!applyCatalogChangedSeries(rows.value, event, keyword)) {
        await reloadCatalogSnapshot();
        return;
      }
      await loadClassificationSummary();
    }

    const stream = useMediaGovernanceStream({
      onCatalogChanged: (event) => {
        void handleCatalogChanged(event).catch(() => undefined);
      },
      onSnapshotRequired: () => {
        void reloadCatalogSnapshot().catch(() => undefined);
      },
    });

    onMounted(() => {
      void loadClassificationSummary();
      stream.start();
    });
    onBeforeUnmount(stream.close);

    return () => (
      <Page autoContentHeight>
        <div class="media-governance-series-page">
          <AKtTable
            onRegister={registerTable}
            v-slots={{
              footer: () =>
                renderSeriesBoard(
                  rows.value,
                  boardLoading.value,
                  classificationSummary.value,
                  classificationError.value,
                  classificationLoading.value,
                  openSeries,
                  allowDeleteSeries,
                  confirmDeleteSeries,
                ),
            }}
          />
        </div>
        <SeriesWorkCreateModal
          onSaved={(detail: MediaGovernanceApi.SeriesDetail) =>
            void handleSeriesCreated(detail)
          }
          ref={createModal}
        />
      </Page>
    );
  },
});

/**
 * 从 KtTable 分页或静态数组响应中读取系列卡片行。
 *
 * @param result - KtTable 支持的分页对象或行数组。
 * @returns 当前页系列卡片。
 */
function readSeriesRows(
  result:
    | KtTablePageResult<MediaGovernanceApi.SeriesCard>
    | MediaGovernanceApi.SeriesCard[],
) {
  if (Array.isArray(result)) return result;
  return result.items || result.list || result.records || [];
}

/**
 * 在事件仍属于当前筛选且 Series 位于当前页时原位替换卡片，其他情况交给权威分页重载。
 *
 * @param rows - 当前系列卡片页的响应式数组。
 * @param event - 目录事务提交后的完整系列卡片事件。
 * @param keyword - 当前已规范为小写的可选标题或 canonical 编号筛选词。
 * @returns 已安全原位替换时返回 true；需要重载分页时返回 false。
 */
export function applyCatalogChangedSeries(
  rows: MediaGovernanceApi.SeriesCard[],
  event: MediaGovernanceApi.CatalogChangedEvent,
  keyword?: string,
) {
  const rowIndex = rows.findIndex((series) => series.id === event.seriesId);
  if (rowIndex === -1) return false;
  if (event.changeType === 'deleted') {
    rows.splice(rowIndex, 1);
    return true;
  }
  if (!event.series) return false;
  if (
    keyword &&
    ![event.series.title, event.series.canonicalProviderId].some((value) =>
      value.toLowerCase().includes(keyword),
    )
  ) {
    return false;
  }
  rows.splice(rowIndex, 1, event.series);
  return true;
}

/**
 * 把当前页系列渲染为唯一卡片看板，不提供表格或视图切换。
 *
 * @param seriesRows - 当前页 canonical 系列。
 * @param loading - 当前分页、筛选或刷新请求是否仍在读取。
 * @param classificationSummary - 全量历史 Task 的权威归类统计。
 * @param classificationError - 分类接口失败时的显式错误文案。
 * @param classificationLoading - 分类接口是否仍在读取全量数据。
 * @param openSeries - 打开系列详情的回调。
 * @param allowDeleteSeries - 当前账号是否拥有 Series 删除权限。
 * @param deleteSeries - 打开空壳删除确认的回调。
 * @returns 系列卡片看板或空态。
 */
function renderSeriesBoard(
  seriesRows: MediaGovernanceApi.SeriesCard[],
  loading: boolean,
  classificationSummary: MediaGovernanceApi.HistoricalClassificationReport['summary'],
  classificationError: null | string,
  classificationLoading: boolean,
  openSeries: (series: MediaGovernanceApi.SeriesCard) => void,
  allowDeleteSeries: boolean,
  deleteSeries: (series: MediaGovernanceApi.SeriesCard) => void,
) {
  return (
    <AKtCardList
      emptyDescription="尚未建立 canonical 系列资料"
      itemCount={seriesRows.length}
      loading={loading}
      v-slots={{
        default: () =>
          seriesRows.map((series) => (
            <AKtCardListCard
              class="media-governance-series-card"
              hoverable
              key={series.id}
              onClick={() => openSeries(series)}
              onKeydown={(event: KeyboardEvent) => {
                if (event.target !== event.currentTarget) return;
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                openSeries(series);
              }}
              role="button"
              tabindex={0}
              v-slots={{
                actions: () =>
                  renderSeriesActions(
                    series,
                    openSeries,
                    allowDeleteSeries,
                    deleteSeries,
                  ),
                default: () => (
                  <>
                    <div class="media-governance-series-card__header">
                      <div>
                        <h3 title={series.title}>{series.title}</h3>
                        <p title={series.originalTitle || '未记录原名'}>
                          {series.originalTitle || '未记录原名'} ·{' '}
                          {series.releaseYear} 年
                        </p>
                      </div>
                      <ATag
                        aria-label={`${series.canonicalProvider.toUpperCase()} canonical 资料编号 ${series.canonicalProviderId}`}
                        color="blue"
                      >
                        {`${series.canonicalProvider.toUpperCase()} · ${series.canonicalProviderId}`}
                      </ATag>
                    </div>
                    <div class="media-governance-series-card__facts">
                      <span>{series.workCount} 个作品</span>
                      <span>{series.seasonCount} 季</span>
                      <span>{series.taskCount} 个 Task</span>
                    </div>
                    {renderSeriesCoverage(series)}
                  </>
                ),
              }}
            />
          )),
        summary: () =>
          renderSeriesSummary(
            classificationSummary,
            classificationError,
            classificationLoading,
          ),
      }}
    />
  );
}

/**
 * 仅把没有季、集、Task、绑定或 RSS 的 Series 投影为可删除空壳；后端仍以事务锁事实为准。
 *
 * @param series - 当前系列卡片的关联计数与 revision。
 * @returns 所有受保护关联计数均为零时返回 true。
 */
export function canDeleteSeries(series: MediaGovernanceApi.SeriesCard) {
  return (
    series.seasonCount === 0 &&
    series.episodeCount === 0 &&
    series.taskCount === 0 &&
    series.bindingCount === 0 &&
    series.rssTotalCount === 0
  );
}

/**
 * 按 Series 真实媒体类型解释零 Episode 空态，避免把尚未建立季集的 TV 错标为独立作品。
 * @param series - 当前系列的媒体类型与 Episode 计数。
 * @returns 零 Episode 时的类型化提示；已有 Episode 时返回 null。
 */
export function seriesCoverageEmptyLabel(
  series: MediaGovernanceApi.SeriesCard,
) {
  if (series.episodeCount > 0) return null;
  if (series.mediaType === 'tv') return 'TV 剧集尚未建立季集';
  return '独立电影 / 剧场版按作品管理';
}

/**
 * 按真实类型渲染零 Episode 提示，并为已有 Episode 的 Series 展示覆盖进度。
 * @param series - 当前系列卡片的 Work、Episode 与绑定统计。
 * @returns Episode 覆盖进度或按 TV/独立作品区分的空态提示。
 */
function renderSeriesCoverage(series: MediaGovernanceApi.SeriesCard) {
  const emptyLabel = seriesCoverageEmptyLabel(series);
  if (emptyLabel !== null) {
    return (
      <div class="media-governance-series-card__coverage">
        <span>{emptyLabel}</span>
      </div>
    );
  }
  return (
    <div class="media-governance-series-card__coverage">
      <div>
        <span>
          已绑定 {series.boundEpisodeCount} / {series.episodeCount} 集
        </span>
        <strong>{series.coveragePercent}%</strong>
      </div>
      <AProgress
        percent={series.coveragePercent}
        showInfo={false}
        size="small"
      />
    </div>
  );
}

/**
 * 将全量历史 Task 归类统计渲染成紧凑摘要带，禁止用当前分页数据冒充全局。
 *
 * @param summary - 历史分类接口返回的全局权威统计。
 * @param error - 分类接口失败时的显式错误文案。
 * @param loading - 是否仍在读取全局统计。
 * @returns 系列看板摘要区域。
 */
function renderSeriesSummary(
  summary: MediaGovernanceApi.HistoricalClassificationReport['summary'],
  error: null | string,
  loading: boolean,
) {
  let note = `电影/剧场版不适用 ${summary.notApplicable} 条；归类只认 canonical 身份、季号和集号证据。`;
  let noteClass = '';
  if (loading) note = '正在读取全部历史 Task 的归类统计…';
  if (error) {
    note = error;
    noteClass = 'media-governance-series-summary__error';
  }
  return (
    <section
      aria-label="全部历史任务归类摘要"
      class="media-governance-series-summary"
    >
      <div class="media-governance-series-summary__copy">
        <span>唯一资料身份</span>
        <strong>全部历史 Task 归类状态</strong>
        <p class={noteClass}>{note}</p>
      </div>
      <dl class="media-governance-series-summary__metrics">
        <div>
          <dt>历史任务</dt>
          <dd>{summary.total}</dd>
        </div>
        <div>
          <dt>已归类</dt>
          <dd>{summary.classified}</dd>
        </div>
        <div>
          <dt>可安全归类</dt>
          <dd>{summary.classifiable}</dd>
        </div>
        <div>
          <dt>不适用</dt>
          <dd>{summary.notApplicable}</dd>
        </div>
        <div>
          <dt>待处理</dt>
          <dd>{summary.pending}</dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * 为系列卡片生成仅含语义图标的操作栏。
 *
 * @param series - 当前系列卡片。
 * @param openSeries - 打开详情的回调。
 * @param allowDeleteSeries - 当前账号是否拥有 Series 删除权限。
 * @param deleteSeries - 打开空壳删除确认的回调。
 * @returns KtActionGroup 图标操作栏。
 */
function renderSeriesActions(
  series: MediaGovernanceApi.SeriesCard,
  openSeries: (series: MediaGovernanceApi.SeriesCard) => void,
  allowDeleteSeries: boolean,
  deleteSeries: (series: MediaGovernanceApi.SeriesCard) => void,
) {
  /**
   * 阻止操作按钮冒泡到卡片并打开系列详情。
   *
   * @param event - 当前按钮点击事件。
   */
  function handleOpen(event: MouseEvent) {
    event.stopPropagation();
    openSeries(series);
  }

  /**
   * 阻止删除按钮冒泡到卡片，并把同一卡片 revision 交给二次确认流程。
   *
   * @param event - 当前删除按钮点击事件。
   */
  function handleDelete(event: MouseEvent) {
    event.stopPropagation();
    deleteSeries(series);
  }

  const items: KtActionGroupItem[] = [
    {
      content: (
        <ATooltip title="查看系列">
          <AButton
            aria-label="查看系列"
            block
            onClick={handleOpen}
            size="small"
            type="text"
          >
            <EyeOutlined />
          </AButton>
        </ATooltip>
      ),
      key: 'view',
    },
  ];
  if (allowDeleteSeries && canDeleteSeries(series)) {
    items.push({
      content: (
        <ATooltip title="删除空系列">
          <AButton
            aria-label="删除空系列"
            block
            danger
            onClick={handleDelete}
            size="small"
            type="text"
          >
            <DeleteOutlined />
          </AButton>
        </ATooltip>
      ),
      key: 'delete',
    });
  }
  return (
    <AKtActionGroup
      items={items}
      layout="balanced"
      size="small"
      visibleCount={items.length}
    />
  );
}
