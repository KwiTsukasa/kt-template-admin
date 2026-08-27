import type { TableColumnType } from 'antdv-next';

import type { VNodeChild } from 'vue';

import type { MediaGovernanceTaskDrawerExposed } from '../tasks/components/MediaGovernanceTaskDrawer';
import type {
  MediaGovernanceRssDiscoveryPanelExposed,
  MediaGovernanceRssDiscoverySelection,
} from './RssDiscoveryPanel';
import type { SeriesWorkCreateModalExposed } from './SeriesWorkCreateModal';

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

import { Page, useVbenModal } from '@vben/common-ui';

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
  PlusOutlined,
  ReloadOutlined,
} from '@antdv-next/icons';
import {
  Button,
  Empty,
  Input,
  InputNumber,
  message,
  Pagination,
  Spin,
  Tabs,
  Tag,
  Tooltip,
} from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMediaGovernanceMagnetBatch,
  createMediaGovernanceRssSubscription,
  createMediaGovernanceSeason,
  createMediaGovernanceWorkTask,
  getMediaGovernanceEpisodes,
  getMediaGovernanceSeries,
  pollMediaGovernanceRssSubscription,
  setMediaGovernanceRssSubscriptionState,
} from '#/api/media-governance';
import { KtCardListCard } from '#/components/kt-card-list';
import { KtActionGroup, KtTable } from '#/components/kt-table';

import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';
import MediaGovernanceTaskDrawer from '../tasks/components/MediaGovernanceTaskDrawer';
import RssDiscoveryPanel from './RssDiscoveryPanel';
import SeriesWorkCreateModal from './SeriesWorkCreateModal';

import './detail.scss';

const AButton = Button as any;
const AEmpty = Empty as any;
const AInput = Input as any;
const AInputNumber = InputNumber as any;
const AKtCardListCard = KtCardListCard as any;
const AKtActionGroup = KtActionGroup as any;
const AKtTable = KtTable as any;
const APagination = Pagination as any;
const ASpin = Spin as any;
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

export interface BatchMagnetRow {
  episodeNumber: number | undefined;
  id: number;
  magnetUri: string;
}

export interface BatchMagnetValidationResult {
  error: null | string;
  items: MediaGovernanceApi.MagnetBatchCreateInput['items'];
}

interface BatchMagnetFormValues {
  contentKind: MediaGovernanceApi.ContentKind;
  releaseGroup: string;
}

interface RssSubscriptionFormValues {
  contentKind: MediaGovernanceApi.ContentKind;
  episodePattern: string;
  feedUrl: string;
  includePattern: string;
  name: string;
  pollIntervalMinutes: number;
  releaseGroup: string;
}

/**
 * 用当前 Work 标题和非泛化季标题生成身份搜索建议词，避免跨 Work 搜错作品。
 *
 * @param work - 当前选中的 TV Work。
 * @param season - 当前选择季。
 * @returns 最多 120 字符的建议搜索词。
 */
function buildRssDiscoveryKeyword(
  work: MediaGovernanceApi.SeriesWork,
  season: MediaGovernanceApi.SeasonCard | undefined,
): string {
  let keyword = work.title.trim();
  const seasonTitle = season?.title.trim() ?? '';
  if (
    seasonTitle &&
    !/^第\s*\d+\s*季$/u.test(seasonTitle) &&
    !keyword.includes(seasonTitle)
  ) {
    keyword = `${keyword} ${seasonTitle}`;
  }
  return keyword.slice(0, 120);
}

/**
 * 组合身份、发布组和来源名称，并收窄到订阅名称字段上限。
 *
 * @param selection - 用户从聚合结果选择的身份、发布组和 Feed。
 * @returns 最多 100 字符的订阅名称。
 */
