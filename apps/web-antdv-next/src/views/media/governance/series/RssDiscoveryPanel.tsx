import type { PropType, VNodeChild } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent, markRaw, nextTick, onMounted, ref } from 'vue';

import {
  CheckOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@antdv-next/icons';
import {
  Button,
  Card,
  Empty,
  InputSearch,
  Spin,
  Steps,
  Tag,
  Tooltip,
} from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import {
  discoverMediaGovernanceRssSources,
  getMediaGovernanceRssIdentityCandidates,
} from '#/api/media-governance';

import './RssDiscoveryPanel.scss';

const AButton = Button as any;
const ACard = Card as any;
const AEmpty = Empty as any;
const ASpin = Spin as any;
const ASteps = Steps as any;
const ATag = Tag as any;
const ATooltip = Tooltip as any;

const RSS_DISCOVERY_PROVIDER_LABELS: Record<
  MediaGovernanceApi.RssDiscoveryProvider,
  string
> = {
  'acg-rip': 'ACG.RIP',
  anibt: 'AniBT',
  'bangumi-moe': 'Bangumi.moe',
  dmhy: '动漫花园',
  mikan: 'Mikan',
  nekobt: 'nekoBT',
  nyaa: 'Nyaa',
  'shana-project': 'Shana Project',
  subsplease: 'SubsPlease',
};

const RSS_DISCOVERY_STEPS = [
  {
    content: '从 Bangumi/TMDB 候选中明确选择，未选择前不搜索来源',
    title: '确认作品身份',
  },
  {
    content: '同一 BTIH 跨站去重，单个来源失败不影响其他结果',
    title: '按发布组聚合来源',
  },
  {
    content: '订阅源由选择结果锁定，其他订阅参数仍可调整',
    title: '确认订阅参数',
  },
];

interface RssDiscoverySearchValues {
  keyword: string;
}

export interface MediaGovernanceRssDiscoverySelection {
  group: MediaGovernanceApi.RssDiscoveryGroup;
  identity: MediaGovernanceApi.RssIdentityCandidate;
  option: MediaGovernanceApi.RssDiscoverySubscriptionOption;
}

export interface MediaGovernanceRssDiscoveryPanelExposed {
  reset: (keyword?: string) => Promise<void>;
}

export default defineComponent({
  name: 'MediaGovernanceRssDiscoveryPanel',
  props: {
    initialKeyword: { default: '', type: String },
    onApply: {
      required: true,
      type: Function as PropType<
        (
          selection: MediaGovernanceRssDiscoverySelection,
        ) => Promise<void> | void
      >,
    },
    onInvalidate: {
      required: true,
      type: Function as PropType<() => Promise<void> | void>,
    },
    onFinalStepChange: {
      required: true,
      type: Function as PropType<(active: boolean) => Promise<void> | void>,
    },
    seasonNumber: { required: true, type: Number },
    seriesId: { required: true, type: String },
    workId: { required: true, type: String },
  },
  setup(props, { expose, slots }) {
    const identityLoading = ref(false);
    const identityError = ref<null | string>(null);
    const identityItems = ref<MediaGovernanceApi.RssIdentityCandidate[]>([]);
    const identityProviders = ref<
      MediaGovernanceApi.RssDiscoveryProviderStatus[]
    >([]);
    const selectedIdentity = ref<MediaGovernanceApi.RssIdentityCandidate>();
    const discoveryLoading = ref(false);
    const discoveryError = ref<null | string>(null);
    const discovery = ref<MediaGovernanceApi.RssDiscoveryResult>();
    const appliedOptionKey = ref<null | string>(null);
    const currentStep = ref(0);
    const maxUnlockedStep = ref(0);
    let requestSequence = 0;

    const [SearchForm, searchFormApi] = useVbenForm({
      layout: 'vertical',
      schema: [
        {
          component: markRaw(InputSearch),
          componentProps: () => ({
            allowClear: true,
            enterButton: <SearchOutlined aria-label="搜索身份" />,
            loading: identityLoading.value,
            maxlength: 120,
            onSearch: (
              _value: string,
              _event: Event | undefined,
              info?: { source?: string },
            ) => {
              if (info?.source === 'clear') return;
              void searchIdentities();
            },
            placeholder: '输入作品名或别名，先选择唯一资料身份',
          }),
          fieldName: 'keyword',
          label: '作品身份搜索',
          modelPropName: 'value',
          rules: z
            .string()
            .trim()
            .min(1, '请输入作品名或别名')
            .max(120, '搜索词最多 120 个字符'),
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });

    /**
     * 清空身份、来源和选中态，并恢复本次打开弹窗的建议关键词。
     *
     * @param keyword - 可选 Series 或 Season 标题。
     */
    async function reset(keyword = props.initialKeyword) {
      requestSequence += 1;
      await props.onInvalidate();
      await props.onFinalStepChange(false);
      identityLoading.value = false;
      identityError.value = null;
      identityItems.value = [];
      identityProviders.value = [];
      selectedIdentity.value = undefined;
      discoveryLoading.value = false;
      discoveryError.value = null;
      discovery.value = undefined;
      appliedOptionKey.value = null;
      currentStep.value = 0;
      maxUnlockedStep.value = 0;
      await searchFormApi.resetForm();
      await searchFormApi.setValues({
        keyword,
      } satisfies RssDiscoverySearchValues);
      await searchFormApi.resetValidate();
    }

    /**
     * 只查询资料身份候选并清空上一轮来源结果，绝不在用户选择身份前请求来源。
     */
    async function searchIdentities() {
      const { valid } = await searchFormApi.validate();
      if (!valid) return;
      const values = await searchFormApi.getValues<RssDiscoverySearchValues>();
      await props.onInvalidate();
      await props.onFinalStepChange(false);
      const sequence = ++requestSequence;
      identityLoading.value = true;
      identityError.value = null;
      identityItems.value = [];
      identityProviders.value = [];
      selectedIdentity.value = undefined;
      discovery.value = undefined;
      discoveryError.value = null;
      appliedOptionKey.value = null;
      currentStep.value = 0;
      maxUnlockedStep.value = 0;
      try {
        const result = await getMediaGovernanceRssIdentityCandidates(
          values.keyword.trim(),
        );
        if (sequence !== requestSequence) return;
        identityItems.value = result.items;
        identityProviders.value = result.providers;
        if (result.items.length === 0) {
          identityError.value = '没有找到可供用户确认的 TV 资料身份';
        }
      } catch {
        if (sequence !== requestSequence) return;
        identityError.value = '身份候选搜索失败，请稍后重试';
      } finally {
        if (sequence === requestSequence) identityLoading.value = false;
      }
    }

    /**
     * 记录用户明确选择的身份后才启动九个固定来源的并发查询。
     *
     * @param identity - 用户点击的 Bangumi 或 TMDB 候选。
     */
    async function selectIdentity(
      identity: MediaGovernanceApi.RssIdentityCandidate,
    ) {
      await props.onInvalidate();
      await props.onFinalStepChange(false);
      selectedIdentity.value = identity;
      appliedOptionKey.value = null;
      currentStep.value = 1;
      maxUnlockedStep.value = 1;
      await aggregateSources(identity);
    }

    /**
     * 保留已选身份并重新请求九个固定来源，刷新时清除旧 Feed 和第三步资格。
     */
    async function refreshSources() {
      const identity = selectedIdentity.value;
      if (!identity) return;
      await props.onInvalidate();
      await props.onFinalStepChange(false);
      appliedOptionKey.value = null;
      currentStep.value = 1;
      maxUnlockedStep.value = 1;
      await aggregateSources(identity);
    }

    /**
     * 按唯一身份执行一次可取消的来源聚合，并把单源失败保留在结果状态中。
     *
     * @param identity - 已由用户明确选择的资料身份。
     */
    async function aggregateSources(
      identity: MediaGovernanceApi.RssIdentityCandidate,
    ) {
      const sequence = ++requestSequence;
      discoveryLoading.value = true;
      discoveryError.value = null;
      discovery.value = undefined;
      const input: MediaGovernanceApi.RssDiscoverySearchInput = {
        provider: identity.provider,
        providerId: identity.providerId,
      };
      if (identity.releaseYear !== null)
        input.releaseYear = identity.releaseYear;
      try {
        const result = await discoverMediaGovernanceRssSources(
          props.seriesId,
          props.workId,
          props.seasonNumber,
          input,
        );
        if (sequence !== requestSequence) return;
        discovery.value = result;
        if (result.groups.length === 0) {
          discoveryError.value = '已核验身份，但当前活跃来源没有匹配发布组';
        }
      } catch {
        if (sequence !== requestSequence) return;
        discoveryError.value = '所选身份无法完成来源聚合，请重新选择身份';
      } finally {
        if (sequence === requestSequence) discoveryLoading.value = false;
      }
    }

    /**
     * 将用户选择的发布组和具体 RSS 来源交给父级回填现有订阅表单。
     *
     * @param group - 当前聚合发布组。
     * @param option - 该发布组下可直接订阅的来源。
     */
    async function applyOption(
      group: MediaGovernanceApi.RssDiscoveryGroup,
      option: MediaGovernanceApi.RssDiscoverySubscriptionOption,
    ) {
      const identity = selectedIdentity.value;
      if (!identity) return;
      await props.onApply({ group, identity, option });
      appliedOptionKey.value = `${group.groupId}:${option.provider}:${option.feedUrl}`;
      currentStep.value = 2;
      maxUnlockedStep.value = 2;
      await nextTick();
      await props.onFinalStepChange(true);
    }

    /**
     * 只允许切换到已解锁阶段，并让 Modal 确认按钮仅在最终阶段可用。
     *
     * @param nextStep - 用户点击的零开始 Steps 索引。
     */
    async function changeStep(nextStep: number) {
      if (nextStep < 0 || nextStep > maxUnlockedStep.value) return;
      currentStep.value = nextStep;
      const finalStepActive = nextStep === 2 && Boolean(appliedOptionKey.value);
      await props.onFinalStepChange(finalStepActive);
    }

    expose({ reset } satisfies MediaGovernanceRssDiscoveryPanelExposed);
    onMounted(() => void reset());

    return () => {
      let identityContent = null;
      if (identityLoading.value) {
        identityContent = (
          <div class="media-rss-discovery__loading">
            <ASpin size="small" />
            <span>正在查询资料身份候选…</span>
          </div>
        );
      } else if (identityItems.value.length > 0) {
        identityContent = renderIdentityCandidates(
          identityItems.value,
          selectedIdentity.value?.candidateId ?? null,
          selectIdentity,
        );
      } else if (identityError.value) {
        identityContent = <AEmpty description={identityError.value} />;
      }

      let discoveryContent = null;
      if (selectedIdentity.value) {
        if (discoveryLoading.value) {
          discoveryContent = (
            <div class="media-rss-discovery__loading media-rss-discovery__loading--sources">
              <ASpin size="small" />
              <span>身份已确认，正在聚合活跃来源并按发布组去重…</span>
            </div>
          );
        } else if (discovery.value) {
          discoveryContent = renderDiscoveryResult(
            discovery.value,
            appliedOptionKey.value,
            applyOption,
          );
        } else if (discoveryError.value) {
          discoveryContent = <AEmpty description={discoveryError.value} />;
        }
      }
      const parameterForm = slots.default?.();
      let stageContent: VNodeChild = (
        <section class="media-rss-discovery__step">
          <SearchForm />
          {renderProviderStatuses(identityProviders.value)}
          {identityContent}
        </section>
      );
      if (currentStep.value === 1) {
        stageContent = (
          <section class="media-rss-discovery__step">
            {renderDiscoveryToolbar(
              selectedIdentity.value,
              discoveryLoading.value,
              refreshSources,
            )}
            {discoveryContent}
          </section>
        );
      }
      if (currentStep.value === 2) {
        stageContent = null;
      }
      const stepItems = RSS_DISCOVERY_STEPS.map((item, index) => ({
        ...item,
        disabled: index > maxUnlockedStep.value,
      }));
      const parameterClasses = [
        'media-rss-discovery__step',
        'media-rss-discovery__parameters',
      ];
      if (currentStep.value !== 2) {
        parameterClasses.push('media-rss-discovery__parameters--hidden');
      }
      const parameterSection = (
        <section
          aria-hidden={currentStep.value !== 2}
          class={parameterClasses.join(' ')}
        >
          <div class="media-rss-discovery__parameter-form">{parameterForm}</div>
        </section>
      );

      return (
        <div class="media-rss-discovery">
          <ASteps
            class="media-rss-discovery__steps"
            current={currentStep.value}
            items={stepItems}
            onChange={(nextStep: number) => void changeStep(nextStep)}
            responsive
            size="small"
          />
          {stageContent}
          {parameterSection}
        </div>
      );
    };
  },
});

/**
 * 根据已确认身份显示唯一来源重跑入口，同时保证刷新不会重新触发身份搜索。
 *
 * @param identity - 当前已确认身份。
 * @param loading - 是否正在重新聚合来源。
 * @param refresh - 仅重跑来源聚合的回调。
 * @returns 第二阶段工具栏或 null。
 */
function renderDiscoveryToolbar(
  identity: MediaGovernanceApi.RssIdentityCandidate | undefined,
  loading: boolean,
  refresh: () => Promise<void>,
) {
  if (!identity) return null;
  return (
    <div class="media-rss-discovery__source-toolbar">
      <div>
        <strong>{identity.title}</strong>
        <span>
          {identity.provider.toUpperCase()} · {identity.providerId}
        </span>
      </div>
      <ATooltip title="重新搜索并聚合来源">
        <AButton
          aria-label="重新聚合来源"
          loading={loading}
          onClick={() => void refresh()}
          size="small"
          type="text"
        >
          <ReloadOutlined />
        </AButton>
      </ATooltip>
    </div>
  );
}

/**
 * 将 Bangumi/TMDB 身份证据投影为显式选择按钮，并保留来源、年份、集数和当前选择态。
 *
 * @param items - 身份候选。
 * @param selectedCandidateId - 当前已选择候选 ID。
 * @param select - 用户选择回调。
 * @returns 身份候选节点。
 */
function renderIdentityCandidates(
  items: MediaGovernanceApi.RssIdentityCandidate[],
  selectedCandidateId: null | string,
  select: (identity: MediaGovernanceApi.RssIdentityCandidate) => Promise<void>,
) {
  return (
    <div class="media-rss-discovery__identities">
      {items.map((identity) => {
        const classes = ['media-rss-discovery__identity'];
        const selected = selectedCandidateId === identity.candidateId;
        if (selected) classes.push('is-selected');
        let poster = null;
        if (identity.posterUrl) {
          poster = <img alt="" loading="lazy" src={identity.posterUrl} />;
        }
        let year = '年份未知';
        if (identity.releaseYear !== null) year = `${identity.releaseYear} 年`;
        let episodeCount = null;
        if (identity.episodeCount !== null) {
          episodeCount = <span>{identity.episodeCount} 集</span>;
        }
        return (
          <ACard
            aria-pressed={selected}
            class={classes.join(' ')}
            classes={{
              body: 'media-rss-discovery__identity-body',
            }}
            hoverable
            key={identity.candidateId}
            onClick={() => void select(identity)}
            onKeydown={(event: KeyboardEvent) => {
              if (![' ', 'Enter'].includes(event.key)) return;
              event.preventDefault();
              void select(identity);
            }}
            role="button"
            size="small"
            tabindex={0}
          >
            {poster}
            <span class="media-rss-discovery__identity-main">
              <strong>{identity.title}</strong>
              <small>{identity.originalTitle || '未记录原名'}</small>
              <span>
                <ATag color="blue">{identity.provider.toUpperCase()}</ATag>
                <span>{identity.providerId}</span>
                <span>{year}</span>
                {episodeCount}
              </span>
            </span>
            {renderSelectedMark(selected)}
          </ACard>
        );
      })}
    </div>
  );
}

/**
 * 仅为当前选中的身份或 Feed 追加确认图标，未选择项不保留占位节点。
 *
 * @param selected - 当前候选是否已选择。
 * @returns 选择图标或 null。
 */
function renderSelectedMark(selected: boolean) {
  if (!selected) return null;
  return (
    <span class="media-rss-discovery__selected-mark">
      <CheckOutlined />
    </span>
  );
}

/**
 * 渲染资料源或来源站独立状态，失败源保持可见但不阻断其他结果。
 *
 * @param statuses - API 返回的逐源状态。
 * @returns 状态标签行或 null。
 */
function renderProviderStatuses(
  statuses: MediaGovernanceApi.RssDiscoveryProviderStatus[],
) {
  if (statuses.length === 0) return null;
  return (
    <div class="media-rss-discovery__providers">
      {statuses.map((status) => {
        let color = 'red';
        let suffix = '不可用';
        if (status.status === 'available') {
          color = 'green';
          suffix = `${status.itemCount} 条`;
        }
        return (
          <ATag color={color} key={status.provider}>
            {status.label} · {suffix}
          </ATag>
        );
      })}
    </div>
  );
}

/**
 * 渲染多源状态和按发布组归并的订阅结果列表。
 *
 * @param result - 聚合来源结果。
 * @param appliedOptionKey - 已回填表单的选项键。
 * @param apply - 选择发布组 RSS 来源回调。
 * @returns 聚合结果节点。
 */
function renderDiscoveryResult(
  result: MediaGovernanceApi.RssDiscoveryResult,
  appliedOptionKey: null | string,
  apply: (
    group: MediaGovernanceApi.RssDiscoveryGroup,
    option: MediaGovernanceApi.RssDiscoverySubscriptionOption,
  ) => Promise<void>,
) {
  let groupContent = <AEmpty description="没有匹配发布组" />;
  if (result.groups.length > 0) {
    groupContent = (
      <div class="media-rss-discovery__groups">
        {result.groups.map((group) =>
          renderDiscoveryGroup(group, appliedOptionKey, apply),
        )}
      </div>
    );
  }
  return (
    <div class="media-rss-discovery__result">
      <div class="media-rss-discovery__result-summary">
        <strong>{result.groups.length} 个发布组</strong>
        <span>{result.totalUniqueItems} 条跨站去重结果</span>
        <span>身份：{result.identity.title}</span>
      </div>
      {renderProviderStatuses(result.providers)}
      {groupContent}
    </div>
  );
}

/**
 * 将发布组投影为可选择订阅行，真实统计、样例和无 Feed 原因在同一上下文展示。
 *
 * @param group - 单个发布组聚合结果。
 * @param appliedOptionKey - 已回填选项键。
 * @param apply - RSS 来源选择回调。
 * @returns 发布组列表行。
 */
function renderDiscoveryGroup(
  group: MediaGovernanceApi.RssDiscoveryGroup,
  appliedOptionKey: null | string,
  apply: (
    group: MediaGovernanceApi.RssDiscoveryGroup,
    option: MediaGovernanceApi.RssDiscoverySubscriptionOption,
  ) => Promise<void>,
) {
  let latest = '时间未知';
  if (group.latestPublishedAt)
    latest = formatDiscoveryTime(group.latestPublishedAt);
  let seeders = '活跃度未知';
  if (group.maxSeeders !== null) seeders = `最高 ${group.maxSeeders} 做种`;
  let options = (
    <span class="media-rss-discovery__no-feed">
      当前来源仅提供搜索证据，没有可直接回填的 RSS
    </span>
  );
  if (group.subscriptionOptions.length > 0) {
    options = (
      <div class="media-rss-discovery__feed-options">
        {group.subscriptionOptions.map((option) => {
          const key = `${group.groupId}:${option.provider}:${option.feedUrl}`;
          const classes = ['media-rss-discovery__feed-option'];
          if (key === appliedOptionKey) classes.push('is-applied');
          return (
            <AButton
              class={classes.join(' ')}
              key={key}
              onClick={() => void apply(group, option)}
              title={option.feedUrl}
              type="text"
            >
              <span>{option.label}</span>
              <small>{rssOptionMatchLabel(option.itemCount)}</small>
              {renderSelectedMark(key === appliedOptionKey)}
            </AButton>
          );
        })}
      </div>
    );
  }
  return (
    <section class="media-rss-discovery__group" key={group.groupId}>
      <header>
        <div>
          <strong>{group.releaseGroup}</strong>
          <span>
            {group.uniqueItemCount} 条 · {group.providerCount} 个来源 · {latest}{' '}
            · {seeders}
          </span>
        </div>
        <div>
          {group.providers.map((provider) => (
            <ATag key={provider}>{rssDiscoveryProviderLabel(provider)}</ATag>
          ))}
        </div>
      </header>
      <div class="media-rss-discovery__samples">
        {group.items.slice(0, 3).map((item) => (
          <div key={item.id} title={item.title}>
            <span>{item.title}</span>
            <small>
              {item.providers.map((source) => source.label).join(' · ')}
            </small>
          </div>
        ))}
      </div>
      {options}
    </section>
  );
}

/**
 * 把来源协议标识映射为用户可读站点名称。
 *
 * @param provider - 固定来源协议标识。
 * @returns 站点展示名称。
 */
function rssDiscoveryProviderLabel(
  provider: MediaGovernanceApi.RssDiscoveryProvider,
): string {
  return RSS_DISCOVERY_PROVIDER_LABELS[provider];
}

/**
 * 区分已有发布条目命中数与详情页直接提供但当前零条目的组级 RSS。
 *
 * @param itemCount - 当前搜索页命中条目数。
 * @returns 命中数量或“RSS 可用”提示。
 */
function rssOptionMatchLabel(itemCount: number): string {
  if (itemCount === 0) return 'RSS 可用';
  return `${itemCount} 条命中`;
}

/**
 * 把来源 ISO 时间格式化为本地短时间。
 *
 * @param value - API 返回的 ISO 时间。
 * @returns 中文本地日期时间。
 */
function formatDiscoveryTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}
