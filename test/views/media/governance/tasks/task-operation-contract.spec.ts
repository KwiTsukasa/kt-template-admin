import type { MediaGovernanceApi } from '#/api/media-governance';

import {
  getAddableSourceRole,
  getDiscardConfirmation,
  getDiscardDisabledReason,
  getMediaGovernanceProgressStatus,
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
  it.each([
    ['intake', 'succeeded', 'normal'],
    ['intake', 'draft', 'normal'],
    ['intake', 'blocked', 'exception'],
    ['download', 'running', 'active'],
    ['download', 'succeeded', 'normal'],
    ['governance', 'succeeded', 'normal'],
    ['acceptance', 'succeeded', 'normal'],
    ['closed', 'succeeded', 'success'],
  ] as const)(
    'projects %s / %s without deriving success from percent',
    (stage, runState, expected) => {
      expect(getMediaGovernanceProgressStatus({ stage, runState })).toBe(
        expected,
      );
    },
  );

  it('keeps deletion permission authoritative and describes bound-ledger cleanup', () => {
    const draft = taskFixture({ workItemId: 'media-063' });
    expect(getDiscardDisabledReason(draft)).toBeUndefined();
    expect(getDiscardConfirmation(draft)).toContain(
      '清除绑定的本地账本 media-063',
    );
    const task = taskFixture({
      semanticProjection: {
        ...draft.semanticProjection,
        discardAllowed: false,
        discardReasonLabel: '存在运行实例',
      },
    });
    expect(getDiscardDisabledReason(task)).toBe('存在运行实例');
    expect(keys(task)).not.toContain('discard-task');
  });

  it('never offers standalone execution or fake inspection/replacement actions at any business stage', () => {
    for (const stage of [
      'intake',
      'download',
      'governance',
      'acceptance',
      'closed',
    ] as const) {
      for (const runState of [
        'draft',
        'running',
        'blocked',
        'succeeded',
      ] as const) {
        const task = taskFixture({
          stage,
          runState,
          sources: [sourceFixture()],
        });
        const operations = getMediaGovernanceTaskOperations(task);
        expect(operations[0]).toMatchObject({
          key: 'workflow',
          permissionCode: 'Media:Governance:List',
        });
        expect(
          operations.every((item) =>
            [
              'add-source',
              'configure-source',
              'discard-task',
              'workflow',
            ].includes(item.key),
          ),
        ).toBe(true);
        if (stage === 'closed') expect(keys(task)).toEqual(['workflow']);
      }
    }
    expect(keys(taskFixture({ activeRunId: 'active-run' }))).toEqual([
      'workflow',
    ]);
  });

  it('preserves authoritative source upload and mapping while execution belongs to the instance', () => {
    const empty = taskFixture();
    expect(getAddableSourceRole(empty)).toBe('primary_media');
    expect(keys(empty)).toContain('add-source');
    const inspected = sourceFixture({
      manifestState: 'inspected',
      selectedFileCount: 1,
      selectedFileIndices: [0],
      selectedFileMappings: [],
    });
    expect(hasCompleteSourceMapping(inspected)).toBe(false);
    expect(
      getMediaGovernanceTaskOperations(taskFixture({ sources: [inspected] })),
    ).toContainEqual(
      expect.objectContaining({
        key: 'configure-source',
        sourceId: inspected.id,
      }),
    );
    inspected.selectedFileMappings = [
      {
        episodeNumber: 1,
        fileRole: 'video',
        index: 0,
        language: null,
        unitId: 'unit-s01',
      },
    ];
    expect(hasCompleteSourceMapping(inspected)).toBe(true);
    expect(keys(taskFixture({ sources: [inspected] }))).not.toContain(
      'configure-source',
    );
    const subtitle = taskFixture({
      sources: [sourceFixture({ contentKind: 'subtitleless_media' })],
    });
    expect(getAddableSourceRole(subtitle)).toBe('supplemental_subtitle');
    expect(keys(subtitle)).toContain('add-source');
  });
});
