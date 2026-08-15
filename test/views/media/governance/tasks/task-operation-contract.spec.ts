import type { MediaGovernanceApi } from '#/api/media-governance';

import {
  getAddableSourceRole,
  getMediaGovernanceTaskOperations,
  hasCompleteSourceMapping,
} from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/task-operation-contract';
import { describe, expect, it } from 'vitest';

function taskFixture(
  patch: Partial<MediaGovernanceApi.Task> = {},
): MediaGovernanceApi.Task {
  return {
    activeRunId: null,
    agentSession: null,
    closedAt: null,
    closedMode: null,
    gateReason: null,
    governanceProfile: null,
    id: 'media-task-fixture',
    identityPreview: {} as MediaGovernanceApi.TaskIdentityPreview,
    mediaType: 'tv',
    metadataIdentity: null,
    metadataStatus: 'pending',
    nextCommandLabel: '添加新的主媒体来源',
    payloadSeal: null,
    persistenceMode: 'database',
    progress: {} as MediaGovernanceApi.Progress,
    providerRef: { provider: 'tmdb', providerId: '123' },
    releaseYear: 2024,
    revision: 3,
    runState: 'draft',
    sealedPlan: null,
    sealedPlanSha256: null,
    semanticProjection: {} as MediaGovernanceApi.SemanticProjection,
    sources: [],
    stage: 'intake',
    titleHint: '测试作品',
    units: [],
    workItemId: null,
    ...patch,
  };
}

function sourceFixture(
  patch: Partial<MediaGovernanceApi.Source> = {},
): MediaGovernanceApi.Source {
  return {
    contentKind: 'embedded_subtitle_media',
    descriptorObjectId: 'descriptor',
    descriptorSha256: 'sha',
    id: 'source-fixture',
    infoHash: 'a'.repeat(40),
    manifest: [],
    manifestSha256: null,
    manifestState: 'pending-inspection',
    releaseGroup: 'DBD-Raws',
    seasonNumbers: ['S01'],
    selectedBytes: 0,
    selectedFileCount: 0,
    selectedFileIndices: [],
    selectedFileMappings: [],
    sourceHealth: 'unchecked',
    sourceHealthLabel: '待校验',
    sourceHealthReasonLabel: '尚未运行探测',
    sourceRole: 'primary_media',
    transportKind: 'torrent',
    ...patch,
  };
}

function keys(task: MediaGovernanceApi.Task) {
  return getMediaGovernanceTaskOperations(task).map((item) => item.key);
}

describe('media governance task operation contract', () => {
  it('projects the intake chain from source creation through runtime probe and download', () => {
    const empty = taskFixture();
    expect(getAddableSourceRole(empty)).toBe('primary_media');
    expect(keys(empty)).toEqual(['add-source']);

    const pending = taskFixture({ sources: [sourceFixture()] });
    expect(keys(pending)).toEqual(['inspect-source']);

    const inspectedSource = sourceFixture({
      manifest: [
        {
          executable: false,
          index: 0,
          relativePath: 'Show.S01E01.mkv',
          sizeBytes: 100,
        },
      ],
      manifestSha256: 'manifest-sha',
      manifestState: 'inspected',
    });
    expect(keys(taskFixture({ sources: [inspectedSource] }))).toEqual([
      'configure-source',
    ]);

    const mappedSource = sourceFixture({
      ...inspectedSource,
      selectedFileCount: 1,
      selectedFileIndices: [0],
      selectedFileMappings: [
        {
          episodeNumber: 1,
          fileRole: 'video',
          index: 0,
          language: null,
          unitId: 'unit-s01',
        },
      ],
    });
    expect(hasCompleteSourceMapping(mappedSource)).toBe(true);
    expect(keys(taskFixture({ sources: [mappedSource] }))).toEqual([
      'probe-source',
    ]);
    expect(
      keys(
        taskFixture({
          sources: [sourceFixture({ ...mappedSource, sourceHealth: 'viable' })],
        }),
      ),
    ).toEqual(['start-download']);
  });

  it('keeps supplemental subtitle creation in the same chain for subtitleless media', () => {
    const primary = sourceFixture({ contentKind: 'subtitleless_media' });
    const task = taskFixture({
      governanceProfile: 'sidecar-linked',
      sources: [primary],
    });

    expect(getAddableSourceRole(task)).toBe('supplemental_subtitle');
    expect(keys(task)).toEqual(['add-source']);
  });

  it('projects running download controls and every post-download closure step', () => {
    expect(
      keys(
        taskFixture({
          activeRunId: 'run-download',
          runState: 'running',
          stage: 'download',
        }),
      ),
    ).toEqual(['pause-download', 'cancel-download']);
    expect(
      keys(
        taskFixture({
          activeRunId: 'run-download',
          runState: 'blocked',
          stage: 'download',
        }),
      ),
    ).toEqual(['resume-download', 'cancel-download']);
    expect(
      keys(taskFixture({ runState: 'succeeded', stage: 'download' })),
    ).toEqual(['start-governance']);
    expect(
      keys(
        taskFixture({
          metadataStatus: 'pending',
          nextCommandLabel: '重新采集元数据',
          runState: 'succeeded',
          stage: 'metadata',
        }),
      ),
    ).toEqual(['start-metadata-verification']);
    expect(
      keys(
        taskFixture({
          metadataStatus: 'verified',
          nextCommandLabel: '开始独立验收',
          runState: 'succeeded',
          stage: 'metadata',
        }),
      ),
    ).toEqual(['start-acceptance']);
  });

  it('projects bounded repair and CodexAgent escalation without exposing closed tasks', () => {
    expect(
      keys(
        taskFixture({
          metadataStatus: 'requires-agent',
          nextCommandLabel: '开始有界元数据修复',
          runState: 'blocked',
          stage: 'metadata',
        }),
      ),
    ).toEqual(['start-metadata-repair']);
    expect(
      keys(
        taskFixture({
          metadataStatus: 'requires-agent',
          nextCommandLabel: '启动人工治理',
          runState: 'blocked',
          stage: 'metadata',
        }),
      ),
    ).toEqual(['start-agent']);
    expect(keys(taskFixture({ stage: 'closed' }))).toEqual([]);
  });
});
