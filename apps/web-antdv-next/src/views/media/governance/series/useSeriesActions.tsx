import type { ComputedRef, Ref } from 'vue';

import type {
  MediaGovernanceRssDiscoveryPanelExposed,
  MediaGovernanceRssDiscoverySelection,
} from './RssDiscoveryPanel';
import type { SeriesWorkCreateModalExposed } from './SeriesWorkCreateModal';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { DeleteOutlined, PlusOutlined } from '@antdv-next/icons';
import {
  Button,
  Input,
  InputNumber,
  message,
  Spin,
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
} from '#/api/media-governance';

import RssDiscoveryPanel from './RssDiscoveryPanel';
import SeriesWorkCreateModal from './SeriesWorkCreateModal';

import './detail.scss';

const AButton = Button as any;
const AInput = Input as any;
const AInputNumber = InputNumber as any;
const ASpin = Spin as any;
const ATag = Tag as any;
const ATooltip = Tooltip as any;

interface SeriesActionContext {
  detail: Ref<MediaGovernanceApi.SeriesDetail | undefined>;
  seriesId: ComputedRef<string>;
  selectedWork: ComputedRef<MediaGovernanceApi.SeriesWork | undefined>;
  selectedSeason: ComputedRef<MediaGovernanceApi.SeasonCard | undefined>;
  selectedSeasonNumber: Ref<number | undefined>;
  loadDetail: () => Promise<void>;
  loadEpisodes: (pageNo: number) => Promise<void>;
  selectWork: (workId: string) => void;
  openTask: (taskId: string) => void;
}

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
 * 让资料库卡片与系列详情共用作品、季、任务、磁链和订阅的表单及提交校验。
 * @param context - 当前系列与选中作品、季，以及保存后的刷新和任务查看回调。
 * @returns 共享操作入口与弹窗渲染函数。
 */
export function useSeriesActions(context: SeriesActionContext) {
  const {
    detail,
    seriesId,
    selectedWork,
    selectedSeason,
    selectedSeasonNumber,
    loadDetail,
    loadEpisodes,
    selectWork,
    openTask,
  } = context;
  const batchRows = ref<BatchMagnetRow[]>([]);
  const batchResolvingEpisode = ref(false);
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
    const task = await createMediaGovernanceWorkTask(seriesId.value, work.id, {
      seasonNumbers,
    });
    message.success('已从当前作品创建执行任务');
    await loadDetail();
    openTask(task.id);
  }

  /**
   * 新 Work 保存后直接切换到服务端返回的最新 Work 并刷新详情。
   *
   * @param nextDetail - 新增 Work 后的完整 Series 详情。
   */
  function handleWorkSaved(nextDetail: MediaGovernanceApi.SeriesDetail) {
    const previousIds = new Set(detail.value?.works?.map((work) => work.id));
    detail.value = nextDetail;
    const created = nextDetail.works.find((work) => !previousIds.has(work.id));
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
    const pageCount = Math.ceil(season.episodeCount / MAGNET_EPISODE_PAGE_SIZE);
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
   * 在调用页面渲染共享表单，保持提交期间的作品与季上下文。
   * @returns 当前操作对应的 Vben 弹窗集合。
   */
  function renderModals() {
    let batchEpisodeStart = 1;
    let batchEpisodeCount = 0;
    if (selectedSeason.value) {
      batchEpisodeStart = selectedSeason.value.episodeStart;
      batchEpisodeCount = selectedSeason.value.episodeCount;
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
      <>
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
        <SeriesWorkCreateModal
          onSaved={handleWorkSaved}
          ref={workCreateModal}
        />
      </>
    );
  }
  return {
    createWorkTask,
    openBatch,
    openRss,
    openSeason,
    renderModals,
    openWork: () => workCreateModal.value?.openCreateWork(seriesId.value),
  };
}

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
