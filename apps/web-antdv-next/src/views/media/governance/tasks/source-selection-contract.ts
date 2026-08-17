import type { MediaGovernanceApi } from '#/api/media-governance';

export interface EditableSourceFileMapping {
  episodeText: string;
  fileRole: '' | MediaGovernanceApi.SelectedFileRole;
  index: number;
  language: '' | MediaGovernanceApi.SubtitleLanguage;
  selected: boolean;
  unitId: string;
}

export interface LinkedSubtitleContractPlan {
  expectedEpisodeNumbers: number[];
  mappings: Array<{ episodeNumber: number; relativePath: string }>;
  releaseGroup: string;
  sourceId: string;
  unitId: string;
}

type ChineseSubtitleMapping =
  MediaGovernanceApi.SourceSelectionInput['fileMappings'][number] & {
    episodeNumber: number;
    fileRole: 'subtitle';
    language: 'zh-CN' | 'zh-TW';
  };

/**
 * 根据来源文件扩展名推断治理角色。
 *
 * @param relativePath - 来源文件相对于下载根目录的路径，用来推断角色、语言、集号与治理单元。
 * @returns 根据扩展名推断的 video、subtitle 或 ignore 角色。
 */
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

/**
 * 根据文件名中的语言标记推断字幕语言。
 *
 * @param relativePath - 来源文件相对于下载根目录的路径，用来推断角色、语言、集号与治理单元。
 * @returns 文件名推断出的字幕语言代码；无法识别时为空字符串。
 */
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

/**
 * 从常见媒体文件命名格式中提取集号。
 *
 * @param relativePath - 来源文件相对于下载根目录的路径，用来推断角色、语言、集号与治理单元。
 * @returns 文件名推断出的正整数集号；无法识别时为 null。
 */
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
  if (basename) return Number(basename[1]);
  return null;
}

/**
 * 根据媒体类型、季号与路径将来源文件映射到治理单元。
 *
 * @param task - 提供媒体类型与候选治理单元的任务快照。
 * @param source - 提供来源覆盖季号、用于缩小治理单元范围的来源记录。
 * @param relativePath - 来源文件相对于下载根目录的路径，用来推断角色、语言、集号与治理单元。
 * @returns 文件对应的治理单元标识；无法归属时为空字符串。
 */
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

/**
 * 结合已保存映射与文件名规则生成逐文件编辑草稿。
 *
 * @param task - 提供媒体类型与治理单元、用于推断文件归属的任务快照。
 * @param source - 提供文件清单、既有选择映射与覆盖季号的来源记录。
 * @returns 结合已保存选择和文件名推断出的逐文件编辑草稿。
 */
