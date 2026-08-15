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

export function parseSeasonNumbers(value: string) {
  return value
    .split(/[\s,，]+/)
    .map((season) => season.trim().toUpperCase())
    .filter(Boolean)
    .toSorted();
}

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

export function buildCreateTaskInput(
  form: MediaGovernanceIntakeForm,
): MediaGovernanceApi.CreateTaskInput {
  const input: MediaGovernanceApi.CreateTaskInput = {
    mediaType: form.mediaType,
    titleHint: form.titleHint.trim(),
  };
  const seasonNumbers = parseSeasonNumbers(form.seasonText);
  if (seasonNumbers.length > 0) input.seasonNumbers = seasonNumbers;
  if (form.releaseYear.trim()) input.releaseYear = Number(form.releaseYear);
  if (form.provider && form.providerId.trim()) {
    input.providerRef = {
      provider: form.provider,
      providerId: form.providerId.trim(),
    };
  }
  return input;
}

export function buildIdentityPreview(form: MediaGovernanceIntakeForm) {
  const seasons = parseSeasonNumbers(form.seasonText);
  const parts = [
    form.titleHint.trim() || '尚未填写作品名',
    MEDIA_TYPE_LABELS[form.mediaType],
    form.mediaType === 'tv'
      ? seasons.join('、') || '尚未填写季号'
      : '电影单元（不使用 S00）',
    form.releaseYear.trim() ? `${form.releaseYear.trim()} 年` : '年份待核验',
    form.provider && form.providerId.trim()
      ? `${PROVIDER_LABELS[form.provider]} · ${form.providerId.trim()}`
      : '资料库编号待核验',
    '待资料源核验',
  ];
  return parts.join(' · ');
}
