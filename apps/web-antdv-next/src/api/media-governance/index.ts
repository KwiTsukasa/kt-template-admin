import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

const RSS_DISCOVERY_REQUEST_TIMEOUT_MS = 30_000;

export namespace MediaGovernanceApi {
  export type ContentKind =
    | 'bundled_sidecar_media'
    | 'burned_in_subtitle_media'
    | 'embedded_subtitle_media'
    | 'sidecar_subtitle_package'
    | 'subtitleless_media';
  export type GovernanceProfile =
    | 'embedded'
    | 'sidecar-bundled'
    | 'sidecar-linked';
  export type MediaType = 'movie' | 'theatrical' | 'tv';
  export type Provider = 'bangumi' | 'tmdb' | 'tvdb';
  export type RunState =
    | 'blocked'
    | 'draft'
    | 'queued'
    | 'running'
    | 'succeeded';
  export type SourceRole = 'primary_media' | 'supplemental_subtitle';
  export type SelectedFileRole = 'font' | 'subtitle' | 'video';
  export type SubtitleLanguage = 'en' | 'ja' | 'zh-CN' | 'zh-TW';
  export type Stage =
    | 'acceptance'
    | 'closed'
    | 'download'
    | 'governance'
    | 'intake';

  export interface ProviderRef {
    provider: Provider;
    providerId: string;
  }

  export interface TaskUnit {
    evidenceSha256: null | string;
    expectedEpisodeNumbers: number[];
    id: string;
    localAcceptedAt: null | string;
    seasonNumber: null | string;
    subtitleContract: null | SubtitleContract;
    unitKind: 'movie' | 'season';
  }

  export interface SubtitleContract {
    expectedEpisodeNumbers: number[];
    mappings: Array<{
      episodeNumber: number;
      relativePath: string;
      sourceId?: string;
    }>;
    releaseGroup: string;
    sourceId: string;
    sourceIds?: string[];
  }

  export interface Source {
    contentKind: ContentKind;
    descriptorObjectId: string;
    descriptorSha256: string;
    id: string;
    infoHash: string;
    manifest: Array<{
      executable: boolean;
      index: number;
      relativePath: string;
      sizeBytes: number;
    }>;
    manifestSha256: null | string;
    manifestState: 'inspected' | 'pending-inspection';
    releaseGroup: null | string;
    seasonNumbers: string[];
    selectedBytes: number;
    selectedFileCount: number;
    selectedFileIndices: number[];
    selectedFileMappings: SelectedFileMapping[];
    sourceHealth:
      | 'degraded'
      | 'inconclusive'
      | 'probing'
      | 'unavailable'
      | 'unchecked'
      | 'viable';
    sourceHealthLabel: string;
    sourceHealthReasonLabel: string;
    sourceRole: SourceRole;
    transportKind: 'magnet' | 'torrent';
  }

  export interface SelectedFileMapping {
    episodeNumber: null | number;
    fileRole: SelectedFileRole;
    index: number;
    language: null | SubtitleLanguage;
    unitId: string;
  }

  export interface SemanticProjection {
    currentActionLabel: string;
    discardAllowed: boolean;
    discardReasonLabel: null | string;
    gateReasonLabel: string;
    runStateLabel: string;
    sourceHealthLabel: string;
    stageLabel: string;
  }

  export interface Progress {
    completedBytes: number;
    completedItems: number;
    etaLabel: string;
    heartbeatLabel: string;
    observedAt?: null | string;
    percent: number;
    progressLabel: string;
    speedLabel: string;
    totalBytes: number;
    totalItems: number;
  }

  export interface TaskIdentityPreview {
    mediaTypeLabel: string;
    providerLabel: string;
    releaseYearLabel: string;
    seasonLabel: string;
    status: 'pending-provider-verification' | 'verified-provider-identity';
    statusLabel: string;
    title: string;
  }