export function inferSourceFileMappings(
  task: MediaGovernanceApi.Task,
  source: MediaGovernanceApi.Source,
): EditableSourceFileMapping[] {
  return source.manifest.map((entry) => {
    const stored = (source.selectedFileMappings ?? []).find(
      (mapping) => mapping.index === entry.index,
    );
    if (stored) {
      let episodeText = '';
      if (stored.episodeNumber !== null) {
        episodeText = String(stored.episodeNumber);
      }
      return {
        episodeText,
        fileRole: stored.fileRole,
        index: entry.index,
        language: stored.language ?? '',
        selected: true,
        unitId: stored.unitId,
      };
    }
    const role = fileRole(entry.relativePath);
    const unitId = mappedUnit(task, source, entry.relativePath);
    const episode = episodeNumber(entry.relativePath);
    const isUnnumberedSpecial =
      task.units.find((unit) => unit.id === unitId)?.seasonNumber === 'S00' &&
      !/(?:^|[^a-z0-9])S00E\d{1,3}(?!\d)/iu.test(entry.relativePath);
    let language: EditableSourceFileMapping['language'] = '';
    if (role === 'subtitle') {
      language = subtitleLanguage(entry.relativePath);
    }
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

/**
 * 通过逐文件角色与映射完整性校验后构建来源选择请求。
 *
 * @param task - 提供任务修订、媒体类型与合法治理单元的任务快照。
 * @param source - 提供本次选择所属来源标识的来源记录。
 * @param rows - 用户编辑后的逐文件选择、角色、单元、集号与语言映射行。
 * @returns 包含预期修订号、文件选择及角色映射的请求。
 */
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
    const mapping: MediaGovernanceApi.SourceSelectionInput['fileMappings'][number] =
      {
        fileRole: row.fileRole,
        index: row.index,
        unitId: row.unitId,
      };
    if (needsEpisode) mapping.episodeNumber = episodeNumberValue;
    if (row.fileRole === 'subtitle') {
      mapping.language = row.language as MediaGovernanceApi.SubtitleLanguage;
    }
    return [mapping];
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

/**
 * 为补充字幕来源按治理单元生成单一发布组合同计划。
 *
 * @param task - 提供媒体类型与合同覆盖治理单元的任务快照。
 * @param source - 补充字幕来源及其发布组、清单与覆盖季号；其他角色返回空计划。
 * @param selection - 已校验的逐文件来源选择与字幕映射。
 * @returns 按治理单元分组的字幕发布组合同计划；无已选字幕时为空数组。
 */
export function buildLinkedSubtitleContractPlans(
  task: MediaGovernanceApi.Task,
  source: MediaGovernanceApi.Source,
  selection: MediaGovernanceApi.SourceSelectionInput,
) {
  if (source.sourceRole !== 'supplemental_subtitle') {
    return {
      errors: [] as string[],
      plans: [] as LinkedSubtitleContractPlan[],
    };
  }
  const errors: string[] = [];
  const releaseGroup = source.releaseGroup?.trim() ?? '';
  if (!releaseGroup) errors.push('整季字幕来源必须填写发布组');
  const manifestByIndex = new Map(
    source.manifest.map((entry) => [entry.index, entry.relativePath]),
  );
  const coveredUnits = task.units.filter(
    (unit) =>
      task.mediaType !== 'tv' ||
      (unit.seasonNumber !== null &&
        source.seasonNumbers.includes(unit.seasonNumber)),
  );
  const plans = coveredUnits.flatMap((unit) => {
    const subtitleMappings = selection.fileMappings
      .filter((mapping): mapping is ChineseSubtitleMapping => {
        if (mapping.unitId !== unit.id) return false;
        if (mapping.fileRole !== 'subtitle') return false;
        if (mapping.episodeNumber === undefined) return false;
        return mapping.language === 'zh-CN' || mapping.language === 'zh-TW';
      })
      .toSorted((left, right) => {
        if (left.episodeNumber !== right.episodeNumber) {
          return left.episodeNumber - right.episodeNumber;
        }
        if (left.language === 'zh-CN') return -1;
        return 1;
      });
    const uniqueEpisodes = new Map<number, (typeof subtitleMappings)[number]>();
    for (const mapping of subtitleMappings) {
      if (!uniqueEpisodes.has(mapping.episodeNumber)) {
        uniqueEpisodes.set(mapping.episodeNumber, mapping);
      }
    }
    if (uniqueEpisodes.size === 0) {
      errors.push(
        `${unit.seasonNumber ?? '电影单元'} 缺少简体或繁体中文字幕映射`,
      );
      return [];
    }
    const mappings = [...uniqueEpisodes.values()].flatMap((mapping) => {
      const relativePath = manifestByIndex.get(mapping.index);
      if (!relativePath) {
        errors.push(`字幕文件索引 ${mapping.index} 不存在`);
        return [];
      }
      return [{ episodeNumber: mapping.episodeNumber, relativePath }];
    });
    return [
      {
        expectedEpisodeNumbers: mappings.map(
          (mapping) => mapping.episodeNumber,
        ),
        mappings,
        releaseGroup,
        sourceId: source.id,
        unitId: unit.id,
      },
    ];
  });
  return { errors: [...new Set(errors)], plans };
}
