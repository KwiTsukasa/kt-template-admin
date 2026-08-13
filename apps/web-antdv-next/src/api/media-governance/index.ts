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
    providerRef: ProviderRef;
    releaseYear?: number;
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
    percent: number;
    progressLabel: string;
    speedLabel: string;
    totalBytes: number;
    totalItems: number;
  }

  export interface AgentSession {
    currentActionLabel: string;
    currentUnitId: null | string;
    lastHeartbeatLabel: string;
    policyBoundaryLabel: string;
    result?: null | {
      candidates: Array<{ id: string; summary: string }>;
      candidateSummaries: string[];
      nextActionLabel: string;
      planSha256: null | string;
      status: 'blocked' | 'plan-submitted' | 'requires-operator';
      summary: string;
    };
    status: 'failed' | 'needs-operator' | 'running' | 'succeeded';
    statusLabel: string;
    threadId: string;
  }

  export interface TaskIdentityPreview {
    mediaTypeLabel: string;
    providerLabel: string;
    releaseYearLabel: string;
    seasonLabel: string;
    status: 'pending-provider-verification';
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
    persistenceMode: 'database' | 'process-simulator';
    progress: Progress;
    providerRef: null | ProviderRef;
    releaseYear: null | number;
    revision: number;
    runState: RunState;
    semanticProjection: SemanticProjection;
    sources: Source[];
    stage: Stage;
    titleHint: string;
    units: TaskUnit[];
  }

  export interface TaskPageQuery extends Recordable<any> {
    gateReason?: string;
    governanceProfile?: GovernanceProfile;
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

  export interface Summary {
    agentPending: number;
    closed: number;
    downloading: number;
    governing: number;
    metadataAutoClosureRate: number;
    mixedSubtitleSeasonCount: number;
    stagingResidualCount: number;
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
    changeType: 'created' | 'source-updated' | 'state-updated';
    observedAt: string;
    revision: number;
    taskId: string;
  }
}

export function createMediaGovernanceTask(
  input: MediaGovernanceApi.CreateTaskInput,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    '/media-governance/tasks',
    input,
  );
}

export function getMediaGovernanceTaskPage(
  params: MediaGovernanceApi.TaskPageQuery,
) {
  return requestClient.get<MediaGovernanceApi.TaskPage>(
    '/media-governance/tasks/page',
    { params },
  );
}

export function getMediaGovernanceSummary() {
  return requestClient.get<MediaGovernanceApi.Summary>(
    '/media-governance/tasks/summary',
  );
}

export function getMediaGovernanceTask(taskId: string) {
  return requestClient.get<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}`,
  );
}

export function updateMediaGovernanceTaskIdentity(
  taskId: string,
  input: MediaGovernanceApi.UpdateTaskIdentityInput,
) {
  return requestClient.put<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/identity`,
    input,
  );
}

export function addMediaGovernanceMagnetSource(
  taskId: string,
  input: MediaGovernanceApi.MagnetSourceInput,
) {
  return requestClient.post<MediaGovernanceApi.Source>(
    `/media-governance/tasks/${taskId}/sources/magnet`,
    input,
  );
}

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

export function startMediaGovernanceDownload(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/downloads/start`,
    { expectedRevision },
  );
}

export function cancelMediaGovernanceDownload(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/downloads/cancel`,
    { expectedRevision },
  );
}

export function resumeMediaGovernanceDownload(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/downloads/resume`,
    { expectedRevision },
  );
}

export function startMediaGovernanceRun(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/governance/start`,
    { expectedRevision },
  );
}

export function startMediaGovernanceMetadataRepair(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/metadata/repair`,
    { expectedRevision },
  );
}

export function startMediaGovernanceMetadataVerification(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/metadata/verify`,
    { expectedRevision },
  );
}

export function startMediaGovernanceAcceptanceVerification(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.Task>(
    `/media-governance/tasks/${taskId}/acceptance/verify`,
    { expectedRevision },
  );
}

export function startMediaGovernanceAgent(
  taskId: string,
  expectedRevision: number,
) {
  return requestClient.post<MediaGovernanceApi.AgentSession>(
    `/media-governance/tasks/${taskId}/agent/start`,
    { expectedRevision },
  );
}

export function getMediaGovernanceAgentSession(taskId: string) {
  return requestClient.get<MediaGovernanceApi.AgentSession | null>(
    `/media-governance/tasks/${taskId}/agent/session`,
  );
}

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

export function getMediaGovernanceEvidence(taskId: string) {
  return requestClient.get<MediaGovernanceApi.Evidence>(
    `/media-governance/tasks/${taskId}/evidence`,
  );
}

export function getMediaGovernanceEventsUrl(lastEventId?: string) {
  const query = lastEventId
    ? `?lastEventId=${encodeURIComponent(lastEventId)}`
    : '';
  const path = `/media-governance/events/stream${query}`;
  const baseUrl = requestClient.getBaseUrl?.() || '';
  if (!baseUrl) return path;
  if (/^https?:\/\//i.test(baseUrl)) return new URL(path, baseUrl).toString();
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
