import type { MediaGovernanceApi } from '#/api/media-governance';

export interface MediaGovernanceIntakeForm {
  mediaType: MediaGovernanceApi.MediaType;
  provider: '' | MediaGovernanceApi.Provider;
  providerId: string;
  releaseYear: string;
  seasonText: string;
  titleHint: string;
}

export interface MediaGovernanceTaskIdentityForm {
  provider: '' | MediaGovernanceApi.Provider;
  providerId: string;
  releaseYear: string;
}

const MEDIA_TYPE_LABELS: Record<MediaGovernanceApi.MediaType, string> = {
  movie: 'Movie 电影',
  theatrical: 'Theatrical 剧场版',
  tv: 'TV 正常剧集',
};
const PROVIDER_LABELS: Record<MediaGovernanceApi.Provider, string> = {
  bangumi: 'Bangumi',
  tmdb: 'TMDB',
  tvdb: 'TVDB',
};

/**
 * 将季号文本拆分、去重并升序排列，只保留正整数。
 *
 * @param value - 逗号分隔的季号文本或已填写的季号值。
 * @returns 去除空项、转为大写并升序排列的季号数组。
 */
export function parseSeasonNumbers(value: string) {
  return value
    .split(/[\s,，]+/)
    .map((season) => season.trim().toUpperCase())
    .filter(Boolean)
    .toSorted();
}

/**
 * 通过媒体类型、季号和资料库身份约束校验任务接收表单。
 *
 * @param form - 需要校验或投影为请求载荷的媒体治理接收表单。
 * @returns 表单违反作品类型、季号或资料库身份约束的错误文本数组；有效时为空数组。
 */
export function validateIntakeForm(form: MediaGovernanceIntakeForm) {
  const errors: string[] = [];
  const seasons = parseSeasonNumbers(form.seasonText);
  if (!form.titleHint.trim()) errors.push('必须填写作品名');
  if (form.mediaType === 'tv') {
    if (seasons.length === 0) errors.push('TV 正常剧集必须至少填写一个季号');
    if (seasons.some((season) => !/^S\d{2}$/.test(season))) {
      errors.push('季号必须使用 S00、S01 这类两位数字格式');
    }
    if (new Set(seasons).size !== seasons.length) {
      errors.push('同一季号不能重复填写');
    }
  } else if (seasons.length > 0) {
    errors.push('电影或剧场版不填写季号，也不能使用 S00 代替作品类型');
  }

  if (form.provider && !form.providerId.trim()) {
    errors.push('选择媒体资料库后必须填写对应作品编号');
  } else if (!form.provider && form.providerId.trim()) {
    errors.push('填写作品编号前必须先选择媒体资料库');
  } else if (
    form.providerId.trim() &&
    !/^[A-Z\d][\w.:-]{0,63}$/i.test(form.providerId.trim())
  ) {
    errors.push('媒体资料库编号格式不正确');
  }

  if (form.releaseYear.trim()) {
    const currentMaximum = new Date().getFullYear() + 2;
    const year = Number(form.releaseYear);
    if (
      !/^\d{4}$/.test(form.releaseYear) ||
      year < 1888 ||
      year > currentMaximum
    ) {
      errors.push('首播/上映年份应为 1888 至当前年份后 2 年之间的四位数字');
    }
  }
  return errors;
}

/**
 * 通过资料库类型、标识与可选发行年份约束校验身份表单。
 *
 * @param form - 需要校验或投影为请求载荷的媒体治理接收表单。
 * @returns 资料库身份与发行年份错误文本数组；有效时为空数组。
 */
