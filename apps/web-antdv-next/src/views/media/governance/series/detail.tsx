import type { VNodeChild } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type { KtActionGroupItem } from '#/components/kt-table';

import { computed, defineComponent, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  CloudDownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  LinkOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
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
import { KtCardList } from '#/components/kt-card-list';
import { KtActionGroup } from '#/components/kt-table';

import './detail.scss';

const AButton = Button as any;
const ACard = Card as any;
const AEmpty = Empty as any;
const AForm = Form as any;
const AFormItem = FormItem as any;
const AInput = Input as any;
const AInputNumber = InputNumber as any;
const AKtCardList = KtCardList as any;
const AKtActionGroup = KtActionGroup as any;
const AModal = Modal as any;
const APagination = Pagination as any;
const AProgress = Progress as any;
const ASelect = Select as any;
const ASpin = Spin as any;
const ASwitch = Switch as any;
const ATabs = Tabs as any;
const ATag = Tag as any;
const ATooltip = Tooltip as any;

const MAX_BATCH_MAGNET_ROWS = 16;
const MAGNET_EPISODE_PAGE_SIZE = 200;

const CONTENT_KIND_OPTIONS = [
  { label: '同包外挂字幕', value: 'bundled_sidecar_media' },
  { label: '内嵌字幕', value: 'embedded_subtitle_media' },
  { label: '烧录字幕', value: 'burned_in_subtitle_media' },
  { label: '无字幕媒体', value: 'subtitleless_media' },
];

export interface BatchMagnetRow {
  episodeNumber: number | undefined;
  id: number;
  magnetUri: string;
}

export interface BatchMagnetValidationResult {
  error: null | string;
  items: MediaGovernanceApi.MagnetBatchCreateInput['items'];
}

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
    const selectedSeason = computed(() => {
      if (!detail.value) return undefined;
      return detail.value.seasons.find(
        (season) => season.seasonNumber === selectedSeasonNumber.value,
      );
    });
    const batchOpen = ref(false);
    const batchRows = ref<BatchMagnetRow[]>([]);
    const batchResolvingEpisode = ref(false);
    const batchSubmitting = ref(false);
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
    let batchRowSequence = 0;

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
     * 为结构化磁链编辑器创建稳定键行，并保留尚未确定集号的显式空值。
     *
     * @param episodeNumber - 新行预填的 canonical 集号。
     * @returns 可被逐字段编辑的单条按集磁链行。
     */
    function createBatchRow(episodeNumber: number | undefined) {
      batchRowSequence += 1;
      return {
        episodeNumber,
        id: batchRowSequence,
        magnetUri: '',
      };
    }

    /**
     * 分页读取当前季全部 Episode，返回真正首个没有 Task 绑定的集号。
     *
     * @returns 首个未绑定集号；全部绑定或没有当前季时返回 undefined。
     */
    async function resolveFirstUnboundEpisodeNumber() {
      const season = selectedSeason.value;
      if (!season) return undefined;
      const pageCount = Math.ceil(
        season.episodeCount / MAGNET_EPISODE_PAGE_SIZE,
      );
      for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
        const page = await getMediaGovernanceEpisodes(
          seriesId.value,
          season.seasonNumber,
          { pageNo, pageSize: MAGNET_EPISODE_PAGE_SIZE },
        );
        const firstUnbound = page.items.find(
          (episode) => episode.bindings.length === 0,
        );
        if (firstUnbound) return firstUnbound.episodeNumber;
      }
      return undefined;
    }

    /**
     * 打开逐集磁链弹窗，并以全季 Episode 权威分页定位首个未绑定集。
     */
    async function openBatch() {
      if (!selectedSeason.value) {
        message.error('请先选择季');
        return;
      }
      batchRows.value = [createBatchRow(undefined)];
      batchOpen.value = true;
      batchResolvingEpisode.value = true;
      try {
        const episodeNumber = await resolveFirstUnboundEpisodeNumber();
        if (!batchOpen.value) return;
        const firstRow = batchRows.value[0];
        if (
          firstRow &&
          firstRow.episodeNumber === undefined &&
          episodeNumber !== undefined
        ) {
          firstRow.episodeNumber = episodeNumber;
          return;
        }
        if (firstRow?.episodeNumber !== undefined) return;
        message.info(
          '当前季全部 Episode 均已有 Task 绑定，可手动指定需补录的集号',
        );
      } catch {
        if (batchOpen.value) {
          message.warning('未能自动定位首个未绑定集，请手动填写集号');
        }
      } finally {
        batchResolvingEpisode.value = false;
      }
    }

    /**
     * 按当前行尾集号确定性寻找下一可用集号，并把编辑器限制在 16 行以内。
     */
    function addBatchRow() {
      const season = selectedSeason.value;
      if (!season) {
        message.error('请先选择季');
        return;
      }
      if (batchRows.value.length >= MAX_BATCH_MAGNET_ROWS) {
        message.warning('单次最多添加 16 条按集磁链');
        return;
      }
      const episodeNumber = nextBatchEpisodeNumber(
        batchRows.value,
        season.episodeStart,
        season.episodeCount,
      );
      if (episodeNumber === undefined) {
        message.warning('当前季没有可继续递增的集号');
        return;
      }
      batchRows.value.push(createBatchRow(episodeNumber));
    }

    /**
     * 按稳定行键删除目标磁链行，并始终保留至少一个输入入口。
     *
     * @param rowId - 要删除的编辑器行键。
     */
    function removeBatchRow(rowId: number) {
      if (batchRows.value.length <= 1) return;
      batchRows.value = batchRows.value.filter((row) => row.id !== rowId);
    }

    /**
     * 校验逐集结构化行后创建一条多来源 Task，并在请求期间锁定确认按钮。
     */
    async function submitBatch() {
      const season = selectedSeason.value;
      if (!season) {
        message.error('请先选择季');
        return;
      }
      const validation = validateBatchMagnetRows(
        batchRows.value,
        season.episodeStart,
        season.episodeCount,
      );
      if (validation.error) {
        message.error(validation.error);
        return;
      }
      batchSubmitting.value = true;
      try {
        await createMediaGovernanceMagnetBatch(
          seriesId.value,
          season.seasonNumber,
          {
            contentKind: batchContentKind.value,
            items: validation.items,
            releaseGroup: batchReleaseGroup.value.trim() || undefined,
          },
        );
        batchOpen.value = false;
        message.success(
          `已创建包含 ${validation.items.length} 个按集来源的执行任务`,
        );
        await loadDetail();
      } finally {
        batchSubmitting.value = false;
      }
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
      let batchEpisodeStart = 1;
      let batchEpisodeCount = 0;
      if (selectedSeason.value) {
        batchEpisodeStart = selectedSeason.value.episodeStart;
        batchEpisodeCount = selectedSeason.value.episodeCount;
      }
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
            confirmLoading={batchSubmitting.value}
            okButtonProps={{ disabled: batchResolvingEpisode.value }}
            okText="创建任务"
            onCancel={() => {
              batchOpen.value = false;
            }}
            onOk={() => void submitBatch()}
            open={batchOpen.value}
            title="批量添加按集磁链"
            width={900}
          >
            <AForm layout="vertical">
              <div class="grid gap-3 sm:grid-cols-2">
                <AFormItem label="发布组">
                  <AInput v-model:value={batchReleaseGroup.value} />
                </AFormItem>
                <AFormItem label="内容类型">
                  <ASelect
                    options={CONTENT_KIND_OPTIONS}
                    v-model:value={batchContentKind.value}
                  />
                </AFormItem>
              </div>
              {renderBatchMagnetEditor(
                batchRows.value,
                batchEpisodeStart,
                batchEpisodeCount,
                batchResolvingEpisode.value,
                addBatchRow,
                removeBatchRow,
              )}
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
 * 把批次来源合同固定为 1–16 个显式集号/磁链对，并统一呈现首集定位与增删边界。
 *
 * @param rows - 当前结构化磁链行。
 * @param episodeStart - 当前季 canonical 起始集号。
 * @param episodeCount - 当前季 canonical 总集数。
 * @param resolvingEpisode - 是否正在定位首个未绑定集。
 * @param addRow - 新增下一集行的回调。
 * @param removeRow - 删除指定行的回调。
 * @returns 批量磁链结构化编辑器。
 */
function renderBatchMagnetEditor(
  rows: BatchMagnetRow[],
  episodeStart: number,
  episodeCount: number,
  resolvingEpisode: boolean,
  addRow: () => void,
  removeRow: (rowId: number) => void,
) {
  const episodeEnd = episodeStart + episodeCount - 1;
  let resolvingNode = null;
  if (resolvingEpisode) {
    resolvingNode = (
      <div class="media-governance-batch-editor__locating">
        <ASpin size="small" />
        <span>正在从当前季 Episode 中定位首个未绑定集…</span>
      </div>
    );
  }
  const addDisabled = resolvingEpisode || rows.length >= MAX_BATCH_MAGNET_ROWS;
  const removeDisabled = rows.length <= 1;
  return (
    <section aria-label="逐集磁链编辑器" class="media-governance-batch-editor">
      <div class="media-governance-batch-editor__header">
        <div>
          <strong>按集来源</strong>
          <span>每行明确绑定一个集号和一条磁链，提交前统一校验</span>
        </div>
        <ATag color="blue">
          {rows.length} / {MAX_BATCH_MAGNET_ROWS}
        </ATag>
      </div>
      {resolvingNode}
      <div aria-hidden="true" class="media-governance-batch-editor__columns">
        <span>集号</span>
        <span>单条磁链</span>
        <span />
      </div>
      <div class="media-governance-batch-editor__rows" role="list">
        {rows.map((row, index) => {
          const position = index + 1;
          return (
            <div
              class="media-governance-batch-editor__row"
              key={row.id}
              role="listitem"
            >
              <AInputNumber
                aria-label={`第 ${position} 行集号`}
                class="media-governance-batch-editor__episode-input"
                max={episodeEnd}
                min={episodeStart}
                onUpdate:value={(value: null | number) => {
                  if (value === null) {
                    row.episodeNumber = undefined;
                    return;
                  }
                  row.episodeNumber = value;
                }}
                placeholder="集号"
                precision={0}
                value={row.episodeNumber}
              />
              <AInput
                allowClear
                aria-label={`第 ${position} 行磁链`}
                class="media-governance-batch-editor__magnet-input"
                maxlength={4096}
                onUpdate:value={(value: string) => {
                  row.magnetUri = value;
                }}
                placeholder="magnet:?xt=urn:btih:40 位 BTIH..."
                value={row.magnetUri}
              />
              <ATooltip title="删除此行">
                <AButton
                  aria-label={`删除第 ${position} 行磁链`}
                  class="media-governance-batch-editor__remove"
                  danger
                  disabled={removeDisabled}
                  onClick={() => removeRow(row.id)}
                  type="text"
                >
                  <DeleteOutlined />
                </AButton>
              </ATooltip>
            </div>
          );
        })}
      </div>
      <AButton
        aria-label="添加下一集磁链"
        block
        disabled={addDisabled}
        onClick={addRow}
        type="dashed"
      >
        <PlusOutlined />
        添加下一集
      </AButton>
      <p class="media-governance-batch-editor__hint">
        新行按最后一行集号递增；单次最多创建 16 个来源。
      </p>
    </section>
  );
}

/**
 * 将最后一行集号递增一位，保证新增行顺序稳定且不越过当前季总集数。
 *
 * @param rows - 当前结构化磁链行。
 * @param episodeStart - 当前季 canonical 起始集号。
 * @param episodeCount - 当前季 canonical 总集数。
 * @returns 下一集号；最后一行无有效后继时返回 undefined。
 */
export function nextBatchEpisodeNumber(
  rows: BatchMagnetRow[],
  episodeStart: number,
  episodeCount: number,
) {
  if (episodeCount < 1) return undefined;
  const episodeEnd = episodeStart + episodeCount - 1;
  const lastRow = rows.at(-1);
  if (!lastRow) return episodeStart;
  if (lastRow.episodeNumber === undefined) return undefined;
  if (!Number.isInteger(lastRow.episodeNumber)) return undefined;
  const nextEpisode = lastRow.episodeNumber + 1;
  if (nextEpisode > episodeEnd) return undefined;
  return nextEpisode;
}

/**
 * 从符合后端契约的磁链中提取规范小写四十位 BTIH，用于跨 tracker 参数去重。
 *
 * @param magnetUri - 用户输入的单条磁链。
 * @returns 四十位小写 BTIH；格式不受支持时返回 null。
 */
function readBatchMagnetInfoHash(magnetUri: string) {
  if (!/^magnet:\?xt=urn:btih:/iu.test(magnetUri)) return null;
  try {
    const parsed = new URL(magnetUri);
    const exactTopics = parsed.searchParams.getAll('xt');
    for (const exactTopic of exactTopics) {
      const match = exactTopic.match(/^urn:btih:([a-f\d]{40})$/iu);
      if (!match) continue;
      const infoHash = match[1];
      if (infoHash) return infoHash.toLowerCase();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * 在发起请求前校验行数、集号范围、重复集号、磁链格式与重复 BTIH。
 *
 * @param rows - 待提交的结构化磁链行。
 * @param episodeStart - 当前季 canonical 起始集号。
 * @param episodeCount - 当前季 canonical 总集数。
 * @returns 规范化请求项；校验失败时返回首个可定位的中文错误。
 */
export function validateBatchMagnetRows(
  rows: BatchMagnetRow[],
  episodeStart: number,
  episodeCount: number,
): BatchMagnetValidationResult {
  const invalid = (error: string): BatchMagnetValidationResult => ({
    error,
    items: [],
  });
  if (rows.length === 0) {
    return invalid('至少添加一条按集磁链');
  }
  if (rows.length > MAX_BATCH_MAGNET_ROWS) {
    return invalid('单次最多添加 16 条按集磁链');
  }
  const episodeNumbers = new Set<number>();
  const infoHashes = new Set<string>();
  const items: MediaGovernanceApi.MagnetBatchCreateInput['items'] = [];
  const episodeEnd = episodeStart + episodeCount - 1;
  for (const [index, row] of rows.entries()) {
    const position = index + 1;
    const episodeNumber = row.episodeNumber;
    if (episodeNumber === undefined) {
      return invalid(`第 ${position} 行未填写集号`);
    }
    if (!Number.isInteger(episodeNumber)) {
      return invalid(`第 ${position} 行集号必须是整数`);
    }
    if (episodeNumber < episodeStart) {
      return invalid(
        `第 ${position} 行集号超出当前季 E${episodeStart}–E${episodeEnd} 范围`,
      );
    }
    if (episodeNumber > episodeEnd) {
      return invalid(
        `第 ${position} 行集号超出当前季 E${episodeStart}–E${episodeEnd} 范围`,
      );
    }
    if (episodeNumbers.has(episodeNumber)) {
      return invalid(`集号 E${episodeNumber} 在本批次中重复`);
    }
    const magnetUri = row.magnetUri.trim();
    if (!magnetUri) {
      return invalid(`第 ${position} 行未填写磁链`);
    }
    if (magnetUri.length > 4096) {
      return invalid(`第 ${position} 行磁链超过 4096 个字符`);
    }
    const infoHash = readBatchMagnetInfoHash(magnetUri);
    if (!infoHash) {
      return invalid(`第 ${position} 行不是受支持的 40 位 BTIH 磁链`);
    }
    if (infoHashes.has(infoHash)) {
      return invalid(`第 ${position} 行磁链与本批次其他行重复`);
    }
    episodeNumbers.add(episodeNumber);
    infoHashes.add(infoHash);
    items.push({ episodeNumber, magnetUri });
  }
  return { error: null, items };
}

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
  openBatch: () => Promise<void>,
  openRss: () => void,
) {
  const items: KtActionGroupItem[] = [
    iconAction('batch', '批量添加磁链', <CloudDownloadOutlined />, () => {
      void openBatch();
    }),
    iconAction('rss', '创建 RSS 订阅', <LinkOutlined />, openRss),
  ];
  return (
    <ACard class="media-governance-series-detail__hero">
      <div class="media-governance-series-detail__header">
        <div class="media-governance-series-detail__identity">
          <div>
            <h2 class="m-0 text-xl font-semibold">{detail.series.title}</h2>
            <ATag color="blue">
              {`${detail.series.canonicalProvider.toUpperCase()} · ${detail.series.canonicalProviderId}`}
            </ATag>
          </div>
          <p>
            {detail.series.originalTitle || '未记录原名'} ·{' '}
            {detail.series.releaseYear} 年 · {detail.seasons.length} 季 ·{' '}
            {detail.taskBindings.length} 条执行历史
          </p>
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
    <AKtCardList
      emptyDescription="当前系列没有季结构"
      itemCount={seasons.length}
    >
      {seasons.map((season) => {
        const selected = season.seasonNumber === selectedSeasonNumber;
        let cardClass = 'media-governance-season-card';
        let tagColor = 'default';
        if (selected) {
          cardClass = `${cardClass} media-governance-season-card--selected`;
          tagColor = 'blue';
        }
        const episodeEnd = season.episodeStart + season.episodeCount - 1;
        return (
          <ACard
            class={cardClass}
            hoverable
            key={season.id}
            onClick={() => selectSeason(season.seasonNumber)}
            onKeydown={(event: KeyboardEvent) => {
              if (event.target !== event.currentTarget) return;
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              selectSeason(season.seasonNumber);
            }}
            role="button"
            size="small"
            tabindex={0}
          >
            <div class="media-governance-season-card__content">
              <div class="media-governance-season-card__header">
                <div>
                  <strong>
                    S{String(season.seasonNumber).padStart(2, '0')} ·{' '}
                    {season.title}
                  </strong>
                  <span>
                    {season.releaseYear || '年份待定'} · E{season.episodeStart}
                    –E{episodeEnd} · Task {season.taskCount}
                  </span>
                </div>
                <ATag color={tagColor}>
                  {season.boundEpisodeCount}/{season.episodeCount}
                </ATag>
              </div>
              <AProgress
                percent={season.coveragePercent}
                showInfo={false}
                size="small"
              />
            </div>
          </ACard>
        );
      })}
    </AKtCardList>
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
    <div class="media-governance-series-overview">
      <section>
        <h3>资料引用</h3>
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
      </section>
      <section>
        <h3>层级统计</h3>
        {detail.seasons.map((season) => (
          <div class="media-governance-fact-row" key={season.id}>
            <span>S{String(season.seasonNumber).padStart(2, '0')}</span>
            <strong>{season.title}</strong>
            <span class="text-muted-foreground">
              E{season.episodeStart}–E
              {season.episodeStart + season.episodeCount - 1} ·{' '}
              {season.boundEpisodeCount}/{season.episodeCount} 集已绑定 · Task{' '}
              {season.taskCount}
            </span>
          </div>
        ))}
      </section>
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
  return (
    <div class="media-governance-episode-list">
      <AKtCardList
        emptyDescription="当前季没有 Episode"
        itemCount={episodes.length}
        variant="compact"
      >
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
      </AKtCardList>
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