  export interface Task {
    activeRunId: null | string;
    closedAt: null | string;
    closedMode: 'automatic' | 'bounded_repair' | 'mechanical' | null;
    gateReason: null | string;
    governanceProfile: GovernanceProfile | null;
    id: string;
    identityPreview: TaskIdentityPreview;
    mediaType: MediaType;
    metadataIdentity: null | (ProviderRef & { releaseYear: null | number });
    nextCommandLabel: string;
    operationKind:
      | 'legacy-pipeline'
      | 'magnet-batch'
      | 'rss-intake'
      | 'rss-intake-auto'
      | 'source-intake'
      | null;
    payloadSeal: null | Record<string, unknown>;
    persistenceMode: 'database' | 'process-simulator';
    progress: Progress;
    providerRef: null | ProviderRef;
    releaseYear: null | number;
    revision: number;
    runState: RunState;
    semanticProjection: SemanticProjection;
    sealedPlan: null | Record<string, unknown>;
    sealedPlanSha256: null | string;
    seriesId: null | string;
    sources: Source[];
    stage: Stage;
    titleHint: string;
    units: TaskUnit[];
    workId: null | string;
    workItemId: null | string;
  }

  export interface TaskPageQuery extends Recordable<any> {
    gateReason?: string;
    governanceProfile?: GovernanceProfile;
    keyword?: string;
    pageNo?: number;
    pageSize?: number;
    runState?: RunState;
    stage?: Stage;
  }

  export interface TaskPage {
    items: Task[];
    total: number;
  }

  export interface TaskDiscardResult {
    clearedWorkItemId: null | string;
    deletedTaskId: string;
  }

  export interface Summary {
    attentionRequired: number;
    blocked: number;
    closed: number;
    downloading: number;
    evidenceDriftCount: number;
    governing: number;
    healthLabel: string;
    mechanicalClosureRate: number;
    mixedSubtitleSeasonCount: number;
    stagingResidualCount: null | number;
    stuckRunCount: number;
    total: number;
  }

  export interface SourceClassificationInput {
    contentKind: ContentKind;
    expectedRevision: number;
    releaseGroup?: string;
    seasonNumbers?: string[];
    sourceRole: SourceRole;
  }

  export interface SourceSelectionInput {
    expectedRevision: number;
    fileMappings: Array<{
      episodeNumber?: number;
      fileRole: SelectedFileRole;
      index: number;
      language?: SubtitleLanguage;
      unitId: string;
    }>;
    selectedFileIndices: number[];
  }

  export interface MagnetSourceInput extends SourceClassificationInput {
    magnetUri: string;
  }

  export interface SubtitleContractInput {
    expectedEpisodeNumbers: number[];
    expectedRevision: number;
    mappings: Array<{ episodeNumber: number; relativePath: string }>;
    releaseGroup: string;
    sourceId: string;
  }

  export interface Evidence {
    descriptorCount: number;
    eventProjection: string;
    localAcceptedUnitCount: number;
    acceptanceStatusLabel: string;
    taskId: string;
    writeBoundaries: Record<string, number>;
  }

  export interface TaskChangedEvent {
    changeType: 'created' | 'deleted' | 'source-updated' | 'state-updated';
    observedAt: string;
    patchMode: 'full' | 'progress';
    revision: number;
    runId: null | string;
    runSequence: null | number;
    summary: Summary;
    task:
      | null
      | (Partial<Omit<Task, 'payloadSeal' | 'sealedPlan'>> &
          Pick<Task, 'id' | 'revision'>);
    taskId: string;
    updatedAt: string;
  }

  export interface CatalogChangedEvent {
    changeType: 'created' | 'deleted' | 'updated';
    observedAt: string;
    revision: number;
    series: null | SeriesCard;
    seriesId: string;
    taskId: null | string;
    taskIds: string[];
    updatedAt: string;
  }

  export interface Series {
    canonicalNamespace?: 'movie' | 'subject' | 'tv';
    canonicalProvider: Provider;
    canonicalProviderId: string;
    createTime: string;
    id: string;
    mediaType: MediaType;
    originalTitle: null | string;
    primaryWorkId: null | string;
    releaseYear: number;
    revision: number;
    status: 'active';
    title: string;
    updateTime: string;
  }

  export interface SeriesCard extends Series {
    bindingCount: number;
    boundEpisodeCount: number;
    coveragePercent: number;
    episodeCount: number;
    rssCount: number;
    rssTotalCount: number;
    seasonCount: number;
    seasonSummaries: SeasonCard[];
    taskCount: number;
    workCount: number;
  }

  export interface WorkExternalRef {
    id: string;
    provider: Provider;
    providerId: string;
    providerNamespace: 'movie' | 'subject' | 'tv';
    referenceRole: 'canonical' | 'catalog-evidence';
    releaseYear: null | number;
    title: null | string;
    workId: string;
  }

