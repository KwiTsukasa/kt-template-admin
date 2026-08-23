import type { VNodeChild } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type { KtActionGroupItem } from '#/components/kt-table';

import { computed, defineComponent, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  CloudDownloadOutlined,
  EyeOutlined,
  LinkOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@antdv-next/icons';
import {
  Button,
  Card,
  Empty,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Progress,
  Select,
  Spin,
  Switch,
  Tabs,
  Tag,
  Tooltip,
} from 'antdv-next';

import {
  createMediaGovernanceMagnetBatch,
  createMediaGovernanceRssSubscription,
  getMediaGovernanceEpisodes,
  getMediaGovernanceSeries,
  pollMediaGovernanceRssSubscription,
  setMediaGovernanceRssSubscriptionState,
} from '#/api/media-governance';
import { KtActionGroup } from '#/components/kt-table';

import './detail.scss';

const AButton = Button as any;
const ACard = Card as any;
const AEmpty = Empty as any;
const AForm = Form as any;
const AFormItem = FormItem as any;
const AInput = Input as any;
const AInputNumber = InputNumber as any;
const AKtActionGroup = KtActionGroup as any;
const AModal = Modal as any;
const APagination = Pagination as any;
const AProgress = Progress as any;
const ASelect = Select as any;
const ASpin = Spin as any;
const ASwitch = Switch as any;
const ATabs = Tabs as any;
const ATag = Tag as any;
const ATextarea = Input.TextArea as any;
const ATooltip = Tooltip as any;

const CONTENT_KIND_OPTIONS = [
  { label: '同包外挂字幕', value: 'bundled_sidecar_media' },
  { label: '内嵌字幕', value: 'embedded_subtitle_media' },
  { label: '烧录字幕', value: 'burned_in_subtitle_media' },
  { label: '无字幕媒体', value: 'subtitleless_media' },
];

export default defineComponent({
  name: 'MediaGovernanceSeriesDetail',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const seriesId = computed(() => String(route.params.seriesId || ''));
    const detail = ref<MediaGovernanceApi.SeriesDetail>();
    const episodes = ref<MediaGovernanceApi.Episode[]>([]);
    const episodeTotal = ref(0);
    const episodePageNo = ref(1);
    const episodePageSize = 100;
    const loading = ref(false);
    const activeTab = ref('overview');
    const selectedSeasonNumber = ref<number>();
    const batchOpen = ref(false);
    const batchStartEpisode = ref<number>();
    const batchMagnets = ref('');
    const batchReleaseGroup = ref('LoliHouse');
    const batchContentKind = ref<MediaGovernanceApi.ContentKind>(
      'bundled_sidecar_media',
    );
    const rssOpen = ref(false);
    const rssName = ref('');
    const rssFeedUrl = ref('');
    const rssReleaseGroup = ref('');
    const rssIncludePattern = ref('');
    const rssEpisodePattern = ref('');
    const rssPollInterval = ref(15);
    const rssContentKind = ref<MediaGovernanceApi.ContentKind>(
      'bundled_sidecar_media',
    );

    /**
     * 并行读取系列详情与当前季 Episode 首屏。
     */
    async function loadDetail() {
      loading.value = true;
      try {
        detail.value = await getMediaGovernanceSeries(seriesId.value);
        const firstSeason = detail.value.seasons[0];
        if (selectedSeasonNumber.value === undefined && firstSeason) {
          selectedSeasonNumber.value = firstSeason.seasonNumber;
        }
        await loadEpisodes(1);
      } finally {
        loading.value = false;
      }
    }

    /**
     * 分页读取当前选中季的 Episode 和 Task 绑定。
     *
     * @param pageNo - 目标页码。
     */
    async function loadEpisodes(pageNo: number) {
      const seasonNumber = selectedSeasonNumber.value;
      if (seasonNumber === undefined) {
        episodes.value = [];
        episodeTotal.value = 0;
        return;
      }
      const page = await getMediaGovernanceEpisodes(
        seriesId.value,
        seasonNumber,
        { pageNo, pageSize: episodePageSize },
      );
      episodes.value = page.items;
      episodeTotal.value = page.total;
      episodePageNo.value = pageNo;
    }

    /**
     * 切换当前季并回到 Episode 第一页。
     *
     * @param seasonNumber - 新选中的 canonical 季号。
     */
    function selectSeason(seasonNumber: number) {
      selectedSeasonNumber.value = seasonNumber;
      void loadEpisodes(1);
    }

    /**
     * 打开批量磁链弹窗，并把起始集定位到当前季首个未绑定集。
     */
    function openBatch() {
      const selectedSeason = detail.value?.seasons.find(
        (season) => season.seasonNumber === selectedSeasonNumber.value,
      );
      let nextEpisode = 1;
      if (selectedSeason) nextEpisode = selectedSeason.bindingCount + 1;
      const firstUnbound = episodes.value.find(
        (episode) => episode.bindings.length === 0,
      );
      if (firstUnbound) nextEpisode = firstUnbound.episodeNumber;
      batchStartEpisode.value = nextEpisode;
      batchMagnets.value = '';
      batchOpen.value = true;
    }

    /**
     * 把逐行磁链映射为连续集号并创建一条多来源 Task。
     */
    async function submitBatch() {
      const seasonNumber = selectedSeasonNumber.value;
      const startEpisode = batchStartEpisode.value;
      const magnets = batchMagnets.value
        .split(/\r?\n/u)
        .map((value) => value.trim())
        .filter(Boolean);
      if (seasonNumber === undefined || !startEpisode) {
        message.error('请选择季和起始集');
        return;
      }
      if (magnets.length === 0 || magnets.length > 16) {
        message.error('每次请输入 1–16 条磁链，每行一条');
        return;
      }
      await createMediaGovernanceMagnetBatch(seriesId.value, seasonNumber, {
        contentKind: batchContentKind.value,
        items: magnets.map((magnetUri, index) => ({
          episodeNumber: startEpisode + index,
          magnetUri,
        })),
        releaseGroup: batchReleaseGroup.value.trim() || undefined,
      });
      batchOpen.value = false;
      message.success(`已创建包含 ${magnets.length} 个按集来源的执行任务`);
      await loadDetail();
    }

    /**
     * 打开当前季 RSS 创建弹窗并清理上一次输入。
     */
    function openRss() {
      rssName.value = '';
      rssFeedUrl.value = '';
      rssReleaseGroup.value = '';
      rssIncludePattern.value = '';
      rssEpisodePattern.value = '';
      rssPollInterval.value = 15;
      rssOpen.value = true;
    }

    /**
     * 创建当前季 RSS 订阅并安排首次后台轮询。
     */
    async function submitRss() {
      const seasonNumber = selectedSeasonNumber.value;
      if (seasonNumber === undefined) {
        message.error('请先选择季');
        return;
      }
      if (!rssName.value.trim() || !rssFeedUrl.value.trim()) {
        message.error('请填写订阅名称和 RSS 地址');
        return;
      }
      await createMediaGovernanceRssSubscription(seriesId.value, seasonNumber, {
        contentKind: rssContentKind.value,
        episodePattern: rssEpisodePattern.value.trim() || undefined,
        feedUrl: rssFeedUrl.value.trim(),
        includePattern: rssIncludePattern.value.trim() || undefined,
        name: rssName.value.trim(),
        pollIntervalMinutes: rssPollInterval.value,
        releaseGroup: rssReleaseGroup.value.trim() || undefined,
      });
      rssOpen.value = false;
      message.success('RSS 订阅已创建');
      await loadDetail();
    }

    /**
     * 立即轮询目标 RSS 并显示本轮入队数量。
     *
     * @param subscription - 要轮询的订阅快照。
     */
    async function pollRss(subscription: MediaGovernanceApi.RssSubscription) {
      const result = await pollMediaGovernanceRssSubscription(subscription.id);
      message.success(
        `发现 ${result.discovered} 条，已入队 ${result.queued} 条`,
      );
      await loadDetail();
    }

    /**
     * 提交订阅 optimistic revision 后重载权威详情，避免本地 Switch 先行伪成功。
     *
     * @param subscription - 当前订阅快照。
     * @param enabled - 目标启用状态。
     */
    async function toggleRss(
      subscription: MediaGovernanceApi.RssSubscription,
      enabled: boolean,
    ) {
      await setMediaGovernanceRssSubscriptionState(
        subscription.id,
        subscription.revision,
        enabled,
      );
      let successMessage = 'RSS 订阅已暂停';
      if (enabled) successMessage = 'RSS 订阅已启用';
      message.success(successMessage);
      await loadDetail();
    }

    /**
     * 用稳定 Task ID 进入隐藏详情路由，保留 Series 页面作为菜单主入口。
     *
     * @param taskId - 媒体治理 Task 标识。
     */
    function openTask(taskId: string) {
      void router.push({
        name: 'MediaGovernanceTaskDetail',
        params: { taskId },
      });
    }

    /**
     * 按当前 Tab 渲染概览、剧集、RSS 或执行历史内容。
     *
     * @returns 当前 Tab 内容。
     */
    function renderTabContent() {
      if (!detail.value) return null;
      if (activeTab.value === 'episodes') {
        return renderEpisodes(
          episodes.value,
          episodePageNo.value,
          episodePageSize,
          episodeTotal.value,
          (pageNo) => void loadEpisodes(pageNo),
          openTask,
        );
      }
      if (activeTab.value === 'rss') {
        return renderRssSubscriptions(
          detail.value.rssSubscriptions,
          pollRss,
          toggleRss,
        );
      }
      if (activeTab.value === 'tasks') {
        return renderTaskBindings(detail.value.taskBindings, openTask);
      }
      return renderSeriesOverview(detail.value);
    }

    onMounted(() => void loadDetail());

    return () => {
      let title = '媒体系列';
      if (detail.value) title = detail.value.series.title;
      let loadedContent = null;
      if (detail.value) {
        loadedContent = (
          <>
            {renderSeriesHeader(detail.value, openBatch, openRss)}
            {renderSeasonSelector(
              detail.value.seasons,
              selectedSeasonNumber.value,
              selectSeason,
            )}
            <ACard class="media-governance-series-detail__workspace">
              <ATabs
                items={[
                  { key: 'overview', label: '系列概览' },
                  { key: 'episodes', label: '剧集' },
                  { key: 'rss', label: 'RSS 订阅' },
                  { key: 'tasks', label: '执行历史' },
                ]}
                v-model:activeKey={activeTab.value}
              />
              <div class="media-governance-series-detail__tab-content">
                {renderTabContent()}
              </div>
            </ACard>
          </>
        );
      }
      return (
        <Page autoContentHeight title={title}>
          <ASpin spinning={loading.value}>
            <div class="media-governance-series-detail">{loadedContent}</div>
          </ASpin>
          <AModal
            cancelText="取消"
            okText="创建任务"
            onCancel={() => {
              batchOpen.value = false;
            }}
            onOk={() => void submitBatch()}
            open={batchOpen.value}
            title="批量添加按集磁链"
            width={720}
          >
            <AForm layout="vertical">
              <div class="grid gap-3 sm:grid-cols-2">
                <AFormItem label="起始集">
                  <AInputNumber
                    min={1}
                    onUpdate:value={(value: number) => {
                      batchStartEpisode.value = value;
                    }}
                    precision={0}
                    value={batchStartEpisode.value}
                  />
                </AFormItem>
                <AFormItem label="发布组">
                  <AInput v-model:value={batchReleaseGroup.value} />
                </AFormItem>
              </div>
              <AFormItem label="内容类型">
                <ASelect
                  options={CONTENT_KIND_OPTIONS}
                  v-model:value={batchContentKind.value}
                />
              </AFormItem>
              <AFormItem
                extra="从起始集开始按行递增，最多 16 条"
                label="磁链（每行一条）"
              >
                <ATextarea
                  autoSize={{ maxRows: 16, minRows: 8 }}
                  placeholder="magnet:?xt=urn:btih:..."
                  v-model:value={batchMagnets.value}
                />
              </AFormItem>
            </AForm>
          </AModal>
          <AModal
            cancelText="取消"
            okText="创建订阅"
            onCancel={() => {
              rssOpen.value = false;
            }}
            onOk={() => void submitRss()}
            open={rssOpen.value}
            title="创建 RSS 订阅"
            width={720}
          >
            <AForm layout="vertical">
              <div class="grid gap-3 sm:grid-cols-2">
                <AFormItem label="订阅名称">
                  <AInput v-model:value={rssName.value} />
                </AFormItem>
                <AFormItem label="发布组">
                  <AInput v-model:value={rssReleaseGroup.value} />
                </AFormItem>
              </div>
              <AFormItem label="RSS 地址">
                <AInput
                  placeholder="https://example.com/feed.xml"
                  v-model:value={rssFeedUrl.value}
                />
              </AFormItem>
              <div class="grid gap-3 sm:grid-cols-2">
                <AFormItem label="内容类型">
                  <ASelect
                    options={CONTENT_KIND_OPTIONS}
                    v-model:value={rssContentKind.value}
                  />
                </AFormItem>
                <AFormItem label="轮询间隔（分钟）">
                  <AInputNumber
                    max={1440}
                    min={5}
                    onUpdate:value={(value: number) => {
                      rssPollInterval.value = value;
                    }}
                    precision={0}
                    value={rssPollInterval.value}
                  />
                </AFormItem>
              </div>
              <AFormItem label="标题包含正则（可选）">
                <AInput
                  placeholder="LoliHouse"
                  v-model:value={rssIncludePattern.value}
                />
              </AFormItem>
              <AFormItem
                extra="可使用命名组 (?&lt;episode&gt;\d+)；留空时识别“ - 27 [”和 E27"
                label="集号正则（可选）"
              >
                <AInput v-model:value={rssEpisodePattern.value} />
              </AFormItem>
            </AForm>
          </AModal>
        </Page>
      );
    };
  },
});

