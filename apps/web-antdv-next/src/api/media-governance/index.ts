import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

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
    | 'intake'
    | 'metadata';

  export interface ProviderRef {
    provider: Provider;
    providerId: string;
  }

  export interface CreateTaskInput {
    mediaType: MediaType;
    providerRef?: ProviderRef;
    releaseYear?: number;
    seasonNumbers?: string[];
    titleHint: string;
  }

  export interface UpdateTaskIdentityInput {
    expectedRevision: number;
    mediaType?: MediaType;
    providerRef?: null | ProviderRef;
    releaseYear?: null | number;
    seasonNumbers?: string[];
    titleHint?: string;
  }

  export interface TaskUnit {
    evidenceSha256: null | string;
    expectedEpisodeNumbers: number[];
    id: string;
    localAcceptedAt: null | string;
    metadataProjection: {
      identityRefreshAttempts?: number;
      missingA: string[];
      missingB: string[];
      missingC: string[];
      repairAttempts: number;
      validBFallbacks: string[];
    };
    seasonNumber: null | string;
    subtitleContract: null | SubtitleContract;
    unitKind: 'movie' | 'season';
  }

  export interface SubtitleContract {
    expectedEpisodeNumbers: number[];
    mappings: Array<{ episodeNumber: number; relativePath: string }>;
    releaseGroup: string;
    sourceId: string;
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
    metadataStatusLabel: string;
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

  export interface AgentSession {
    conversationRevision?: number;
    currentActionLabel: string;
    currentUnitId: null | string;
    lastHeartbeatLabel: string;
    hasMoreMessages?: boolean;
    historyComplete?: boolean;
    messages?: AgentMessage[];
    policyBoundaryLabel: string;
    result?: null | {
      candidates: Array<{ id: string; summary: string }>;
      candidateSummaries: string[];
      nextActionLabel: string;
      planSha256: null | string;
      status:
        | 'blocked'
        | 'conversation-response'
        | 'plan-submitted'
        | 'requires-operator';
      summary: string;
    };
    status: 'failed' | 'needs-operator' | 'running' | 'succeeded';
    statusLabel: string;
    threadId: string;
    recommendations?: AgentRecommendation[];
  }

  export interface AgentMessage {
    content: string;
    messageId: string;
    observedAt: string;
    phase: 'commentary' | 'final_answer' | 'user';
    result: AgentSession['result'];
    role: 'assistant' | 'user';
    sequence: number;
    status: 'completed' | 'streaming';
    turnId: string;
  }

  export interface AgentRecommendation {
    id: string;
    label: string;
    prompt: string;
  }

  export interface AgentConversationEvent {
    capsuleSha256: string;
    changeType:
      | 'assistant-delta'
      | 'message-completed'
      | 'turn-completed'
      | 'turn-started';
    content: string;
    conversationRevision: number;
    eventSequence: number;
    messageId: string;
    observedAt: string;
    phase: AgentMessage['phase'];
    result: AgentSession['result'];
    role: AgentMessage['role'];
    status: AgentMessage['status'];
    taskId: string;
    taskRevision: number;
    threadId: string;
    turnId: string;
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
    agentSession: AgentSession | null;
    closedAt: null | string;
    closedMode: 'agent_verified' | 'automatic' | 'bounded_repair' | null;
    gateReason: null | string;
    governanceProfile: GovernanceProfile | null;
    id: string;
    identityPreview: TaskIdentityPreview;
    mediaType: MediaType;
    metadataIdentity: null | (ProviderRef & { releaseYear: null | number });
    metadataStatus: 'pending' | 'requires-agent' | 'verified';
    nextCommandLabel: string;
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
    sources: Source[];
    stage: Stage;
    titleHint: string;
    units: TaskUnit[];
    workItemId: null | string;
  }

  export interface TaskPageQuery extends Recordable<any> {
    gateReason?: string;
    governanceProfile?: GovernanceProfile;
    keyword?: string;
    metadataStatus?: string;
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
    agentPending: number;
    attentionRequired: number;
    blocked: number;
    closed: number;
    downloading: number;
    evidenceDriftCount: number;
    governing: number;
    healthLabel: string;
    metadataAutoClosureRate: number;
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
    agentStatusLabel: string;
    descriptorCount: number;
    eventProjection: string;
    localAcceptedUnitCount: number;
    metadataStatusLabel: string;
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
}

/**
 * 创建媒体治理任务草稿并返回服务端生成的完整任务。
 *
 * @param input - 新任务的媒体类型、标题、季号与资料库身份。
 * @returns 服务端创建并补齐标识、修订号与初始状态的任务。
 */
export function createMediaGovernanceTask(
  input: MediaGovernanceApi.CreateTaskInput,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    '/media-governance/tasks',
    input,
  );
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
 * 在指定任务版本上更新作品身份并返回最新任务。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param input - 带预期修订号的作品身份与季号变更。
 * @returns 身份与季号保存后的最新任务快照。
 */
export function updateMediaGovernanceTaskIdentity(
  taskId: string,
  input: MediaGovernanceApi.UpdateTaskIdentityInput,
) {
  return requestClient.put<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/identity`,
    input,
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
 * 根据预期任务修订号启动有界元数据修复。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 元数据修复启动后的最新任务状态。
 */
export function startMediaGovernanceMetadataRepair(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/metadata/repair`,
    { expectedRevision },
  );
}

/**
 * 根据预期任务修订号启动元数据核验。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 元数据核验启动后的最新任务状态。
 */
export function startMediaGovernanceMetadataVerification(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/metadata/verify`,
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
 * 根据任务快照启动媒体治理 Agent 会话。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 新建或安全重试后的 Agent 会话。
 */
export function startMediaGovernanceAgent(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.AgentSession>(
    `/media-governance/tasks/${taskId}/agent/start`,
    { expectedRevision },
  );
}

/**
 * 分页读取任务当前 Agent 会话及其消息历史。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param params - 会话消息的起始序号与最大返回数量；未传入时使用 `{}`。
 * @returns 当前 Agent 会话及消息页；任务尚无会话时为 null。
 */
export function getMediaGovernanceAgentSession(
  taskId: string,
  params: { afterSequence?: number; limit?: number } = {},
) {
  return requestClient.get<MediaGovernanceApi.AgentSession | null>(
    `/media-governance/tasks/${taskId}/agent/session`,
    { params },
  );
}

/**
 * 向任务当前 Agent 线程发送带版本约束的用户消息。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param input - 线程标识、客户端消息标识、正文和预期会话修订号。
 * @returns 接受用户消息后的最新 Agent 会话与会话修订号。
 */
export function sendMediaGovernanceAgentMessage(
  taskId: string,
  input: {
    clientMessageId: string;
    content: string;
    expectedConversationRevision: number;
    threadId: string;
  },
) {
  return requestClient.post<MediaGovernanceApi.AgentSession>(
    `/media-governance/tasks/${taskId}/agent/messages`,
    input,
  );
}

/**
 * 将人工选择的候选、放行依据与预期修订号提交到任务会话。
 *
 * @param taskId - 目标媒体治理任务的稳定标识。
 * @param input - 被选择的候选标识、人工依据与预期任务修订号。
 * @returns 人工决策写入后的最新任务快照。
 */
export function submitMediaGovernanceOperatorDecision(
  taskId: string,
  input: {
    expectedRevision: number;
    reason: string;
    selectedCandidateId: string;
  },
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/agent/operator-decision`,
    input,
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