  export interface SeriesWork {
    canonicalNamespace: 'movie' | 'subject' | 'tv';
    canonicalProvider: Provider;
    canonicalProviderId: string;
    id: string;
    isPrimary: boolean;
    originalTitle: null | string;
    references: WorkExternalRef[];
    releaseYear: number;
    revision: number;
    seasonCount: number;
    seasons: SeasonCard[];
    seriesId: string;
    status: 'active';
    taskCount: number;
    title: string;
    workType: MediaType;
  }

  export interface SeasonCard {
    bindingCount: number;
    boundEpisodeCount: number;
    coveragePercent: number;
    episodeCount: number;
    episodeStart: number;
    id: string;
    releaseYear: null | number;
    seasonNumber: number;
    seriesId: string;
    status: string;
    statusCounts: Record<string, number>;
    taskCount: number;
    title: string;
    workId: null | string;
  }

  export type HistoricalClassificationStatus =
    | 'classifiable'
    | 'classified'
    | 'not-applicable'
    | 'pending';

  export interface HistoricalClassificationTarget {
    canonicalProvider: Provider;
    canonicalProviderId: string;
    matchRole: 'canonical' | 'catalog-binding' | 'external-ref';
    releaseYear: number;
    seasons: Array<{
      canonicalEpisodeCount: number;
      canonicalEpisodeStart: number;
      episodeCount: number;
      episodeRanges: Array<{ end: number; start: number }>;
      existingBindingCount: number;
      missingBindingCount: number;
      seasonNumber: number;
    }>;
    seriesId: string;
    title: string;
  }

  export interface HistoricalClassificationItem {
    existingBindingCount: number;
    mediaType: MediaType;
    metadataIdentity: null | ProviderRef;
    reasonCode: string;
    reasonLabel: string;
    status: HistoricalClassificationStatus;
    target: HistoricalClassificationTarget | null;
    taskId: string;
    title: string;
  }

  export interface HistoricalClassificationReport {
    items: HistoricalClassificationItem[];
    summary: {
      classifiable: number;
      classified: number;
      notApplicable: number;
      pending: number;
      total: number;
    };
  }

  export interface SeriesExternalRef {
    id: string;
    provider: Provider;
    providerId: string;
    referenceRole: 'canonical' | 'catalog-evidence';
    releaseYear: null | number;
    seriesId: string;
    title: null | string;
  }

  export interface SeriesTaskBinding {
    bindingRole: string;
    operationKind: Task['operationKind'];
    seasons: Array<{
      episodeRanges: Array<{ end: number; start: number }>;
      seasonNumber: number;
    }>;
    taskId: string;
    workId: null | string;
  }

  export interface RssSubscription {
    contentKind: ContentKind;
    enabled: boolean;
    episodePattern: null | string;
    feedUrl: string;
    id: string;
    includePattern: null | string;
    lastError: null | string;
    lastPolledAt: null | string;
    name: string;
    nextPollAt: null | string;
    pollIntervalMinutes: number;
    releaseGroup: null | string;
    revision: number;
    seasonId: string;
    seasonNumber: number;
    seriesId: string;
    status: 'disabled' | 'error' | 'idle' | 'polling';
  }

  export interface SeriesDetail {
    references: SeriesExternalRef[];
    rssSubscriptions: RssSubscription[];
    seasons: SeasonCard[];
    series: Series;
    taskBindings: SeriesTaskBinding[];
    works: SeriesWork[];
  }

  export interface SeriesDeleteResult {
    deleted: true;
    revision: number;
    seriesId: string;
  }

  export interface SeriesOrWorkCreateInput {
    identity: {
      provider: RssIdentityProvider;
      providerId: string;
      releaseYear?: number;
    };
    workType: MediaType;
  }

  export interface SeasonCreateInput {
    episodeCount: number;
    episodeStart?: number;
    releaseYear?: number;
    seasonNumber: number;
    title: string;
  }

  export interface WorkTaskCreateInput {
    seasonNumbers?: number[];
  }

  export interface SeriesPageQuery extends Recordable<any> {
    keyword?: string;
    pageNo?: number;
    pageSize?: number;
  }

  export interface SeriesPage {
    items: SeriesCard[];
    total: number;
  }

  export interface Episode {
    bindings: Array<{
      bindingRole: string;
      sourceId: null | string;
      taskId: string;
    }>;
    episodeNumber: number;
    id: string;
    seasonId: string;
    seasonNumber: number;
    seriesId: string;
    status: 'completed' | 'downloading' | 'known' | 'queued';
    title: null | string;
  }

