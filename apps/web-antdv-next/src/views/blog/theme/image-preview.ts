const legacyImages: Record<string, string> = {
  '/argon/theme/profile.jpg': 'blog-assets/avatar-tsukasa-1.jpg',
  '/argon/theme/img-1-1200x1000.jpg': 'blog-assets/bg-donggungun.png',
  '/argon/theme/img-2-1200x1000.jpg': 'blog-assets/bg-donggungun.png',
  '/argon/theme/landing.jpg': 'blog-assets/bg-donggungun.png',
  '/argon/theme/promo-1.png': 'blog-assets/bg-donggungun.png',
};

/**
 * 将旧 Argon 资源映射到博客静态图片，仅修正回显地址而不改变配置原值。
 * @param value - 配置保存的图片地址，允许历史 CSS 图片包裹。
 * @param blogBase - 已解析的博客部署基地址。
 * @param adminOrigin - 管理端来源，用于同源 API 图片地址。
 * @returns 可用于图片回显的 HTTP 地址，无效或临时资源地址返回空串。
 */
export function resolveThemeImagePreview(
  value: unknown,
  blogBase: string,
  adminOrigin: string,
) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  const wrapped = /^url\((.*)\)$/i.exec(normalized)?.[1]?.trim();
  let source = normalized;
  if (wrapped) source = wrapped.replaceAll(/^['"]|['"]$/g, '');
  if (!source) return '';
  try {
    let base = blogBase;
    if (source.startsWith('/api/')) base = adminOrigin;
    const url = new URL(source, base);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const legacy = legacyImages[url.pathname];
    if (legacy) return new URL(legacy, blogBase).href;
    return url.href;
  } catch {
    return '';
  }
}