/**
 * 渲染系列 canonical 身份与仅图标操作栏。
 *
 * @param detail - 系列详情。
 * @param openBatch - 打开批量磁链弹窗。
 * @param openRss - 打开 RSS 弹窗。
 * @returns 系列头部卡片。
 */
function renderSeriesHeader(
  detail: MediaGovernanceApi.SeriesDetail,
  openBatch: () => void,
  openRss: () => void,
) {
  const items: KtActionGroupItem[] = [
    iconAction('batch', '批量添加磁链', <CloudDownloadOutlined />, openBatch),
    iconAction('rss', '创建 RSS 订阅', <LinkOutlined />, openRss),
  ];
  return (
    <ACard>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="grid gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="m-0 text-xl font-semibold">{detail.series.title}</h2>
            <ATag color="blue">
              {`${detail.series.canonicalProvider.toUpperCase()} · ${detail.series.canonicalProviderId}`}
            </ATag>
          </div>
          <div class="text-sm text-muted-foreground">
            {detail.series.originalTitle || '未记录原名'} ·{' '}
            {detail.series.releaseYear} · canonical Series
          </div>
        </div>
        <AKtActionGroup
          class="media-governance-series-detail__actions"
          items={items}
          layout="balanced"
          size="small"
          visibleCount={2}
        />
      </div>
    </ACard>
  );
}