  export interface MagnetBatchCreateInput {
    contentKind: ContentKind;
    items: Array<{ episodeNumber: number; magnetUri: string }>;
    releaseGroup?: string;
  }

  export interface MagnetBatchResult {
    bindings: Array<{
      bindingRole: string;
      episodeId: string;
      sourceId: string;
      taskId: string;
    }>;
    sources: Source[];
    task: Task;
  }

  export interface RssSubscriptionCreateInput {
    contentKind: ContentKind;
    episodePattern?: string;
    feedUrl: string;
    identity: {
      provider: RssIdentityProvider;
      providerId: string;
      releaseYear?: number;
    };
    includePattern?: string;
    name: string;
    pollIntervalMinutes?: number;
    releaseGroup?: string;
  }

  export type RssIdentityProvider = 'bangumi' | 'tmdb';

  export type RssDiscoveryProvider =
    | 'acg-rip'
    | 'anibt'
    | 'bangumi-moe'
    | 'dmhy'
    | 'mikan'
    | 'nekobt'
    | 'nyaa'
    | 'shana-project'
    | 'subsplease';

  export interface RssIdentityCandidate {
    candidateId: string;
    episodeCount: null | number;
    originalTitle: null | string;
    posterUrl: null | string;
    provider: RssIdentityProvider;
    providerId: string;
    releaseYear: null | number;
    title: string;
  }

  export interface RssDiscoveryProviderStatus {
    errorCode: null | string;
    itemCount: number;
    label: string;
    provider: RssDiscoveryProvider | RssIdentityProvider;
    rssCapable: boolean;
    status: 'available' | 'unavailable';
  }

  export interface RssIdentitySearchResult {
    items: RssIdentityCandidate[];
    providers: RssDiscoveryProviderStatus[];
  }

  export interface RssDiscoverySourceRef {
    detailUrl: null | string;
    feedUrl: null | string;
    label: string;
    magnetUri: null | string;
    provider: RssDiscoveryProvider;
    torrentUrl: null | string;
  }

  export interface RssDiscoveryItem {
    id: string;
    infoHash: null | string;
    providers: RssDiscoverySourceRef[];
    publishedAt: null | string;
    releaseGroup: string;
    seeders: null | number;
    sizeBytes: null | number;
    title: string;
  }

  export interface RssDiscoverySubscriptionOption {
    feedUrl: string;
    itemCount: number;
    label: string;
    provider: RssDiscoveryProvider;
  }

  export interface RssDiscoveryGroup {
    groupId: string;
    includePattern: string;
    items: RssDiscoveryItem[];
    latestPublishedAt: null | string;
    maxSeeders: null | number;
    providerCount: number;
    providers: RssDiscoveryProvider[];
    releaseGroup: string;
    subscriptionOptions: RssDiscoverySubscriptionOption[];
    uniqueItemCount: number;
  }

  export interface RssDiscoveryResult {
    groups: RssDiscoveryGroup[];
    identity: RssIdentityCandidate;
    providers: RssDiscoveryProviderStatus[];
    queriedAt: string;
    totalUniqueItems: number;
  }

  export interface RssDiscoverySearchInput {
    provider: RssIdentityProvider;
    providerId: string;
    releaseYear?: number;
  }

  export interface RssPollResult {
    createdTasks: number;
    discovered: number;
    ignored: number;
    queued: number;
  }
}

/**
 * 分页读取 canonical 媒体系列卡片。
 *
 * @param params - 页码、页大小和可选关键词。
 * @returns 系列卡片分页。
 */
export function getMediaGovernanceSeriesPage(
  params: MediaGovernanceApi.SeriesPageQuery,
) {
  return requestClient.get<MediaGovernanceApi.SeriesPage>(
    '/media-governance/series/page',
    { params },
  );
}

/**
 * 按关键词和 Work 类型搜索 Series/Work 创建身份候选。
 *
 * @param keyword - 用户输入的作品标题或别名。
 * @param workType - TV、电影或剧场版 Work 类型。
 * @returns Bangumi/TMDB 候选与来源状态。
 */
export function getMediaGovernanceCatalogIdentityCandidates(
  keyword: string,
  workType: MediaGovernanceApi.MediaType,
) {
  return requestClient.get<MediaGovernanceApi.RssIdentitySearchResult>(
    '/media-governance/series/identity-candidates',
    { params: { keyword, workType } },
  );
}

