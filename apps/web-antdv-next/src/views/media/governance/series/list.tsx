import type { TableColumnType } from 'antdv-next';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type {
  KtActionGroupItem,
  KtTableApi,
  KtTablePageResult,
} from '#/components/kt-table';

import { defineComponent, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { EyeOutlined } from '@antdv-next/icons';
import { Button, Card, Empty, Progress, Tag, Tooltip } from 'antdv-next';

import { getMediaGovernanceSeriesPage } from '#/api/media-governance';
import { KtActionGroup, KtTable, useKtTable } from '#/components/kt-table';

import './list.scss';

const AButton = Button as any;
const ACard = Card as any;
const AEmpty = Empty as any;
const AKtActionGroup = KtActionGroup as any;
const AKtTable = KtTable as any;
const AProgress = Progress as any;
const ATag = Tag as any;
const ATooltip = Tooltip as any;

type SeriesSearch = Pick<MediaGovernanceApi.SeriesPageQuery, 'keyword'>;

export default defineComponent({
  name: 'MediaGovernanceSeriesList',
  setup() {
    const router = useRouter();
    const rows = ref<MediaGovernanceApi.SeriesCard[]>([]);
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

    return () => (
      <Page autoContentHeight>
        <div class="media-governance-series-page min-h-0 min-w-0">
          <AKtTable
            onRegister={registerTable}
            v-slots={{
              footer: () => renderSeriesBoard(rows.value, openSeries),
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
 * @param openSeries - 打开系列详情的回调。
 * @returns 系列卡片看板或空态。
 */
function renderSeriesBoard(
  seriesRows: MediaGovernanceApi.SeriesCard[],
  openSeries: (series: MediaGovernanceApi.SeriesCard) => void,
) {
  if (seriesRows.length === 0) {
    return (
      <div class="media-governance-series-board media-governance-series-board--empty">
        <AEmpty description="尚未建立 canonical 系列资料" />
      </div>
    );
  }
  return (
    <div class="media-governance-series-board">
      {seriesRows.map((series) => {
        let coverage = 0;
        if (series.episodeCount > 0) {
          coverage = Number(
            ((series.bindingCount / series.episodeCount) * 100).toFixed(1),
          );
        }
        return (
          <ACard
            class="media-governance-series-card"
            hoverable
            key={series.id}
            onClick={() => openSeries(series)}
            onKeydown={(event: KeyboardEvent) => {
              if (event.key === 'Enter') openSeries(series);
            }}
            role="button"
            tabindex={0}
          >
            <div class="media-governance-series-card__content">
              <div class="flex min-w-0 items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-base font-semibold">
                    {series.title}
                  </div>
                  <div class="mt-1 truncate text-xs text-muted-foreground">
                    {series.originalTitle || '未记录原名'} ·{' '}
                    {series.releaseYear}
                  </div>
                </div>
                <ATag color="blue">
                  {`${series.canonicalProvider.toUpperCase()} · ${series.canonicalProviderId}`}
                </ATag>
              </div>
              <div class="media-governance-series-card__metrics">
                <div>
                  <span>季</span>
                  <strong>{series.seasonCount}</strong>
                </div>
                <div>
                  <span>集</span>
                  <strong>{series.episodeCount}</strong>
                </div>
                <div>
                  <span>已绑定</span>
                  <strong>{series.bindingCount}</strong>
                </div>
                <div>
                  <span>RSS</span>
                  <strong>{series.rssCount}</strong>
                </div>
              </div>
              <div class="grid gap-1">
                <div class="flex justify-between text-xs text-muted-foreground">
                  <span>任务覆盖</span>
                  <span>{coverage}%</span>
                </div>
                <AProgress percent={coverage} showInfo={false} size="small" />
              </div>
              {renderSeriesActions(series, openSeries)}
            </div>
          </ACard>
        );
      })}
    </div>
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
