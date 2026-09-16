import type { TableColumnType } from 'antdv-next';

import type { VNodeChild } from 'vue';

import type { MediaGovernanceTaskDrawerExposed } from '../tasks/components/MediaGovernanceTaskDrawer';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type { KtActionGroupItem } from '#/components/kt-table';

import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  AppstoreAddOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileAddOutlined,
  FolderAddOutlined,
  LinkOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@antdv-next/icons';
import {
  Button,
  Empty,
  message,
  Modal,
  Pagination,
  Spin,
  Tabs,
  Tag,
  Tooltip,
} from 'antdv-next';

import {
  deleteMediaGovernanceRssSubscription,
  getMediaGovernanceEpisodes,
  getMediaGovernanceSeries,
  pollMediaGovernanceRssSubscription,
  setMediaGovernanceRssSubscriptionState,
} from '#/api/media-governance';
import { KtCardListCard } from '#/components/kt-card-list';
import { KtActionGroup, KtTable } from '#/components/kt-table';

import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';
import MediaGovernanceTaskDrawer from '../tasks/components/MediaGovernanceTaskDrawer';
import { useSeriesActions } from './useSeriesActions';

import './detail.scss';

const AButton = Button as any;
const AEmpty = Empty as any;
const AKtCardListCard = KtCardListCard as any;
const AKtActionGroup = KtActionGroup as any;
const AKtTable = KtTable as any;
const APagination = Pagination as any;
const ASpin = Spin as any;
const ATabs = Tabs as any;
const ATag = Tag as any;
const ATooltip = Tooltip as any;

const RSS_SUBSCRIPTION_STATUS_PRESENTATION: Record<
  string,
  { color: string; label: string }
> = {
  disabled: { color: 'default', label: '已暂停' },
  error: { color: 'red', label: '轮询失败' },
  idle: { color: 'green', label: '等待轮询' },
  polling: { color: 'blue', label: '正在轮询' },
};

const EPISODE_COLUMNS: Array<TableColumnType<MediaGovernanceApi.Episode>> = [
  {
    dataIndex: 'episodeNumber',
    key: 'episodeNumber',
    title: '剧集',
    width: 120,
  },
  { dataIndex: 'status', key: 'status', title: '状态', width: 140 },
  { dataIndex: 'bindings', key: 'task', title: '执行任务' },
  { align: 'center', key: 'action', title: '操作', width: 88 },
];

/**
 * 在本地 Admin 连接旧线上 API 时投影一个只读主 Work，正式写操作仍要求新 API 返回真实 Work。
 *
 * @param detail - 可能尚未包含 works 的兼容 Series 详情。
 * @returns 始终带至少一个可展示 Work 的详情。
 */
export function normalizeSeriesWorks(
  detail: MediaGovernanceApi.SeriesDetail,
): MediaGovernanceApi.SeriesDetail {
  if (Array.isArray(detail.works) && detail.works.length > 0) return detail;
  const workId =
    detail.series.primaryWorkId || `legacy-primary:${detail.series.id}`;
  const canonicalNamespace = resolveLegacyReferenceNamespace(
    detail.series.canonicalProvider,
    detail.series.mediaType,
  );
  const references = detail.references.map((reference) => ({
    id: `legacy-work-ref:${reference.id}`,
    provider: reference.provider,
    providerId: reference.providerId,
    providerNamespace: resolveLegacyReferenceNamespace(
      reference.provider,
      detail.series.mediaType,
    ),
    referenceRole: reference.referenceRole,
    releaseYear: reference.releaseYear,
    title: reference.title,
    workId,
  }));
  if (references.length === 0) {
    references.push({
      id: `legacy-work-ref:${detail.series.id}`,
      provider: detail.series.canonicalProvider,
      providerId: detail.series.canonicalProviderId,
      providerNamespace: canonicalNamespace,
      referenceRole: 'canonical',
      releaseYear: detail.series.releaseYear,
      title: detail.series.title,
      workId,
    });
  }
  detail.works = [
    {
      canonicalNamespace,
      canonicalProvider: detail.series.canonicalProvider,
      canonicalProviderId: detail.series.canonicalProviderId,
      id: workId,
      isPrimary: true,
      originalTitle: detail.series.originalTitle,
      references,
      releaseYear: detail.series.releaseYear,
      revision: detail.series.revision,
      seasonCount: detail.seasons.length,
      seasons: detail.seasons,
      seriesId: detail.series.id,
      status: 'active',
      taskCount: detail.taskBindings.length,
      title: detail.series.title,
      workType: detail.series.mediaType,
    },
  ];
  return detail;
}