/**
 * 向唯一 Series 根写接口提交候选身份，让服务端二次核验并原子生成主 Work。
 *
 * @param input - 主 Work 类型与身份。
 * @returns 新 Series 完整详情。
 */
export function createMediaGovernanceSeries(
  input: MediaGovernanceApi.SeriesOrWorkCreateInput,
) {
  return requestClient.post<MediaGovernanceApi.SeriesDetail>(
    '/media-governance/series',
    input,
  );
}

/**
 * 按客户端卡片 revision 删除不含季、集、任务或 RSS 的 Series 空壳。
 *
 * @param seriesId - 待删除的 canonical Series 标识。
 * @param expectedRevision - 卡片读取到的当前 revision。
 * @returns 被删除的 Series 身份与递增 revision。
 */
export function deleteMediaGovernanceSeries(
  seriesId: string,
  expectedRevision: number,
) {
  return requestClient.delete<MediaGovernanceApi.SeriesDeleteResult>(
    `/media-governance/series/${seriesId}`,
    { params: { expectedRevision } },
  );
}

/**
 * 把候选身份提交到指定 Series 的 Work 集合，服务端核验成功前不接受客户端标题事实。
 *
 * @param seriesId - 目标 Series 标识。
 * @param input - Work 类型与身份。
 * @returns 更新后的 Series 详情。
 */
export function createMediaGovernanceWork(
  seriesId: string,
  input: MediaGovernanceApi.SeriesOrWorkCreateInput,
) {
  return requestClient.post<MediaGovernanceApi.SeriesDetail>(
    `/media-governance/series/${seriesId}/works`,
    input,
  );
}

/**
 * 在 Series/Work 双重路径所有权下提交连续季集事实，独立电影 Work 会由服务端拒绝。
 *
 * @param seriesId - Work 所属 Series。
 * @param workId - 目标 TV Work。
 * @param input - 季号、标题和连续集范围。
 * @returns 更新后的 Series 详情。
 */
export function createMediaGovernanceSeason(
  seriesId: string,
  workId: string,
  input: MediaGovernanceApi.SeasonCreateInput,
) {
  return requestClient.post<MediaGovernanceApi.SeriesDetail>(
    `/media-governance/series/${seriesId}/works/${workId}/seasons`,
    input,
  );
}

/**
 * 从既有 Work 创建一次 source-intake 执行 Task。
 *
 * @param seriesId - Task 所属 Series。
 * @param workId - Task 所属 Work。
 * @param input - TV Work 的已有季号集合。
 * @returns 新执行 Task。
 */
