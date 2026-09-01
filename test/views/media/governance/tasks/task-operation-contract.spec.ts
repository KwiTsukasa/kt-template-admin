import type { MediaGovernanceApi } from '#/api/media-governance';

import {
  getAddableSourceRole,
  getDiscardConfirmation,
  getDiscardDisabledReason,
  getMediaGovernanceTaskOperations,
  hasCompleteSourceMapping,
} from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/task-operation-contract';
import { describe, expect, it } from 'vitest';

function taskFixture(
  patch: Partial<MediaGovernanceApi.Task> = {},
): MediaGovernanceApi.Task {
  return {
    activeRunId: null,
    closedAt: null,
    closedMode: null,
    gateReason: null,
    governanceProfile: null,
    id: 'media-task-fixture',
    identityPreview: {} as MediaGovernanceApi.TaskIdentityPreview,
    mediaType: 'tv',
    metadataIdentity: null,
    nextCommandLabel: '添加新的主媒体来源',
    operationKind: 'source-intake',
    payloadSeal: null,
    persistenceMode: 'database',
    progress: {} as MediaGovernanceApi.Progress,
    providerRef: { provider: 'tmdb', providerId: '123' },
    releaseYear: 2024,
    revision: 3,
    runState: 'draft',
    sealedPlan: null,
    sealedPlanSha256: null,
    semanticProjection: {
      currentActionLabel: '添加新的主媒体来源',
      discardAllowed: true,
      discardReasonLabel: null,
      gateReasonLabel: '无阻塞',
      runStateLabel: '草稿',
      sourceHealthLabel: '未检查',
      stageLabel: '接收资料',
    },
    sources: [],
    stage: 'intake',
    seriesId: 'media-series-fixture',
    titleHint: '测试作品',
    units: [],
    workId: 'media-work-fixture',
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
  it('uses the API discard projection and names bound-ledger cleanup', () => {
    const draft = taskFixture({ workItemId: 'media-063' });
    expect(getDiscardDisabledReason(draft)).toBeUndefined();
    expect(getDiscardConfirmation(draft)).toContain(
      '清除绑定的本地账本 media-063',
    );

    const running = taskFixture({
      semanticProjection: {
        ...draft.semanticProjection,
        discardAllowed: false,
        discardReasonLabel: '任务已进入执行阶段，不能删除。',
      },
    });
    expect(getDiscardDisabledReason(running)).toBe(
      '任务已进入执行阶段，不能删除。',
    );
  });

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

  it('projects all recovery actions after an intake source failure', () => {
    const blockedProjection = {
      ...taskFixture().semanticProjection,
      discardAllowed: true,
      discardReasonLabel: null,
      runStateLabel: '等待处理',
    };
    const pending = taskFixture({
      runState: 'blocked',
      semanticProjection: blockedProjection,
      sources: [sourceFixture({ sourceHealth: 'unavailable' })],
    });
    expect(keys(pending)).toEqual(['replace-source', 'discard-task']);

    const healthyPrimary = sourceFixture({
      id: 'source-primary',
      sourceHealth: 'viable',
      sourceHealthLabel: '来源可用',
    });
    const failedSubtitle = sourceFixture({
      id: 'source-subtitle',
      sourceHealth: 'unavailable',
      sourceHealthLabel: '来源检查失败',
      sourceRole: 'supplemental_subtitle',
    });
    const multiSourceOperations = getMediaGovernanceTaskOperations(
      taskFixture({
        runState: 'blocked',
        semanticProjection: blockedProjection,
        sources: [healthyPrimary, failedSubtitle],
      }),
    );
    expect(multiSourceOperations[0]).toMatchObject({
      key: 'replace-source',
      sourceId: failedSubtitle.id,
    });

    const inspected = sourceFixture({
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
      sourceHealth: 'unavailable',
    });
    expect(
      keys(
        taskFixture({
          runState: 'blocked',
          semanticProjection: blockedProjection,
          sources: [inspected],
        }),
      ),
    ).toEqual(['replace-source', 'configure-source', 'discard-task']);
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
    const failedDownloadOperations = getMediaGovernanceTaskOperations(
      taskFixture({
        gateReason: 'NAS 执行失败：write EPIPE',
        nextCommandLabel: '查看失败原因后重试',
        runState: 'blocked',
        stage: 'download',
      }),
    );
    expect(failedDownloadOperations).toEqual([
      expect.objectContaining({
        key: 'resume-download',
        label: '恢复 NAS 下载',
      }),
    ]);
    expect(
      keys(taskFixture({ runState: 'succeeded', stage: 'download' })),
    ).toEqual(['start-governance']);
    expect(
      keys(
        taskFixture({
          nextCommandLabel: '开始机械验收',
          runState: 'succeeded',
          stage: 'acceptance',
        }),
      ),
    ).toEqual(['start-acceptance']);
    expect(
      keys(
        taskFixture({
          runState: 'blocked',
          sealedPlan: {},
          stage: 'acceptance',
        }),
      ),
    ).toEqual(['start-acceptance']);
  });

  it('exposes only mechanical recovery and no actions for closed tasks', () => {
    expect(
      keys(
        taskFixture({
          runState: 'blocked',
          sealedPlan: {},
          stage: 'governance',
        }),
      ),
    ).toEqual(['start-governance']);
    expect(keys(taskFixture({ stage: 'closed' }))).toEqual([]);
  });
});