/**
 * 计算每季 Task 覆盖率，并把选中态映射为边框和标签色后输出季卡片带。
 *
 * @param seasons - canonical 季摘要。
 * @param selectedSeasonNumber - 当前选中季号。
 * @param selectSeason - 切换季回调。
 * @returns 季卡片带。
 */
function renderSeasonSelector(
  seasons: MediaGovernanceApi.SeasonCard[],
  selectedSeasonNumber: number | undefined,
  selectSeason: (seasonNumber: number) => void,
) {
  return (
    <div class="media-governance-season-strip">
      {seasons.map((season) => {
        let percent = 0;
        if (season.episodeCount > 0) {
          percent = Number(
            ((season.bindingCount / season.episodeCount) * 100).toFixed(1),
          );
        }
        const selected = season.seasonNumber === selectedSeasonNumber;
        let cardClass = 'media-governance-season-card';
        let tagColor = 'default';
        if (selected) {
          cardClass = `${cardClass} media-governance-season-card--selected`;
          tagColor = 'blue';
        }
        return (
          <ACard
            class={cardClass}
            hoverable
            key={season.id}
            onClick={() => selectSeason(season.seasonNumber)}
            size="small"
          >
            <div class="grid gap-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="font-semibold">
                    S{String(season.seasonNumber).padStart(2, '0')} ·{' '}
                    {season.title}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {season.releaseYear || '年份待定'} · {season.episodeCount}{' '}
                    集
                  </div>
                </div>
                <ATag color={tagColor}>
                  {season.bindingCount}/{season.episodeCount}
                </ATag>
              </div>
              <AProgress percent={percent} showInfo={false} size="small" />
            </div>
          </ACard>
        );
      })}
    </div>
  );
}