export function createMediaGovernanceWorkTask(
  seriesId: string,
  workId: string,
  input: MediaGovernanceApi.WorkTaskCreateInput,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/series/${seriesId}/works/${workId}/tasks`,
    input,
  );
}

/**
 * 读取全部历史 Task 的系列归类状态和确定性原因，不触发任何目录或 Task 写入。
 *
 * @returns 历史任务分类统计与逐项归类证据。
 */
export function getMediaGovernanceSeriesHistoryClassification() {
  return requestClient.get<MediaGovernanceApi.HistoricalClassificationReport>(
    '/media-governance/series/history-classification',
  );
}

/**
 * 读取一个 canonical 系列的季、引用、任务覆盖与 RSS 订阅。
 *
 * @param seriesId - canonical 系列标识。
 * @returns 系列详情。
 */
export function getMediaGovernanceSeries(seriesId: string) {
  return requestClient.get<MediaGovernanceApi.SeriesDetail>(
    `/media-governance/series/${seriesId}`,
  );
}

/**
 * 分页读取一季 Episode 与当前任务来源绑定。
 *
 * @param seriesId - canonical 系列标识。
 * @param workId - canonical Work 标识。
 * @param seasonNumber - canonical 季号。
 * @param params - 页码和页大小。
 * @param params.pageNo - 目标页码。
 * @param params.pageSize - 每页 Episode 数量。
 * @returns Episode 分页。
 */
export function getMediaGovernanceEpisodes(
  seriesId: string,
  workId: string,
  seasonNumber: number,
  params: { pageNo?: number; pageSize?: number },
) {
  let endpoint = `/media-governance/series/${seriesId}/works/${workId}/seasons/${seasonNumber}/episodes`;
  if (workId.startsWith('legacy-primary:')) {
    endpoint = `/media-governance/series/${seriesId}/seasons/${seasonNumber}/episodes`;
  }
  return requestClient.get<{
    items: MediaGovernanceApi.Episode[];
    total: number;
  }>(endpoint, { params });
}

/**
 * 在一个 Task 中按集添加最多十六条独立磁链来源。
 *
 * @param seriesId - canonical 系列标识。
 * @param workId - canonical Work 标识。
 * @param seasonNumber - canonical 季号。
 * @param input - 统一分类、发布组和逐集磁链。
 * @returns 新 Task、来源与集绑定。
 */
export function createMediaGovernanceMagnetBatch(
  seriesId: string,
  workId: string,
  seasonNumber: number,
  input: MediaGovernanceApi.MagnetBatchCreateInput,
) {
  return requestClient.post<MediaGovernanceApi.MagnetBatchResult>(
    `/media-governance/series/${seriesId}/works/${workId}/seasons/${seasonNumber}/magnet-batch`,
    input,
  );
}

/**
 * 按用户输入并行搜索 Bangumi 与 TMDB 的 TV 身份候选。
 *
 * @param keyword - 作品标题或别名。
 * @returns 身份候选及资料源独立状态。
 */
export function getMediaGovernanceRssIdentityCandidates(keyword: string) {
  return requestClient.get<MediaGovernanceApi.RssIdentitySearchResult>(
    '/media-governance/series/rss-discovery/identity-candidates',
    {
      params: { keyword },
      timeout: RSS_DISCOVERY_REQUEST_TIMEOUT_MS,
    },
  );
}

/**
 * 根据用户明确选择的身份聚合当前季固定来源，并按发布组返回订阅入口。
 *
 * @param seriesId - canonical 系列标识。
 * @param workId - canonical Work 标识。
 * @param seasonNumber - canonical 季号。
 * @param input - 已选择的资料源、编号和可选年份。
 * @returns 跨站去重的发布组、来源状态和 RSS 选项。
 */
export function discoverMediaGovernanceRssSources(
  seriesId: string,
  workId: string,
  seasonNumber: number,
  input: MediaGovernanceApi.RssDiscoverySearchInput,
) {
  return requestClient.post<MediaGovernanceApi.RssDiscoveryResult>(
    `/media-governance/series/${seriesId}/works/${workId}/seasons/${seasonNumber}/rss-discovery/search`,
    input,
    { timeout: RSS_DISCOVERY_REQUEST_TIMEOUT_MS },
  );
}

/**
 * 把地址、过滤和集号规则绑定到指定 canonical 季，并安排首次后台轮询。
 *
 * @param seriesId - canonical 系列标识。
 * @param workId - canonical Work 标识。
 * @param seasonNumber - canonical 季号。
 * @param input - 订阅地址、过滤、集号正则和来源分类。
 * @returns 新订阅。
 */
export function createMediaGovernanceRssSubscription(
  seriesId: string,
  workId: string,
  seasonNumber: number,
  input: MediaGovernanceApi.RssSubscriptionCreateInput,
) {
  return requestClient.post<MediaGovernanceApi.RssSubscription>(
    `/media-governance/series/${seriesId}/works/${workId}/seasons/${seasonNumber}/rss-subscriptions`,
    input,
  );
}

/**
 * 通过 revision 绑定的状态接口启停订阅，避免旧页面覆盖最新轮询状态。
 *
 * @param subscriptionId - RSS 订阅标识。
 * @param expectedRevision - 当前订阅 revision。
 * @param enabled - 目标启用状态。
 * @returns 更新后的订阅。
 */
export function setMediaGovernanceRssSubscriptionState(
  subscriptionId: string,
  expectedRevision: number,
  enabled: boolean,
) {
  return requestClient.put<MediaGovernanceApi.RssSubscription>(
    `/media-governance/series/rss-subscriptions/${subscriptionId}/state`,
    { enabled, expectedRevision },
  );
}

/**
 * 立即轮询一个 RSS 订阅并返回入队摘要。
 *
 * @param subscriptionId - RSS 订阅标识。
 * @returns 本轮发现、忽略、入队和新 Task 数量。
 */
export function pollMediaGovernanceRssSubscription(subscriptionId: string) {
  return requestClient.post<MediaGovernanceApi.RssPollResult>(
    `/media-governance/series/rss-subscriptions/${subscriptionId}/poll`,
  );
}

/**
 * 分页读取 RSS 条目解析与 Task 入队历史。
 *
 * @param subscriptionId - RSS 订阅标识。
 * @param params - 页码和页大小。
 * @param params.pageNo - 目标页码。
 * @param params.pageSize - 每页 RSS 条目数量。
 * @returns RSS 条目分页。
 */
export function getMediaGovernanceRssItems(
  subscriptionId: string,
  params: { pageNo?: number; pageSize?: number },
) {
  return requestClient.get<{
    items: Array<Record<string, unknown>>;
    total: number;
  }>(`/media-governance/series/rss-subscriptions/${subscriptionId}/items`, {
    params,
  });
}

/**
 * 根据筛选与分页参数读取媒体治理任务列表。
 *
 * @param params - 媒体治理列表的关键词、阶段、状态与分页条件。
 * @returns 符合筛选条件的任务页、总数与分页信息。
 */
export function getMediaGovernanceTaskPage(
  params: MediaGovernanceApi.TaskPageQuery,
) {
  return requestClient.get<MediaGovernanceApi.TaskPage>(
    '/media-governance/tasks/page',
    { params },
  );
}

/**
 * 向后端请求媒体治理任务按阶段与运行状态聚合的数量摘要。
 *
 * @returns 媒体治理任务按阶段和运行状态聚合的计数。
 */
export function getMediaGovernanceSummary() {
  return requestClient.get<MediaGovernanceApi.Summary>(
    '/media-governance/tasks/summary',
  );
}

/**
 * 根据任务标识读取媒体治理任务详情。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @returns 指定标识对应的完整任务快照。
 */
export function getMediaGovernanceTask(taskId: string) {
  return requestClient.get<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}`,
  );
}