/**
 * 按资料源与媒体类型恢复旧 Series 引用的命名空间，避免 Bangumi subject 被误写成 TMDB TV/Movie。
 *
 * @param provider - 旧外部引用的资料源。
 * @param mediaType - 所属旧 Series 的媒体类型。
 * @returns Work 外部引用使用的规范命名空间。
 */
function resolveLegacyReferenceNamespace(
  provider: MediaGovernanceApi.Provider,
  mediaType: MediaGovernanceApi.MediaType,
): MediaGovernanceApi.WorkExternalRef['providerNamespace'] {
  if (provider === 'bangumi') return 'subject';
  if (mediaType === 'tv') return 'tv';
  return 'movie';
}

export default defineComponent({
  name: 'MediaGovernanceSeriesDetail',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const allowDeleteRss = hasAccessByCodes(['Media:Governance:Delete']);
    const route = useRoute();
    const router = useRouter();
    const seriesId = computed(() => String(route.params.seriesId || ''));
    const detail = ref<MediaGovernanceApi.SeriesDetail>();
    const episodes = ref<MediaGovernanceApi.Episode[]>([]);
    const episodeTotal = ref(0);
    const episodePageNo = ref(1);
    const episodeLoading = ref(true);
    const episodePageSize = 100;
    const loading = ref(false);
    const routeTab = String(route.query.tab || 'overview');
    let initialTab = 'overview';
    if (routeTab === 'tasks') initialTab = 'tasks';
    const activeTab = ref(initialTab);
    const routeWorkId = String(route.query.workId || '');
    const selectedWorkId = ref<string | undefined>(routeWorkId || undefined);
    const selectedWork = computed(() => {
      if (!detail.value) return undefined;
      return detail.value.works?.find(
        (work) => work.id === selectedWorkId.value,
      );
    });
    const selectedSeasonNumber = ref<number>();
    const selectedSeason = computed(() => {
      if (!detail.value) return undefined;
      return selectedWork.value?.seasons.find(
        (season) => season.seasonNumber === selectedSeasonNumber.value,
      );
    });
    const taskDrawer = ref<MediaGovernanceTaskDrawerExposed>();
    const actions = useSeriesActions({
      detail,
      seriesId,
      selectedWork,
      selectedSeason,
      selectedSeasonNumber,
      loadDetail,
      loadEpisodes,
      selectWork,
      openTask,
    });
    let deepLinkedTaskOpened = false;

    /**
     * 并行读取系列详情与当前季 Episode 首屏。
     */
    async function loadDetail() {
      loading.value = true;
      try {
        detail.value = normalizeSeriesWorks(
          await getMediaGovernanceSeries(seriesId.value),
        );
        const firstWork = detail.value.works?.[0];
        if (!selectedWorkId.value && firstWork) {
          selectedWorkId.value =
            detail.value.series.primaryWorkId || firstWork.id;
        }
        const firstSeason = selectedWork.value?.seasons[0];
        if (selectedSeasonNumber.value === undefined && firstSeason) {
          selectedSeasonNumber.value = firstSeason.seasonNumber;
        }
        await loadEpisodes(1);
        const deepLinkedTaskId = String(route.query.taskId || '');
        if (!deepLinkedTaskOpened && deepLinkedTaskId) {
          deepLinkedTaskOpened = true;
          await nextTick();
          taskDrawer.value?.open(deepLinkedTaskId);
        }
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
      const workId = selectedWork.value?.id;
      if (seasonNumber === undefined || !workId) {
        episodes.value = [];
        episodeTotal.value = 0;
        episodeLoading.value = false;
        return;
      }
      episodeLoading.value = true;
      try {
        const page = await getMediaGovernanceEpisodes(
          seriesId.value,
          workId,
          seasonNumber,
          { pageNo, pageSize: episodePageSize },
        );
        episodes.value = page.items;
        episodeTotal.value = page.total;
        episodePageNo.value = pageNo;
      } finally {
        episodeLoading.value = false;
      }
    }

    /**
     * 用一个上下文选择同时切换 Work 与可选 Season，并回到该范围的概览首屏。
     * @param workId - 新选中的 Work 标识。
     * @param seasonNumber - TV Work 的目标季号；独立作品不传。
     */
    function selectSeriesContext(
      workId: string,
      seasonNumber: number | undefined,
    ) {
      selectedWorkId.value = workId;
      selectedSeasonNumber.value = seasonNumber;
      activeTab.value = 'overview';
      void loadEpisodes(1);
    }

    /**
     * 切换 Series 内具体 Work，并把 Season/Episode 与 Tabs 重置到该 Work 边界。
     *
     * @param workId - 新选中的 Work 标识。
     */
    function selectWork(workId: string) {
      const work = detail.value?.works?.find((item) => item.id === workId);
      selectSeriesContext(workId, work?.seasons[0]?.seasonNumber);
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
     * 确认删除订阅及抓取记录后提交版本校验请求，并刷新系列统计和订阅列表。
     *
     * @param subscription - 用户选中的 RSS 订阅快照。
     */
    function confirmDeleteRss(
      subscription: MediaGovernanceApi.RssSubscription,
    ) {
      if (!allowDeleteRss || subscription.status === 'polling') return;
      Modal.confirm({
        cancelText: '取消',
        content: `将删除“${subscription.name}”及其抓取记录，停止后续订阅轮询。已经创建的下载任务、文件和剧集绑定会保留。`,
        okText: '确认删除',
        okType: 'danger',
        onOk: async () => {
          await deleteMediaGovernanceRssSubscription(
            subscription.id,
            subscription.revision,
          );
          message.success('RSS 订阅已删除');
          await loadDetail();
        },
        title: '删除 RSS 订阅',
      });
    }

    /**
     * 用稳定 Task ID 打开与任务列表相同的详情抽屉，避免依赖后端菜单未注册的隐藏路由。
     *
     * @param taskId - 媒体治理 Task 标识。
     */
    function openTask(taskId: string) {
      taskDrawer.value?.open(taskId);
    }

    /**
     * 按当前 Tab 渲染概览、剧集、RSS 或执行历史内容。
     *
     * @returns 当前 Tab 内容。
     */
    function renderTabContent() {
      if (!detail.value) return null;
      const work = selectedWork.value;
      if (activeTab.value === 'episodes') {
        if (!work || work.workType !== 'tv') return null;
        return renderEpisodes(
          episodes.value,
          episodePageNo.value,
          episodePageSize,
          episodeTotal.value,
          episodeLoading.value,
          (pageNo) => void loadEpisodes(pageNo),
          openTask,
        );
      }
      if (activeTab.value === 'rss') {
        if (!work || work.workType !== 'tv') return null;
        const seasonIds = new Set(work.seasons.map((season) => season.id));
        return renderRssSubscriptions(
          detail.value.rssSubscriptions.filter((subscription) =>
            seasonIds.has(subscription.seasonId),
          ),
          pollRss,
          toggleRss,
          confirmDeleteRss,
          allowDeleteRss,
        );
      }
      if (activeTab.value === 'tasks') {
        let bindings = detail.value.taskBindings;
        const workScoped = bindings.some((binding) => Boolean(binding.workId));
        if (work && workScoped) {
          bindings = bindings.filter((binding) => binding.workId === work.id);
        }
        return renderTaskBindings(bindings, openTask);
      }
      return renderWorkOverview(detail.value, work);
    }

    /**
     * 收到当前系列目录事件后回读详情；删除墓碑则退出已失效的详情路由。
     *
     * @param event - API 提交 Task/Binding 后发布的完整系列事件。
     */
    async function handleCatalogChanged(
      event: MediaGovernanceApi.CatalogChangedEvent,
    ) {
      if (event.seriesId !== seriesId.value) return;
      if (event.changeType === 'deleted') {
        message.info('当前系列已删除');
        await router.replace({ name: 'MediaGovernanceSeries' });
        return;
      }
      await loadDetail();
      if (activeTab.value === 'episodes') {
        await loadEpisodes(episodePageNo.value);
      }
    }

    const stream = useMediaGovernanceStream({
      onCatalogChanged: (event) => {
        void handleCatalogChanged(event).catch(() => undefined);
      },
      onSnapshotRequired: () => {
        void loadDetail().catch(() => undefined);
      },
    });

    onMounted(() => {
      void loadDetail();
      stream.start();
    });
    onBeforeUnmount(stream.close);

    return () => {
      let loadedContent = null;
      if (detail.value) {
        const tabs = [
          { key: 'overview', label: '作品概览' },
          { key: 'tasks', label: '执行历史' },
        ];
        if (selectedWork.value?.workType === 'tv') {
          tabs.splice(
            1,
            0,
            { key: 'episodes', label: '剧集' },
            { key: 'rss', label: 'RSS 订阅' },
          );
        }
        loadedContent = (
          <>
            {renderSeriesHeader(detail.value)}
            <section class="media-governance-series-detail__workspace">
              <div class="media-governance-series-detail__navigators">
                {renderSeriesContextNavigation(
                  detail.value.works,
                  selectedWorkId.value,
                  selectedSeasonNumber.value,
                  selectSeriesContext,
                  actions.openWork,
                  () => void actions.createWorkTask(),
                  actions.openSeason,
                  actions.openBatch,
                  actions.openRss,
                )}
              </div>
              {renderSeasonWorkspaceHeader(selectedSeason.value)}
              <ATabs
                class="media-governance-series-detail__tabs"
                items={tabs}
                v-model:activeKey={activeTab.value}
              />
              <div class="media-governance-series-detail__tab-content">
                {renderTabContent()}
              </div>
            </section>
          </>
        );
      }
      return (
        <Page autoContentHeight>
          <ASpin
            class="media-governance-series-detail__loading"
            spinning={loading.value}
          >
            <div class="media-governance-series-detail">{loadedContent}</div>
          </ASpin>
          {actions.renderModals()}
          <MediaGovernanceTaskDrawer
            onChanged={() => void loadDetail()}
            ref={taskDrawer}
          />
        </Page>
      );
    };
  },
});

/**
 * 把当前季的身份、连续集号范围和覆盖事实放到工作区页签上方，避免用户在内容区失去季上下文。
 *
 * @param season - 当前选中的 canonical Season；尚未加载时为 undefined。
 * @returns 当前季工作区头部；没有选中季时返回 null。
 */
function renderSeasonWorkspaceHeader(
  season: MediaGovernanceApi.SeasonCard | undefined,
) {
  if (!season) return null;
  const episodeEnd = season.episodeStart + season.episodeCount - 1;
  return (
    <header class="media-governance-series-workspace-header">
      <div class="media-governance-series-workspace-header__identity">
        <span>S{String(season.seasonNumber).padStart(2, '0')}</span>
        <div>
          <strong>{season.title}</strong>
          <small>
            {season.releaseYear || '年份待定'} · E{season.episodeStart}–E
            {episodeEnd}
          </small>
        </div>
      </div>
      <dl class="media-governance-series-workspace-header__metrics">
        <div>
          <dt>Task</dt>
          <dd>{season.taskCount}</dd>
        </div>
        <div>
          <dt>已绑定</dt>
          <dd>
            {season.boundEpisodeCount}/{season.episodeCount}
          </dd>
        </div>
        <div>
          <dt>覆盖率</dt>
          <dd>{season.coveragePercent}%</dd>
        </div>
      </dl>
    </header>
  );
}

/**
 * 渲染系列 canonical 身份与仅图标操作栏。
 *
 * @param detail - 系列详情。
 * @returns 系列头部卡片。
 */
function renderSeriesHeader(detail: MediaGovernanceApi.SeriesDetail) {
  const episodeCount = detail.seasons.reduce(
    (total, season) => total + season.episodeCount,
    0,
  );
  const enabledRssCount = detail.rssSubscriptions.filter(
    (subscription) => subscription.enabled,
  ).length;
  return (
    <AKtCardListCard
      class="media-governance-series-detail__summary"
      v-slots={{
        default: () => (
          <div class="media-governance-series-detail__masthead">
            <div class="media-governance-series-detail__identity">
              <span>媒体系列</span>
              <div>
                <h1>{detail.series.title}</h1>
                <ATag color="blue">
                  {`${detail.series.canonicalProvider.toUpperCase()} · ${detail.series.canonicalProviderId}`}
                </ATag>
              </div>
              <p>
                {detail.series.originalTitle || '未记录原名'} ·{' '}
                {detail.series.releaseYear} 年
              </p>
            </div>
            <dl class="media-governance-series-detail__metrics">
              <div>
                <dt>作品</dt>
                <dd>{detail.works.length}</dd>
              </div>
              <div>
                <dt>Episode</dt>
                <dd>{episodeCount}</dd>
              </div>
              <div>
                <dt>执行历史</dt>
                <dd>{detail.taskBindings.length}</dd>
              </div>
              <div>
                <dt>RSS</dt>
                <dd>
                  {enabledRssCount}/{detail.rssSubscriptions.length}
                </dd>
              </div>
            </dl>
          </div>
        ),
      }}
    />
  );
}

/**
 * 将同一 Series 的 TV Season 与独立 Work 展平为一排唯一上下文 card Tabs。
 *
 * @param works - 当前 Series 下全部已核验 Work。
 * @param selectedWorkId - 当前选中 Work 标识。
 * @param selectedSeasonNumber - 当前 TV Work 选中季号。
 * @param selectContext - 同时切换 Work 与可选 Season 的回调。
 * @param addWork - 打开新增 Work 身份选择器的回调。
 * @param createTask - 从当前 Work 创建执行 Task 的回调。
 * @param addSeason - 为当前 TV Work 添加 Season 的回调。
 * @param openBatch - 打开 TV Work 当前季批量磁链的回调。
 * @param openRss - 打开 TV Work 当前季 RSS 的回调。
 * @returns 同时覆盖 TV Season、电影和剧场版的一排上下文 Tabs。
 */
function renderSeriesContextNavigation(
  works: MediaGovernanceApi.SeriesWork[],
  selectedWorkId: string | undefined,
  selectedSeasonNumber: number | undefined,
  selectContext: (workId: string, seasonNumber: number | undefined) => void,
  addWork: () => void,
  createTask: () => void,
  addSeason: () => void,
  openBatch: () => Promise<void>,
  openRss: () => void,
) {
  const selectedWork = works.find((work) => work.id === selectedWorkId);
  let batchAction = null;
  let rssAction = null;
  let seasonAction = null;
  if (selectedWork?.workType === 'tv') {
    seasonAction = (
      <ATooltip title="添加季">
        <AButton aria-label="添加季" onClick={addSeason} type="text">
          <FolderAddOutlined />
        </AButton>
      </ATooltip>
    );
    batchAction = (
      <ATooltip title="批量添加磁链">
        <AButton
          aria-label="批量添加磁链"
          onClick={() => void openBatch()}
          type="text"
        >
          <CloudDownloadOutlined />
        </AButton>
      </ATooltip>
    );
    rssAction = (
      <ATooltip title="创建 RSS 订阅">
        <AButton aria-label="创建 RSS 订阅" onClick={openRss} type="text">
          <LinkOutlined />
        </AButton>
      </ATooltip>
    );
  }
  let actions = null;
  if (selectedWork) {
    actions = (
      <div class="media-governance-series-detail__work-actions">
        <ATooltip title="添加作品">
          <AButton aria-label="添加作品" onClick={addWork} type="text">
            <AppstoreAddOutlined />
          </AButton>
        </ATooltip>
        <ATooltip title="创建执行任务">
          <AButton aria-label="创建执行任务" onClick={createTask} type="text">
            <FileAddOutlined />
          </AButton>
        </ATooltip>
        {seasonAction}
        {batchAction}
        {rssAction}
      </div>
    );
  }
  const contextByKey = new Map<
    string,
    { seasonNumber: number | undefined; workId: string }
  >();
  const contextItems = [];
  for (const work of works) {
    let typeLabel = 'TV';
    if (work.workType === 'movie') typeLabel = '电影';
    if (work.workType === 'theatrical') typeLabel = '剧场版';
    if (work.workType === 'tv' && work.seasons.length > 0) {
      for (const season of work.seasons) {
        const key = `${work.id}:season:${season.seasonNumber}`;
        const seasonLabel = `S${String(season.seasonNumber).padStart(2, '0')}`;
        const episodeEnd = season.episodeStart + season.episodeCount - 1;
        let label = `${seasonLabel} · ${season.title} · E${season.episodeStart}–E${episodeEnd}`;
        if (works.length > 1) label = `${work.title} · ${label}`;
        contextByKey.set(key, {
          seasonNumber: season.seasonNumber,
          workId: work.id,
        });
        contextItems.push({ key, label });
      }
      continue;
    }
    const key = `${work.id}:work`;
    contextByKey.set(key, { seasonNumber: undefined, workId: work.id });
    contextItems.push({
      key,
      label: `${typeLabel} · ${work.title} · ${work.releaseYear} 年`,
    });
  }
  let activeKey: string | undefined;
  if (selectedWorkId) activeKey = `${selectedWorkId}:work`;
  if (selectedWorkId && selectedSeasonNumber !== undefined) {
    activeKey = `${selectedWorkId}:season:${selectedSeasonNumber}`;
  }
  return (
    <ATabs
      activeKey={activeKey}
      class="media-governance-series-detail__context-tabs"
      items={contextItems}
      onChange={(key: string) => {
        const context = contextByKey.get(key);
        if (!context) return;
        selectContext(context.workId, context.seasonNumber);
      }}
      tabBarExtraContent={actions}
      tabBarGutter={0}
      type="card"
    />
  );
}

/**
 * 将当前 Work 的身份引用与层级范围并列展示，避免其他 Work 的事实混入当前上下文。
 *
 * @param detail - 系列详情。
 * @param work - 当前选中的 Work。
 * @returns 概览内容。
 */
function renderWorkOverview(
  detail: MediaGovernanceApi.SeriesDetail,
  work: MediaGovernanceApi.SeriesWork | undefined,
) {
  if (!work) return <AEmpty description="当前系列没有可用作品" />;
  let referenceContent = (
    <span class="media-governance-series-overview__empty">
      当前作品没有附加资料引用
    </span>
  );
  if (work.references.length > 0) {
    referenceContent = (
      <>
        {work.references.map((reference) => (
          <div class="media-governance-fact-row" key={reference.id}>
            <span>{reference.provider.toUpperCase()}</span>
            <strong>{reference.providerId}</strong>
            <span class="text-muted-foreground">
              {reference.title || '未记录标题'} ·{' '}
              {reference.releaseYear || '年份待定'}
            </span>
          </div>
        ))}
      </>
    );
  }
  let typeLabel = 'TV';
  if (work.workType === 'movie') typeLabel = '电影';
  if (work.workType === 'theatrical') typeLabel = '剧场版';
  const episodeCount = work.seasons.reduce(
    (total, season) => total + season.episodeCount,
    0,
  );
  const boundEpisodeCount = work.seasons.reduce(
    (total, season) => total + season.boundEpisodeCount,
    0,
  );
  let boundEpisodeLabel = `${boundEpisodeCount}/${episodeCount}`;
  if (work.workType !== 'tv') boundEpisodeLabel = '不适用';
  return (
    <div class="media-governance-series-overview">
      <section class="media-governance-series-overview__panel">
        <header>
          <div>
            <strong>作品身份</strong>
            <span>所属系列：{detail.series.title}</span>
          </div>
          <ATag>{work.references.length}</ATag>
        </header>
        <div class="media-governance-series-overview__list">
          {referenceContent}
        </div>
      </section>
      <section class="media-governance-series-overview__panel">
        <header>
          <div>
            <strong>作品统计</strong>
            <span>当前 Work 的目录与执行聚合</span>
          </div>
          <ATag>{typeLabel}</ATag>
        </header>
        <dl class="media-governance-work-facts">
          <div>
            <dt>年份</dt>
            <dd>{work.releaseYear}</dd>
          </div>
          <div>
            <dt>季</dt>
            <dd>{work.seasonCount}</dd>
          </div>
          <div>
            <dt>已绑定剧集</dt>
            <dd>{boundEpisodeLabel}</dd>
          </div>
          <div>
            <dt>执行任务</dt>
            <dd>{work.taskCount}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/**
 * 将分页 Episode 放入普通 KtTable，并只为已有绑定的集提供 Task 图标入口。
 *
 * @param episodes - 当前页 Episode。
 * @param pageNo - 当前页码。
 * @param pageSize - 每页条数。
 * @param total - 总集数。
 * @param loading - Episode 分页请求是否仍在读取。
 * @param changePage - 切换页码回调。
 * @param openTask - 打开绑定 Task 的回调。
 * @returns 带服务端分页的普通 Episode 表格。
 */
function renderEpisodes(
  episodes: MediaGovernanceApi.Episode[],
  pageNo: number,
  pageSize: number,
  total: number,
  loading: boolean,
  changePage: (pageNo: number) => void,
  openTask: (taskId: string) => void,
) {
  return (
    <div class="media-governance-episode-list">
      <ASpin class="media-governance-episode-table-loading" spinning={loading}>
        <div class="media-governance-episode-table">
          <AKtTable
            columns={EPISODE_COLUMNS}
            dataSource={episodes}
            rowKey="id"
            showDefaultButtons={false}
            showFooter={false}
            showHeader={false}
            showIndex={false}
            showPagination={false}
            showSelection={false}
            showTableSetting={false}
            v-slots={{
              bodyCell: ({ column, record }: any) =>
                renderEpisodeTableCell(column.key, record, openTask),
            }}
          />
        </div>
      </ASpin>
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
 * 把 Episode 的集号、状态、绑定任务和语义图标操作映射到普通表格单元格。
 *
 * @param key - 当前 KtTable 列键。
 * @param episode - 当前 canonical Episode。
 * @param openTask - 打开绑定 Task 的回调。
 * @returns 当前列对应的表格内容；未知列返回 undefined。
 */
function renderEpisodeTableCell(
  key: string,
  episode: MediaGovernanceApi.Episode,
  openTask: (taskId: string) => void,
) {
  if (key === 'episodeNumber') {
    return <strong>E{String(episode.episodeNumber).padStart(2, '0')}</strong>;
  }
  if (key === 'status') {
    return (
      <ATag color={episodeStatusColor(episode.status)}>
        {episodeStatusLabel(episode.status)}
      </ATag>
    );
  }
  const taskId = episode.bindings[0]?.taskId;
  if (key === 'task') {
    if (!taskId) return <span class="text-muted-foreground">尚无执行任务</span>;
    return <span class="break-all">{taskId}</span>;
  }
  if (key === 'action') {
    if (!taskId) return <span class="text-muted-foreground">—</span>;
    return (
      <ATooltip title="查看执行任务">
        <AButton
          aria-label="查看执行任务"
          onClick={() => openTask(taskId)}
          size="small"
          type="text"
        >
          <EyeOutlined />
        </AButton>
      </ATooltip>
    );
  }
  return undefined;
}

/**
 * 按启用态生成轮询及暂停/恢复图标，并把最近错误保留在对应订阅卡片内。
 *
 * @param subscriptions - 当前系列 RSS 订阅。
 * @param poll - 立即轮询回调。
 * @param toggle - 启停订阅回调。
 * @param remove - 确认删除订阅的回调。
 * @param allowDelete - 当前账号是否具有订阅删除权限。
 * @returns RSS 订阅列表。
 */
function renderRssSubscriptions(
  subscriptions: MediaGovernanceApi.RssSubscription[],
  poll: (subscription: MediaGovernanceApi.RssSubscription) => Promise<void>,
  toggle: (
    subscription: MediaGovernanceApi.RssSubscription,
    enabled: boolean,
  ) => Promise<void>,
  remove: (subscription: MediaGovernanceApi.RssSubscription) => void,
  allowDelete: boolean,
) {
  if (subscriptions.length === 0) {
    return <AEmpty description="当前系列还没有 RSS 订阅" />;
  }
  return (
    <div class="media-governance-rss-list">
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
        if (allowDelete && subscription.status !== 'polling') {
          items.push(
            iconAction(
              'delete',
              '删除 RSS 订阅',
              <DeleteOutlined />,
              () => {
                remove(subscription);
              },
              true,
            ),
          );
        }
        let statusPresentation: { color: string; label: string } = {
          color: 'default',
          label: subscription.status,
        };
        const knownStatus =
          RSS_SUBSCRIPTION_STATUS_PRESENTATION[subscription.status];
        if (knownStatus) statusPresentation = knownStatus;
        let releaseGroupTag = null;
        if (subscription.releaseGroup) {
          releaseGroupTag = <ATag>{subscription.releaseGroup}</ATag>;
        }
        let lastPollLabel = '尚未轮询';
        if (subscription.lastPolledAt) {
          lastPollLabel = subscription.lastPolledAt;
        }
        let errorNode = null;
        if (subscription.lastError) {
          errorNode = (
            <div class="media-governance-rss-card__error">
              {subscription.lastError}
            </div>
          );
        }
        return (
          <AKtCardListCard
            class="media-governance-rss-card"
            key={subscription.id}
            size="small"
            v-slots={{
              actions: () => (
                <AKtActionGroup
                  items={items}
                  layout="balanced"
                  size="small"
                  visibleCount={3}
                />
              ),
              default: () => (
                <div class="media-governance-rss-card__content">
                  <header class="media-governance-rss-card__header">
                    <strong
                      class="media-governance-rss-card__title"
                      title={subscription.name}
                    >
                      {subscription.name}
                    </strong>
                    <div class="media-governance-rss-card__tags">
                      {releaseGroupTag}
                      <ATag color={statusPresentation.color}>
                        {statusPresentation.label}
                      </ATag>
                    </div>
                  </header>
                  <a
                    class="media-governance-rss-card__feed"
                    href={subscription.feedUrl}
                    rel="noreferrer"
                    target="_blank"
                    title={subscription.feedUrl}
                  >
                    {subscription.feedUrl}
                  </a>
                  <div class="media-governance-rss-card__meta">
                    <span>
                      S{String(subscription.seasonNumber).padStart(2, '0')}
                    </span>
                    <span>每 {subscription.pollIntervalMinutes} 分钟</span>
                    <span>上次轮询：{lastPollLabel}</span>
                  </div>
                  {errorNode}
                </div>
              ),
            }}
          />
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
    <div class="media-governance-task-binding-list">
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
 * @param danger - 是否将操作显示为危险操作颜色。
 * @returns 图标操作项。
 */
function iconAction(
  key: string,
  label: string,
  icon: VNodeChild,
  action: () => void,
  danger = false,
): KtActionGroupItem {
  return {
    content: (
      <ATooltip title={label}>
        <AButton
          aria-label={label}
          block
          danger={danger}
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
