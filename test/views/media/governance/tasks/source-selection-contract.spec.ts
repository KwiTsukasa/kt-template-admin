import type { MediaGovernanceApi } from '#/api/media-governance';

import {
  buildSourceSelectionInput,
  inferSourceFileMappings,
} from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/source-selection-contract';
import { describe, expect, it } from 'vitest';

function fixture() {
  const task = {
    mediaType: 'tv',
    revision: 8,
    units: [
      { id: 'media-unit-s00', seasonNumber: 'S00' },
      { id: 'media-unit-s01', seasonNumber: 'S01' },
    ],
  } as MediaGovernanceApi.Task;
  const source = {
    id: 'media-source-fixture',
    manifest: [
      {
        executable: false,
        index: 0,
        relativePath: '[Release] Show [01].chs.ass',
        sizeBytes: 100,
      },
      {
        executable: false,
        index: 1,
        relativePath: '[Release] Show [01].mkv',
        sizeBytes: 1000,
      },
      {
        executable: false,
        index: 2,
        relativePath: '[Release][Fonts].7z',
        sizeBytes: 200,
      },
      {
        executable: false,
        index: 3,
        relativePath: 'SPs/[Release] Show [NCOP].mkv',
        sizeBytes: 300,
      },
    ],
    seasonNumbers: ['S00', 'S01'],
  } as MediaGovernanceApi.Source;
  return { source, task };
}

describe('media source file mapping contract', () => {
  it('infers normal episodes, Simplified Chinese subtitles and fonts without guessing S00 numbering', () => {
    const { source, task } = fixture();
    const rows = inferSourceFileMappings(task, source);

    expect(rows).toEqual([
      expect.objectContaining({
        episodeText: '1',
        fileRole: 'subtitle',
        language: 'zh-CN',
        selected: true,
        unitId: 'media-unit-s01',
      }),
      expect.objectContaining({
        episodeText: '1',
        fileRole: 'video',
        selected: true,
        unitId: 'media-unit-s01',
      }),
      expect.objectContaining({ fileRole: 'font', selected: true }),
      expect.objectContaining({
        episodeText: '',
        fileRole: 'video',
        selected: false,
        unitId: 'media-unit-s00',
      }),
    ]);
  });

  it('builds one exact selection and rejects duplicated episode identities', () => {
    const { source, task } = fixture();
    const rows = inferSourceFileMappings(task, source);
    const sealed = buildSourceSelectionInput(task, source, rows);

    expect(sealed.errors).toEqual([]);
    expect(sealed.input).toMatchObject({
      expectedRevision: 8,
      selectedFileIndices: [0, 1, 2],
    });
    const special = rows[3];
    expect(special).toBeDefined();
    if (!special) throw new Error('S00 fixture row is missing');
    special.selected = true;
    special.episodeText = '1';
    special.unitId = 'media-unit-s01';
    expect(buildSourceSelectionInput(task, source, rows).errors).toContain(
      '同一单元的集号或字幕语言映射不能重复',
    );
  });
});