/**
 * 根据预期版本删除未执行任务及其关联草稿数据。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 被删除任务标识及其清理结果。
 */
export function discardMediaGovernanceTask(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.delete<MediaGovernanceApi.TaskDiscardResult>(
    `/media-governance/tasks/${taskId}`,
    { params: { expectedRevision } },
  );
}

/**
 * 将磁力链接、来源角色与覆盖范围添加到指定媒体治理任务。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param input - 磁力链接、来源角色、覆盖季号与预期任务修订号。
 * @returns 服务端创建并检查后的磁力来源记录。
 */
export function addMediaGovernanceMagnetSource(
  taskId: string,
  input: MediaGovernanceApi.MagnetSourceInput,
) {
  return requestClient.post<MediaGovernanceApi.Source>(
    `/media-governance/tasks/${taskId}/sources/magnet`,
    input,
  );
}

/**
 * 将种子描述与来源分类字段封装为表单后上传。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param file - 包含来源文件清单的 torrent 文件。
 * @param input - 来源角色、内容类型、覆盖季号、发布组与预期任务修订号。
 * @returns 服务端保存并检查后的种子来源记录。
 */
export function uploadMediaGovernanceTorrentSource(
  taskId: string,
  file: File,
  input: MediaGovernanceApi.SourceClassificationInput,
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('contentKind', input.contentKind);
  formData.append('expectedRevision', String(input.expectedRevision));
  formData.append('sourceRole', input.sourceRole);
  if (input.releaseGroup) formData.append('releaseGroup', input.releaseGroup);
  for (const seasonNumber of input.seasonNumbers ?? []) {
    formData.append('seasonNumbers', seasonNumber);
  }
  return requestClient.post<MediaGovernanceApi.Source>(
    `/media-governance/tasks/${taskId}/sources/torrent`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

/**
 * 根据提交的角色、内容形态和季号覆盖范围更新指定来源分类。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param sourceId - 目标媒体治理来源的稳定标识。
 * @param input - 来源角色、内容类型、覆盖季号、发布组与预期任务修订号。
 * @returns 分类、覆盖范围与修订号更新后的来源。
 */
export function updateMediaGovernanceSourceClassification(
  taskId: string,
  sourceId: string,
  input: MediaGovernanceApi.SourceClassificationInput,
) {
  return requestClient.put<MediaGovernanceApi.Source>(
    `/media-governance/tasks/${taskId}/sources/${sourceId}/classification`,
    input,
  );
}

/**
 * 将逐文件选择、角色和集号映射保存到指定任务来源。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param sourceId - 目标媒体治理来源的稳定标识。
 * @param input - 逐文件选中状态、角色、集号映射与预期任务修订号。
 * @returns 逐文件选择与治理映射保存后的来源。
 */
export function updateMediaGovernanceSourceSelection(
  taskId: string,
  sourceId: string,
  input: MediaGovernanceApi.SourceSelectionInput,
) {
  return requestClient.put<MediaGovernanceApi.Source>(
    `/media-governance/tasks/${taskId}/sources/${sourceId}/selection`,
    input,
  );
}

/**
 * 按任务版本移除指定来源并返回最新任务。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param sourceId - 目标媒体治理来源的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 来源移除后的最新任务快照。
 */
export function removeMediaGovernanceSource(
  taskId: string,
  sourceId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/sources/${sourceId}/remove`,
    { expectedRevision },
  );
}

/**
 * 让服务端解析指定来源的文件清单，并返回检查后的来源快照。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param sourceId - 目标媒体治理来源的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 包含解析文件清单与检查状态的最新来源。
 */
export function inspectMediaGovernanceSource(
  taskId: string,
  sourceId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Source>(
    `/media-governance/tasks/${taskId}/sources/${sourceId}/inspect`,
    { expectedRevision },
  );
}

/**
 * 通过运行态探测核对指定来源是否可访问。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param sourceId - 目标媒体治理来源的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 包含运行态可用性与最近探测结果的最新来源。
 */
export function probeMediaGovernanceSource(
  taskId: string,
  sourceId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Source>(
    `/media-governance/tasks/${taskId}/sources/${sourceId}/probe-runtime`,
    { expectedRevision },
  );
}

/**
 * 为治理单元绑定逐集字幕来源合同。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param unitId - 目标媒体治理单元的稳定标识。
 * @param input - 字幕发布组、覆盖单元与预期任务修订号。
 * @returns 绑定字幕发布组与覆盖范围后的治理单元。
 */
export function bindMediaGovernanceSubtitleContract(
  taskId: string,
  unitId: string,
  input: MediaGovernanceApi.SubtitleContractInput,
) {
  return requestClient.put<MediaGovernanceApi.TaskUnit>(
    `/media-governance/tasks/${taskId}/units/${unitId}/subtitle-contract`,
    input,
  );
}

/**
 * 按任务当前版本启动隔离下载。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 下载启动后的最新任务状态与下载信息。
 */
export function startMediaGovernanceDownload(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/downloads/start`,
    { expectedRevision },
  );
}

/**
 * 根据预期任务修订号取消当前下载，同时保留后续清理入口。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 下载取消后的最新任务状态。
 */
export function cancelMediaGovernanceDownload(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/downloads/cancel`,
    { expectedRevision },
  );
}

/**
 * 安全暂停任务当前的下载执行。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 下载暂停后的最新任务状态。
 */
export function pauseMediaGovernanceDownload(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/downloads/pause`,
    { expectedRevision },
  );
}

