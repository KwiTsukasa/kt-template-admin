import type { MediaGovernanceApi } from '#/api/media-governance';

export interface EditableSourceFileMapping {
  episodeText: string;
  fileRole: '' | MediaGovernanceApi.SelectedFileRole;
  index: number;
  language: '' | MediaGovernanceApi.SubtitleLanguage;
  selected: boolean;
  unitId: string;
}

function fileRole(relativePath: string) {
  const lower = relativePath.toLowerCase();
  if (/\.(?:avi|m2ts|m4v|mkv|mov|mp4|ts|webm)$/u.test(lower)) {
    return 'video' as const;
  }
  if (/\.(?:ass|ssa|srt|sup|vtt)$/u.test(lower)) {
    return 'subtitle' as const;
  }
  if (
    /\.(?:otf|ttf|woff2?)$/u.test(lower) ||
    /(?:^|\/)[^/]*font[^/]*\.(?:7z|rar|zip)$/u.test(lower)
  ) {
    return 'font' as const;
  }
  return '';
}

function subtitleLanguage(relativePath: string) {
  const lower = relativePath.toLowerCase();
  if (/(?:^|[._ -])(?:chs|sc|zh[-_.]?(?:cn|hans))(?=[._ -]|$)/u.test(lower)) {
    return 'zh-CN' as const;
  }
  if (/(?:^|[._ -])(?:cht|tc|zh[-_.]?tw)(?:[._ -]|$)/u.test(lower)) {
    return 'zh-TW' as const;
  }
  if (/(?:^|[._ -])(?:jpn?|ja)(?:[._ -]|$)/u.test(lower)) {
    return 'ja' as const;
  }
  if (/(?:^|[._ -])eng?(?:[._ -]|$)/u.test(lower)) {
    return 'en' as const;
  }
  return '';
}

function episodeNumber(relativePath: string) {
  const explicit = relativePath.match(
    /(?:^|[^a-z0-9])S\d{2}E(\d{1,3})(?!\d)/iu,
  );
  if (explicit) return Number(explicit[1]);
  const bracket = relativePath.match(/\[(\d{1,3})\]/u);
  if (bracket) return Number(bracket[1]);
  const dash = relativePath.match(/\s-\s(\d{1,3})(?!\d)/u);
  if (dash) return Number(dash[1]);
  const basename = relativePath.match(/(?:^|\/)(\d{1,3})(?=[._ -])/u);
  return basename ? Number(basename[1]) : null;
}

function mappedUnit(
  task: MediaGovernanceApi.Task,
  source: MediaGovernanceApi.Source,
  relativePath: string,
) {
  if (task.mediaType !== 'tv') return task.units[0]?.id || '';
  const explicit = relativePath.match(
    /(?:^|[^a-z0-9])S(\d{2})E\d{1,3}(?!\d)/iu,
  );
  if (explicit) {
    return (
      task.units.find((unit) => unit.seasonNumber === `S${explicit[1]}`)?.id ||
      ''
    );
  }
  if (/(?:^|\/)SPs\//iu.test(relativePath)) {
    return task.units.find((unit) => unit.seasonNumber === 'S00')?.id || '';
  }
  const candidates = task.units.filter(
    (unit) =>
      unit.seasonNumber &&
      unit.seasonNumber !== 'S00' &&
      source.seasonNumbers.includes(unit.seasonNumber),
  );
  if (candidates.length === 1) return candidates[0]?.id || '';
  if (source.seasonNumbers.length === 1) {
    return (
      task.units.find((unit) => unit.seasonNumber === source.seasonNumbers[0])
        ?.id || ''
    );
  }
  return '';
}

export function inferSourceFileMappings(
  task: MediaGovernanceApi.Task,
  source: MediaGovernanceApi.Source,
): EditableSourceFileMapping[] {
  return source.manifest.map((entry) => {
    const role = fileRole(entry.relativePath);
    const unitId = mappedUnit(task, source, entry.relativePath);
    const episode = episodeNumber(entry.relativePath);
    const isUnnumberedSpecial =
      task.units.find((unit) => unit.id === unitId)?.seasonNumber === 'S00' &&
      !/(?:^|[^a-z0-9])S00E\d{1,3}(?!\d)/iu.test(entry.relativePath);
    const language =
      role === 'subtitle' ? subtitleLanguage(entry.relativePath) : '';
    let episodeText = '';
    if (
      role !== 'font' &&
      task.mediaType === 'tv' &&
      !isUnnumberedSpecial &&
      episode !== null
    ) {
      episodeText = String(episode);
    }
    return {
      episodeText,
      fileRole: role,
      index: entry.index,
      language,
      selected:
        role === 'font' ||
        (role === 'video' &&
          Boolean(unitId) &&
          !isUnnumberedSpecial &&
          episode !== null) ||
        (role === 'subtitle' &&
          language === 'zh-CN' &&
          Boolean(unitId) &&
          episode !== null),
      unitId,
    };
  });
}

export function buildSourceSelectionInput(
  task: MediaGovernanceApi.Task,
  source: MediaGovernanceApi.Source,
  rows: EditableSourceFileMapping[],
) {
  const selected = rows.filter((row) => row.selected);
  const errors: string[] = [];
  if (selected.length === 0) errors.push('至少选择一个需要治理的文件');
  const mappings = selected.flatMap((row) => {
    const unit = task.units.find((candidate) => candidate.id === row.unitId);
    if (!row.fileRole || !unit) {
      errors.push(`文件索引 ${row.index} 尚未选择治理角色或目标单元`);
      return [];
    }
    const episodeNumberValue = Number(row.episodeText);
    const needsEpisode = task.mediaType === 'tv' && row.fileRole !== 'font';
    if (
      needsEpisode &&
      (!/^\d{1,3}$/u.test(row.episodeText) ||
        !Number.isInteger(episodeNumberValue))
    ) {
      errors.push(`文件索引 ${row.index} 必须填写有效集号`);
      return [];
    }
    if (row.fileRole === 'subtitle' && !row.language) {
      errors.push(`字幕文件索引 ${row.index} 必须选择语言`);
      return [];
    }
    return [
      {
        ...(needsEpisode ? { episodeNumber: episodeNumberValue } : {}),
        fileRole: row.fileRole,
        index: row.index,
        ...(row.fileRole === 'subtitle'
          ? {
              language: row.language as MediaGovernanceApi.SubtitleLanguage,
            }
          : {}),
        unitId: row.unitId,
      },
    ];
  });
  const videoKeys = mappings
    .filter((mapping) => mapping.fileRole === 'video')
    .map((mapping) => `${mapping.unitId}:${mapping.episodeNumber ?? 'movie'}`);
  const subtitleKeys = mappings
    .filter((mapping) => mapping.fileRole === 'subtitle')
    .map(
      (mapping) =>
        `${mapping.unitId}:${mapping.episodeNumber ?? 'movie'}:${mapping.language}`,
    );
  if (
    new Set(videoKeys).size !== videoKeys.length ||
    new Set(subtitleKeys).size !== subtitleKeys.length
  ) {
    errors.push('同一单元的集号或字幕语言映射不能重复');
  }
  return {
    errors: [...new Set(errors)],
    input: {
      expectedRevision: task.revision,
      fileMappings: mappings,
      selectedFileIndices: mappings
        .map((mapping) => mapping.index)
        .toSorted((left, right) => left - right),
    } satisfies MediaGovernanceApi.SourceSelectionInput,
    sourceId: source.id,
  };
}