function buildRssDiscoverySubscriptionName(
  selection: MediaGovernanceRssDiscoverySelection,
): string {
  return `${selection.identity.title} · ${selection.group.releaseGroup} · ${selection.option.label}`.slice(
    0,
    100,
  );
}

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
    const batchRows = ref<BatchMagnetRow[]>([]);
    const batchResolvingEpisode = ref(false);
    const taskDrawer = ref<MediaGovernanceTaskDrawerExposed>();
    const workCreateModal = ref<SeriesWorkCreateModalExposed>();
    const rssDiscoveryPanel = ref<MediaGovernanceRssDiscoveryPanelExposed>();
    const rssSelectedIdentity = ref<
      MediaGovernanceApi.RssIdentityCandidate | undefined
    >();
    const [BatchForm, batchFormApi] = useVbenForm({
      layout: 'vertical',
      schema: [
        {
          component: 'Input',
          componentProps: { allowClear: true, maxlength: 120 },
          defaultValue: 'LoliHouse',
          fieldName: 'releaseGroup',
          label: '发布组',
          rules: z
            .string()
            .trim()
            .max(120, '发布组最多 120 个字符')
            .optional()
            .or(z.literal('')),
        },
        {
          component: 'Select',
          componentProps: { options: CONTENT_KIND_OPTIONS },
          defaultValue: 'bundled_sidecar_media',
          fieldName: 'contentKind',
          label: '内容类型',
          rules: 'selectRequired',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1 sm:grid-cols-2',
    });
    const [RssForm, rssFormApi] = useVbenForm({
      layout: 'vertical',
      schema: [
        {
          component: 'Input',
          componentProps: { allowClear: true, maxlength: 100 },
          fieldName: 'name',
          label: '订阅名称',
          rules: z.string().trim().min(1, '请输入订阅名称').max(100),
        },
        {
          component: 'Input',
          componentProps: { allowClear: true, maxlength: 120 },
          fieldName: 'releaseGroup',
          label: '发布组',
          rules: z
            .string()
            .trim()
            .max(120, '发布组最多 120 个字符')
            .optional()
            .or(z.literal('')),
        },
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            disabled: true,
            maxlength: 2048,
            placeholder: 'https://example.com/feed.xml',
          },
          fieldName: 'feedUrl',
          formItemClass: 'col-span-1 sm:col-span-2',
          label: 'RSS 地址',
          rules: z
            .string()
            .trim()
            .min(1, '请输入 RSS 地址')
            .url('请输入完整 HTTP(S) 地址')
            .max(2048),
        },
        {
          component: 'Select',
          componentProps: { options: CONTENT_KIND_OPTIONS },
          defaultValue: 'bundled_sidecar_media',
          fieldName: 'contentKind',
          label: '内容类型',
          rules: 'selectRequired',
        },
        {
          component: 'InputNumber',
          componentProps: { max: 1440, min: 5, precision: 0 },
          defaultValue: 15,
          fieldName: 'pollIntervalMinutes',
          label: '轮询间隔（分钟）',
          rules: z.number().int().min(5).max(1440),
        },
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            maxlength: 500,
            placeholder: 'LoliHouse',
          },
          fieldName: 'includePattern',
          formItemClass: 'col-span-1 sm:col-span-2',
          label: '标题包含正则（可选）',
          rules: z.string().max(500).optional().or(z.literal('')),
        },
        {
          component: 'Input',
          componentProps: { allowClear: true, maxlength: 500 },
          fieldName: 'episodePattern',
          formItemClass: 'col-span-1 sm:col-span-2',
          help: String.raw`可使用命名组 (?<episode>\d+)；留空时识别“ - 27 [”和 E27。`,
          label: '集号正则（可选）',
          rules: z.string().max(500).optional().or(z.literal('')),
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1 sm:grid-cols-2',
    });
    const [SeasonForm, seasonFormApi] = useVbenForm({
      layout: 'vertical',
      schema: [
        {
          component: 'InputNumber',
          componentProps: { max: 99, min: 0, precision: 0 },
          fieldName: 'seasonNumber',
          label: '季号',
          rules: z.number().int().min(0).max(99),
        },
        {
          component: 'Input',
          componentProps: { maxlength: 200 },
          fieldName: 'title',
          label: '季标题',
          rules: z.string().trim().min(1).max(200),
        },
        {
          component: 'InputNumber',
          componentProps: { max: 2000, min: 1, precision: 0 },
          defaultValue: 1,
          fieldName: 'episodeStart',
          label: '起始集号',
          rules: z.number().int().min(1).max(2000),
        },
        {
          component: 'InputNumber',
          componentProps: { max: 2000, min: 1, precision: 0 },
          fieldName: 'episodeCount',
          label: '总集数',
          rules: z.number().int().min(1).max(2000),
        },
        {
          component: 'InputNumber',
          componentProps: {
            max: new Date().getFullYear() + 2,
            min: 1888,
            precision: 0,
          },
          fieldName: 'releaseYear',
          label: '首播年份（可选）',
          rules: z
            .number()
            .int()
            .min(1888)
            .max(new Date().getFullYear() + 2)
            .optional(),
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1 sm:grid-cols-2',
    });
    const [BatchModal, batchModalApi] = useVbenModal({
      class: 'w-[900px]',
      confirmText: '创建任务',
      fullscreenButton: false,
      /**
       * 确认批量磁链弹窗时校验显式集号行并创建一个多来源执行任务。
       */
      async onConfirm() {
        await submitBatch();
      },
      /**
       * 批量磁链 Modal 打开后重置已挂载的 VbenForm，避免首次打开前访问未挂载表单。
       *
       * @param isOpen - 通用 Modal 最新显隐状态。
       */
      onOpenChange(isOpen: boolean) {
        if (isOpen) void resetBatchForm();
      },
    });
    const batchModalOpen = batchModalApi.useStore((state) => !!state.isOpen);
    const [RssModal, rssModalApi] = useVbenModal({
      class: 'w-[1120px]',
      confirmDisabled: true,
      confirmText: '创建订阅',
      fullscreenButton: true,
      /**
       * 确认 RSS 弹窗时校验当前季订阅字段并创建后台轮询配置。
       */
      async onConfirm() {
        await submitRss();
      },
      /**
       * 每次创建订阅时清除上一轮字段并恢复内容类型与轮询间隔默认值。
       *
       * @param isOpen - 通用 Modal 最新显隐状态。
       */
      onOpenChange(isOpen: boolean) {
        if (isOpen) void resetRssForm();
      },
    });
    const [SeasonModal, seasonModalApi] = useVbenModal({
      confirmText: '创建季',
      /**
       * 校验当前 TV Work 的连续季集表单并提交创建。
       */
      async onConfirm() {
        await submitSeason();
      },
      /**
       * 只在 Modal 内容已挂载的打开态重置连续集区间，避免关闭态访问 Form API。
       * @param isOpen - 通用 Modal 最新显隐状态。
       */
      onOpenChange(isOpen) {
        if (isOpen) void resetSeasonForm();
      },
      title: '为 TV 作品添加季',
    });
    let batchRowSequence = 0;
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
     * 只触发当前 TV Work 的 VbenModal，表单值留到内容挂载回调再初始化。
     */
    function openSeason() {
      seasonModalApi.open();
    }

    /**
     * 把上一轮字段与校验清空，并将连续集起点稳定恢复为 E01。
     */
    async function resetSeasonForm() {
      await seasonFormApi.resetForm();
      await seasonFormApi.setValues({ episodeStart: 1 });
      await seasonFormApi.resetValidate();
    }

    /**
     * 将季事实提交到当前 TV Work，并切换到新季。
     */
    async function submitSeason() {
      const work = selectedWork.value;
      if (!work || work.workType !== 'tv') return;
      const { valid } = await seasonFormApi.validate();
      if (!valid) return;
      const values =
        await seasonFormApi.getValues<MediaGovernanceApi.SeasonCreateInput>();
      seasonModalApi.lock();
      try {
        detail.value = await createMediaGovernanceSeason(
          seriesId.value,
          work.id,
          values,
        );
        selectedSeasonNumber.value = values.seasonNumber;
        await seasonModalApi.close();
        await loadEpisodes(1);
      } finally {
        seasonModalApi.unlock();
      }
    }

    /**
     * 从当前 Work 派生不可变身份和季范围后创建一次执行 Task。
     */
    async function createWorkTask() {
      const work = selectedWork.value;
      if (!work) return;
      const seasonNumbers: number[] = [];
      if (work.workType === 'tv') {
        if (selectedSeasonNumber.value === undefined) {
          message.warning('请先为 TV 作品创建并选择季');
          return;
        }
        seasonNumbers.push(selectedSeasonNumber.value);
      }
      const task = await createMediaGovernanceWorkTask(
        seriesId.value,
        work.id,
        { seasonNumbers },
      );
      message.success('已从当前作品创建执行任务');
      await loadDetail();
      taskDrawer.value?.open(task.id);
    }

    /**
     * 新 Work 保存后直接切换到服务端返回的最新 Work 并刷新详情。
     *
     * @param nextDetail - 新增 Work 后的完整 Series 详情。
     */
    function handleWorkSaved(nextDetail: MediaGovernanceApi.SeriesDetail) {
      const previousIds = new Set(detail.value?.works?.map((work) => work.id));
      detail.value = nextDetail;
      const created = nextDetail.works.find(
        (work) => !previousIds.has(work.id),
      );
      if (created) selectWork(created.id);
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
      const workId = selectedWork.value?.id;
      if (!season || !workId) return undefined;
      const pageCount = Math.ceil(
        season.episodeCount / MAGNET_EPISODE_PAGE_SIZE,
      );
      for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
        const page = await getMediaGovernanceEpisodes(
          seriesId.value,
          workId,
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
     * 在批量磁链 Modal 已挂载后恢复默认发布组、内容类型和校验状态。
     */
    async function resetBatchForm() {
      await batchFormApi.resetForm();
      await batchFormApi.setValues({
        contentKind: 'bundled_sidecar_media',
        releaseGroup: 'LoliHouse',
      } satisfies BatchMagnetFormValues);
      await batchFormApi.resetValidate();
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
      batchResolvingEpisode.value = true;
      batchModalApi.setState({ confirmDisabled: true }).open();
      try {
        const episodeNumber = await resolveFirstUnboundEpisodeNumber();
        if (!batchModalOpen.value) return;
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
        if (batchModalOpen.value) {
          message.warning('未能自动定位首个未绑定集，请手动填写集号');
        }
      } finally {
        batchResolvingEpisode.value = false;
        batchModalApi.setState({ confirmDisabled: false });
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
      const workId = selectedWork.value?.id;
      if (!season || !workId) {
        message.error('请先选择季');
        return;
      }
      const { valid } = await batchFormApi.validate();
      if (!valid) return;
      const validation = validateBatchMagnetRows(
        batchRows.value,
        season.episodeStart,
        season.episodeCount,
      );
      if (validation.error) {
        message.error(validation.error);
        return;
      }
      const values = await batchFormApi.getValues<BatchMagnetFormValues>();
      batchModalApi.lock();
      try {
        await createMediaGovernanceMagnetBatch(
          seriesId.value,
          workId,
          season.seasonNumber,
          {
            contentKind: values.contentKind,
            items: validation.items,
            releaseGroup: values.releaseGroup.trim() || undefined,
          },
        );
        await batchModalApi.close();
        message.success(
          `已创建包含 ${validation.items.length} 个按集来源的执行任务`,
        );
        await loadDetail();
      } finally {
        batchModalApi.unlock();
      }
    }

    /**
     * 打开当前季 RSS 创建弹窗并清理上一次输入。
     */
    function openRss() {
      if (selectedSeasonNumber.value === undefined) {
        message.error('请先选择季');
        return;
      }
      rssModalApi.open();
    }

    /**
     * 在 RSS Modal 已挂载后恢复创建默认值并清除上一轮校验状态。
     */
    async function resetRssForm() {
      rssSelectedIdentity.value = undefined;
      await rssFormApi.resetForm();
      await rssFormApi.setValues({
        contentKind: 'bundled_sidecar_media',
        episodePattern: '',
        feedUrl: '',
        includePattern: '',
        name: '',
        pollIntervalMinutes: 15,
        releaseGroup: '',
      } satisfies RssSubscriptionFormValues);
      await rssFormApi.resetValidate();
      rssModalApi.setState({ confirmDisabled: true });
      let keyword = '';
      if (selectedWork.value) {
        keyword = buildRssDiscoveryKeyword(
          selectedWork.value,
          selectedSeason.value,
        );
      }
      await rssDiscoveryPanel.value?.reset(keyword);
    }

    /**
     * 身份或发布组选择失效时清空锁定订阅源及其派生字段，并重新禁用创建操作。
     */
    async function invalidateRssDiscoverySelection() {
      rssSelectedIdentity.value = undefined;
      rssModalApi.setState({ confirmDisabled: true });
      await rssFormApi.setValues({
        feedUrl: '',
        includePattern: '',
        name: '',
        releaseGroup: '',
      });
    }

    /**
     * 只在 Steps 最终订阅参数阶段启用创建按钮，回退后立即重新禁用。
     *
     * @param active - 当前是否位于已生成参数的第三步。
     */
    function setRssFinalStepActive(active: boolean) {
      let confirmDisabled = true;
      if (active) confirmDisabled = false;
      rssModalApi.setState({ confirmDisabled });
    }

    /**
     * 把用户选择的发布组和具体 Feed 回填到现有 RSS VbenForm，保留轮询与内容类型默认值。
     *
     * @param selection - 已选择的身份、发布组和可订阅来源。
     */
    async function applyRssDiscoverySelection(
      selection: MediaGovernanceRssDiscoverySelection,
    ) {
      rssSelectedIdentity.value = selection.identity;
      const name = buildRssDiscoverySubscriptionName(selection);
      await rssFormApi.setValues({
        feedUrl: selection.option.feedUrl,
        includePattern: selection.group.includePattern,
        name,
        releaseGroup: selection.group.releaseGroup,
      });
      await rssFormApi.resetValidate();
      message.success(
        `已回填 ${selection.group.releaseGroup} · ${selection.option.label}`,
      );
    }

    /**
     * 创建当前季 RSS 订阅并安排首次后台轮询。
     */
    async function submitRss() {
      const seasonNumber = selectedSeasonNumber.value;
      const workId = selectedWork.value?.id;
      if (seasonNumber === undefined || !workId) {
        message.error('请先选择季');
        return;
      }
      const { valid } = await rssFormApi.validate();
      if (!valid) return;
      const selectedIdentity = rssSelectedIdentity.value;
      if (!selectedIdentity) {
        message.error('请重新选择作品身份和订阅源');
        return;
      }
      const values = await rssFormApi.getValues<RssSubscriptionFormValues>();
      const identity: MediaGovernanceApi.RssSubscriptionCreateInput['identity'] =
        {
          provider: selectedIdentity.provider,
          providerId: selectedIdentity.providerId,
        };
      if (selectedIdentity.releaseYear !== null) {
        identity.releaseYear = selectedIdentity.releaseYear;
      }
      rssModalApi.lock();
      try {
        await createMediaGovernanceRssSubscription(
          seriesId.value,
          workId,
          seasonNumber,
          {
            contentKind: values.contentKind,
            episodePattern: values.episodePattern.trim() || undefined,
            feedUrl: values.feedUrl.trim(),
            identity,
            includePattern: values.includePattern.trim() || undefined,
            name: values.name.trim(),
            pollIntervalMinutes: values.pollIntervalMinutes,
            releaseGroup: values.releaseGroup.trim() || undefined,
          },
        );
        await rssModalApi.close();
        message.success('RSS 订阅已创建');
        await loadDetail();
      } finally {
        rssModalApi.unlock();
      }
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
      let batchEpisodeStart = 1;
      let batchEpisodeCount = 0;
      if (selectedSeason.value) {
        batchEpisodeStart = selectedSeason.value.episodeStart;
        batchEpisodeCount = selectedSeason.value.episodeCount;
      }
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
                  () => workCreateModal.value?.openCreateWork(seriesId.value),
                  () => void createWorkTask(),
                  openSeason,
                  openBatch,
                  openRss,
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
      let rssDiscovery = null;
      if (
        detail.value &&
        selectedWork.value &&
        selectedSeasonNumber.value !== undefined
      ) {
        rssDiscovery = (
          <RssDiscoveryPanel
            initialKeyword={buildRssDiscoveryKeyword(
              selectedWork.value,
              selectedSeason.value,
            )}
            onApply={applyRssDiscoverySelection}
            onFinalStepChange={setRssFinalStepActive}
            onInvalidate={invalidateRssDiscoverySelection}
            ref={rssDiscoveryPanel}
            seasonNumber={selectedSeasonNumber.value}
            seriesId={seriesId.value}
            workId={selectedWork.value.id}
          >
            <div class="media-governance-rss-form-heading">
              <strong>订阅参数</strong>
              <span>RSS 地址由聚合结果锁定，其他参数可以继续调整。</span>
            </div>
            <RssForm />
          </RssDiscoveryPanel>
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
          <BatchModal title="批量添加按集磁链">
            <BatchForm />
            {renderBatchMagnetEditor(
              batchRows.value,
              batchEpisodeStart,
              batchEpisodeCount,
              batchResolvingEpisode.value,
              addBatchRow,
              removeBatchRow,
            )}
          </BatchModal>
          <RssModal title="创建 RSS 订阅">{rssDiscovery}</RssModal>
          <SeasonModal>
            <SeasonForm />
          </SeasonModal>
          <MediaGovernanceTaskDrawer
            onChanged={() => void loadDetail()}
            ref={taskDrawer}
          />
          <SeriesWorkCreateModal
            onSaved={handleWorkSaved}
            ref={workCreateModal}
          />
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
                  visibleCount={2}
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