/**
 * 从当前任务版本继续原有下载执行。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 下载恢复后的最新任务状态。
 */
export function resumeMediaGovernanceDownload(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/downloads/resume`,
    { expectedRevision },
  );
}

/**
 * 根据预期任务修订号启动或安全重试本地治理执行。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 治理启动或重试后的最新任务状态。
 */
export function startMediaGovernanceRun(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/governance/start`,
    { expectedRevision },
  );
}

/**
 * 根据预期任务修订号启动独立验收核验。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 独立验收启动后的最新任务状态。
 */
export function startMediaGovernanceAcceptanceVerification(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/acceptance/verify`,
    { expectedRevision },
  );
}

/**
 * 通过后端接口读取指定任务的治理证据、验收投影与写入边界统计。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @returns 任务的证据项、边界统计与验收投影。
 */
export function getMediaGovernanceEvidence(taskId: string) {
  return requestClient.get<MediaGovernanceApi.Evidence>(
    `/media-governance/tasks/${taskId}/evidence`,
  );
}

/**
 * 根据请求基址拼接媒体治理事件流地址，并在需要时附带续传游标。
 *
 * @param lastEventId - 最近成功处理的 SSE 事件标识；省略时从最新事件开始订阅。
 * @returns 可直接传给 EventSource 的绝对或相对地址；有游标时包含 lastEventId。
 */
export function getMediaGovernanceEventsUrl(lastEventId?: string) {
  let query = '';
  if (lastEventId) {
    query = `?lastEventId=${encodeURIComponent(lastEventId)}`;
  }
  const path = `/media-governance/events/stream${query}`;
  const baseUrl = requestClient.getBaseUrl?.() || '';
  if (!baseUrl) return path;
  if (/^https?:\/\//i.test(baseUrl)) return new URL(path, baseUrl).toString();
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
