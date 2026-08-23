import type { TableColumnType } from 'antdv-next';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type {
  KtActionGroupItem,
  KtTableApi,
  KtTablePageResult,
} from '#/components/kt-table';

import { defineComponent, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { EyeOutlined } from '@antdv-next/icons';
import { Button, Card, Progress, Tag, Tooltip } from 'antdv-next';

import {
  getMediaGovernanceSeriesHistoryClassification,
  getMediaGovernanceSeriesPage,
} from '#/api/media-governance';
import { KtCardList } from '#/components/kt-card-list';
import { KtActionGroup, KtTable, useKtTable } from '#/components/kt-table';

import './list.scss';

const AButton = Button as any;
const ACard = Card as any;
const AKtCardList = KtCardList as any;
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
    const rows = ref<MediaGovernanceApi.SeriesCard[]>([]);
    const classificationError = ref<null | string>(null);
    const classificationLoading = ref(true);
    const classificationSummary = ref({ ...EMPTY_CLASSIFICATION_SUMMARY });
    const columns: Array<TableColumnType<MediaGovernanceApi.SeriesCard>> = [
      { dataIndex: 'title', key: 'title', title: '系列' },
    ];
    const api: KtTableApi<MediaGovernanceApi.SeriesCard, SeriesSearch> = {
      list: async (params) => await getMediaGovernanceSeriesPage(params),
    };
    const [registerTable] = useKtTable<
      MediaGovernanceApi.SeriesCard,
      SeriesSearch
    >({
      afterFetch: (result) => {
        rows.value = readSeriesRows(result);
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

    onMounted(() => void loadClassificationSummary());

    return () => (
      <Page autoContentHeight>
        <div class="media-governance-series-page">
          <AKtTable
            onRegister={registerTable}
            v-slots={{
              footer: () =>
                renderSeriesBoard(
                  rows.value,
                  classificationSummary.value,
                  classificationError.value,
                  classificationLoading.value,
                  openSeries,
                ),
            }}
          />
        </div>
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
 * 把当前页系列渲染为唯一卡片看板，不提供表格或视图切换。
 *
 * @param seriesRows - 当前页 canonical 系列。
 * @param classificationSummary - 全量历史 Task 的权威归类统计。
 * @param classificationError - 分类接口失败时的显式错误文案。
 * @param classificationLoading - 分类接口是否仍在读取全量数据。
 * @param openSeries - 打开系列详情的回调。
 * @returns 系列卡片看板或空态。
 */
function renderSeriesBoard(
  seriesRows: MediaGovernanceApi.SeriesCard[],
  classificationSummary: MediaGovernanceApi.HistoricalClassificationReport['summary'],
  classificationError: null | string,
  classificationLoading: boolean,
  openSeries: (series: MediaGovernanceApi.SeriesCard) => void,
) {
  return (
    <AKtCardList
      emptyDescription="尚未建立 canonical 系列资料"
      itemCount={seriesRows.length}
      v-slots={{
        default: () =>
          seriesRows.map((series) => (
            <ACard
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
            >
              <div class="media-governance-series-card__content">
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
                <div class="media-governance-series-card__metrics">
                  <div>
                    <span>季 / 集</span>
                    <strong>
                      {series.seasonCount} / {series.episodeCount}
                    </strong>
                  </div>
                  <div>
                    <span>Task</span>
                    <strong>{series.taskCount}</strong>
                  </div>
                  <div>
                    <span>已绑定剧集</span>
                    <strong>{series.boundEpisodeCount}</strong>
                  </div>
                  <div>
                    <span>RSS 启用 / 全部</span>
                    <strong>
                      {series.rssCount} / {series.rssTotalCount}
                    </strong>
                  </div>
                </div>
                <div class="media-governance-series-card__seasons">
                  {series.seasonSummaries.map((season) => (
                    <span key={season.id}>
                      S{String(season.seasonNumber).padStart(2, '0')} · E
                      {season.episodeStart}–E
                      {season.episodeStart + season.episodeCount - 1} ·{' '}
                      {season.coveragePercent}%
                    </span>
                  ))}
                </div>
                <div class="media-governance-series-card__coverage">
                  <div>
                    <span>剧集覆盖</span>
                    <span>
                      {series.boundEpisodeCount} / {series.episodeCount} 集 ·{' '}
                      <strong>{series.coveragePercent}%</strong>
                    </span>
                  </div>
                  <AProgress
                    percent={series.coveragePercent}
                    showInfo={false}
                    size="small"
                  />
                </div>
                {renderSeriesActions(series, openSeries)}
              </div>
            </ACard>
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
 * @returns KtActionGroup 图标操作栏。
 */
function renderSeriesActions(
  series: MediaGovernanceApi.SeriesCard,
  openSeries: (series: MediaGovernanceApi.SeriesCard) => void,
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
  return (
    <AKtActionGroup
      class="media-governance-series-card__actions"
      items={items}
      layout="balanced"
      size="small"
      visibleCount={1}
    />
  );
}