export function validateTaskIdentityForm(
  form: MediaGovernanceTaskIdentityForm,
) {
  const errors: string[] = [];
  if (!form.provider || !form.providerId.trim()) {
    errors.push('必须选择媒体资料库并填写对应作品编号');
  } else if (!/^[A-Z\d][\w.:-]{0,63}$/i.test(form.providerId.trim())) {
    errors.push('媒体资料库编号格式不正确');
  }
  if (form.releaseYear.trim()) {
    const currentMaximum = new Date().getFullYear() + 2;
    const year = Number(form.releaseYear);
    if (
      !/^\d{4}$/.test(form.releaseYear) ||
      year < 1888 ||
      year > currentMaximum
    ) {
      errors.push('首播/上映年份应为 1888 至当前年份后 2 年之间的四位数字');
    }
  }
  return errors;
}

/**
 * 将已校验表单投影为带任务版本的身份更新请求。
 *
 * @param form - 需要校验或投影为请求载荷的媒体治理接收表单。
 * @param expectedRevision - 调用方已读取的任务修订号；服务端用它拒绝过期写入。
 * @returns 包含预期修订号及规范身份字段的更新请求。
 */
export function buildUpdateTaskIdentityInput(
  form: MediaGovernanceIntakeForm,
  expectedRevision: number,
): MediaGovernanceApi.UpdateTaskIdentityInput {
  const input: MediaGovernanceApi.UpdateTaskIdentityInput = {
    expectedRevision,
    mediaType: form.mediaType,
    providerRef: null,
    releaseYear: null,
    seasonNumbers: [],
    titleHint: form.titleHint.trim(),
  };
  if (form.provider && form.providerId.trim()) {
    input.providerRef = {
      provider: form.provider,
      providerId: form.providerId.trim(),
    };
  }
  if (form.releaseYear.trim()) input.releaseYear = Number(form.releaseYear);
  if (form.mediaType === 'tv') {
    input.seasonNumbers = parseSeasonNumbers(form.seasonText);
  }
  return input;
}

/**
 * 将已校验表单投影为新建任务请求。
 *
 * @param form - 需要校验或投影为请求载荷的媒体治理接收表单。
 * @returns 仅包含已填写且适用于媒体类型字段的新建任务请求。
 */
export function buildCreateTaskInput(
  form: MediaGovernanceIntakeForm,
): MediaGovernanceApi.CreateTaskInput {
  const input: MediaGovernanceApi.CreateTaskInput = {
    mediaType: form.mediaType,
    titleHint: form.titleHint.trim(),
  };
  const seasonNumbers = parseSeasonNumbers(form.seasonText);
  if (form.mediaType === 'tv' && seasonNumbers.length > 0) {
    input.seasonNumbers = seasonNumbers;
  }
  if (form.releaseYear.trim()) input.releaseYear = Number(form.releaseYear);
  if (form.provider && form.providerId.trim()) {
    input.providerRef = {
      provider: form.provider,
      providerId: form.providerId.trim(),
    };
  }
  return input;
}

/**
 * 将表单草稿生成人工可读的候选身份预览。
 *
 * @param form - 需要校验或投影为请求载荷的媒体治理接收表单。
 * @returns 由作品名、类型、季号、年份与资料库身份组成的可读预览文本。
 */
export function buildIdentityPreview(form: MediaGovernanceIntakeForm) {
  const seasons = parseSeasonNumbers(form.seasonText);
  let seasonLabel = '电影单元（不使用 S00）';
  if (form.mediaType === 'tv') {
    seasonLabel = seasons.join('、') || '尚未填写季号';
  }
  let releaseYearLabel = '年份待核验';
  if (form.releaseYear.trim()) {
    releaseYearLabel = `${form.releaseYear.trim()} 年`;
  }
  let providerLabel = '资料库编号待核验';
  if (form.provider && form.providerId.trim()) {
    providerLabel = `${PROVIDER_LABELS[form.provider]} · ${form.providerId.trim()}`;
  }
  const parts = [
    form.titleHint.trim() || '尚未填写作品名',
    MEDIA_TYPE_LABELS[form.mediaType],
    seasonLabel,
    releaseYearLabel,
    providerLabel,
    '待资料源核验',
  ];
  return parts.join(' · ');
}