/**
 * 将 canonical/证据资料引用与季级 Task 覆盖并列展示，避免分篇编号伪装成季。
 *
 * @param detail - 系列详情。
 * @returns 概览内容。
 */
function renderSeriesOverview(detail: MediaGovernanceApi.SeriesDetail) {
  return (
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="grid gap-3">
        <h3 class="m-0 text-base font-semibold">资料引用</h3>
        {detail.references.map((reference) => (
          <div class="media-governance-fact-row" key={reference.id}>
            <span>{reference.provider.toUpperCase()}</span>
            <strong>{reference.providerId}</strong>
            <span class="text-muted-foreground">
              {reference.title || '未记录标题'} ·{' '}
              {reference.releaseYear || '年份待定'}
            </span>
          </div>
        ))}
      </div>
      <div class="grid gap-3">
        <h3 class="m-0 text-base font-semibold">层级统计</h3>
        {detail.seasons.map((season) => (
          <div class="media-governance-fact-row" key={season.id}>
            <span>S{String(season.seasonNumber).padStart(2, '0')}</span>
            <strong>{season.title}</strong>
            <span class="text-muted-foreground">
              {season.bindingCount}/{season.episodeCount} 集已有 Task
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 将分页 Episode 映射为状态卡片，并只为已有绑定的集提供 Task 图标入口。
 *
 * @param episodes - 当前页 Episode。
 * @param pageNo - 当前页码。
 * @param pageSize - 每页条数。
 * @param total - 总集数。
 * @param changePage - 切换页码回调。
 * @param openTask - 打开绑定 Task 的回调。
 * @returns Episode 网格。
 */
function renderEpisodes(
  episodes: MediaGovernanceApi.Episode[],
  pageNo: number,
  pageSize: number,
  total: number,
  changePage: (pageNo: number) => void,
  openTask: (taskId: string) => void,
) {
  if (episodes.length === 0) return <AEmpty description="当前季没有 Episode" />;
  return (
    <div class="grid gap-4">
      <div class="media-governance-episode-grid">
        {episodes.map((episode) => {
          const taskId = episode.bindings[0]?.taskId;
          let taskAction = null;
          if (taskId) {
            taskAction = (
              <ATooltip title="查看执行任务">
                <AButton
                  aria-label="查看执行任务"
                  block
                  onClick={() => openTask(taskId)}
                  size="small"
                  type="text"
                >
                  <EyeOutlined />
                </AButton>
              </ATooltip>
            );
          }
          return (
            <div class="media-governance-episode-card" key={episode.id}>
              <div class="flex items-center justify-between gap-2">
                <strong>
                  E{String(episode.episodeNumber).padStart(2, '0')}
                </strong>
                <ATag color={episodeStatusColor(episode.status)}>
                  {episodeStatusLabel(episode.status)}
                </ATag>
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {taskId || '尚无执行任务'}
              </div>
              {taskAction}
            </div>
          );
        })}
      </div>
      <APagination
        current={pageNo}
        onChange={changePage}
        pageSize={pageSize}
        showSizeChanger={false}
        total={total}
      />
    </div>
  );
}

/**
 * 按启用态生成轮询及暂停/恢复图标，并把最近错误保留在对应订阅卡片内。
 *
 * @param subscriptions - 当前系列 RSS 订阅。
 * @param poll - 立即轮询回调。
 * @param toggle - 启停订阅回调。
 * @returns RSS 订阅列表。
 */
function renderRssSubscriptions(
  subscriptions: MediaGovernanceApi.RssSubscription[],
  poll: (subscription: MediaGovernanceApi.RssSubscription) => Promise<void>,
  toggle: (
    subscription: MediaGovernanceApi.RssSubscription,
    enabled: boolean,
  ) => Promise<void>,
) {
  if (subscriptions.length === 0) {
    return <AEmpty description="当前系列还没有 RSS 订阅" />;
  }
  return (
    <div class="grid gap-3">
      {subscriptions.map((subscription) => {
        const items: KtActionGroupItem[] = [
          iconAction('poll', '立即轮询', <ReloadOutlined />, () => {
            void poll(subscription);
          }),
        ];
        if (subscription.enabled) {
          items.push(
            iconAction('pause', '暂停订阅', <PauseCircleOutlined />, () => {
              void toggle(subscription, false);
            }),
          );
        } else {
          items.push(
            iconAction('resume', '启用订阅', <PlayCircleOutlined />, () => {
              void toggle(subscription, true);
            }),
          );
        }
        let statusColor = 'default';
        if (subscription.enabled) statusColor = 'green';
        let errorNode = null;
        if (subscription.lastError) {
          errorNode = (
            <div class="mt-1 text-xs text-red-500">
              {subscription.lastError}
            </div>
          );
        }
        return (
          <div class="media-governance-rss-card" key={subscription.id}>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <strong>{subscription.name}</strong>
                <ATag color={statusColor}>{subscription.status}</ATag>
                <ASwitch checked={subscription.enabled} disabled size="small" />
              </div>
              <div class="mt-1 truncate text-xs text-muted-foreground">
                {subscription.feedUrl}
              </div>
              <div class="mt-1 text-xs text-muted-foreground">
                S{String(subscription.seasonNumber).padStart(2, '0')} · 每{' '}
                {subscription.pollIntervalMinutes} 分钟 · 上次{' '}
                {subscription.lastPolledAt || '尚未轮询'}
              </div>
              {errorNode}
            </div>
            <AKtActionGroup
              items={items}
              layout="balanced"
              size="small"
              visibleCount={2}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * 将服务端压缩后的季集范围还原为可读历史行，并保留到原 Task 的追溯入口。
 *
 * @param bindings - Task 集范围分组。
 * @param openTask - 打开 Task 详情回调。
 * @returns 执行历史列表。
 */
function renderTaskBindings(
  bindings: MediaGovernanceApi.SeriesTaskBinding[],
  openTask: (taskId: string) => void,
) {
  if (bindings.length === 0)
    return <AEmpty description="当前系列没有执行历史" />;
  return (
    <div class="grid gap-3">
      {bindings.map((binding) => (
        <div class="media-governance-task-binding" key={binding.taskId}>
          <div class="min-w-0 flex-1">
            <div class="break-all font-medium">{binding.taskId}</div>
            <div class="mt-1 text-xs text-muted-foreground">
              {binding.seasons
                .map(
                  (season) =>
                    `S${String(season.seasonNumber).padStart(2, '0')} ${season.episodeRanges
                      .map((range) => `E${range.start}–E${range.end}`)
                      .join('、')}`,
                )
                .join('；')}
            </div>
          </div>
          <ATooltip title="查看执行任务">
            <AButton
              aria-label="查看执行任务"
              onClick={() => openTask(binding.taskId)}
              type="text"
            >
              <EyeOutlined />
            </AButton>
          </ATooltip>
        </div>
      ))}
    </div>
  );
}

/**
 * 将业务回调包装为带 Tooltip 和 `aria-label` 的无文字按钮，统一系列页操作栏语义。
 *
 * @param key - 操作稳定键。
 * @param label - 无障碍标签与 Tooltip 文案。
 * @param icon - 语义图标。
 * @param action - 点击后执行的操作。
 * @returns 图标操作项。
 */
function iconAction(
  key: string,
  label: string,
  icon: VNodeChild,
  action: () => void,
): KtActionGroupItem {
  return {
    content: (
      <ATooltip title={label}>
        <AButton
          aria-label={label}
          block
          onClick={action}
          size="small"
          type="text"
        >
          {icon}
        </AButton>
      </ATooltip>
    ),
    key,
  };
}

/**
 * 把四种持久化 Episode 状态映射为用户可读中文，不暴露内部枚举。
 *
 * @param status - canonical Episode 状态。
 * @returns 中文状态标签。
 */
function episodeStatusLabel(status: MediaGovernanceApi.Episode['status']) {
  if (status === 'completed') return '已完成';
  if (status === 'downloading') return '下载中';
  if (status === 'queued') return '已入队';
  return '待来源';
}

/**
 * 把 Episode 状态映射为完成、运行、排队或默认的 Ant Design 语义色。
 *
 * @param status - canonical Episode 状态。
 * @returns Ant Design 标签色名。
 */
function episodeStatusColor(status: MediaGovernanceApi.Episode['status']) {
  if (status === 'completed') return 'green';
  if (status === 'downloading') return 'processing';
  if (status === 'queued') return 'blue';
  return 'default';
}
