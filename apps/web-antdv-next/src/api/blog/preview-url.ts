const LOCAL_BLOG_WEB_BASE_URL = 'http://127.0.0.1:5173/';

type BlogPreviewArticle = {
  id?: string;
  slug?: string;
};

type BlogPreviewEnv = {
  PROD?: boolean;
  VITE_KT_BLOG_WEB_BASE_URL?: string;
};

/**
 * Builds the public KT Blog Web URL used by the Admin preview iframe.
 * @param article Article data whose slug is the preferred public post route key.
 * @param articleId Admin article id retained in the query string for preview traceability.
 * @returns Absolute or same-origin iframe URL for the KT Blog Web post route.
 */
export function buildKtBlogPreviewUrl(
  article: BlogPreviewArticle,
  articleId: string,
) {
  const origin = resolveKtBlogWebBaseUrl(import.meta.env);
  const url = new URL(origin, window.location.origin);
  const slugOrId = article.slug || article.id || articleId;
  const params = new URLSearchParams({
    adminPreview: '1',
    articleId,
  });

  url.hash = `/post/${encodeURIComponent(slugOrId)}?${params.toString()}`;

  return url.toString();
}

/**
 * Resolves the Blog Web preview origin and refuses silent localhost fallback in production.
 * @param env Vite import meta environment; tests pass a small object to cover production guards.
 * @returns Configured Blog Web base URL, or the local development default outside production.
 */
export function resolveKtBlogWebBaseUrl(env: BlogPreviewEnv) {
  const configured = env.VITE_KT_BLOG_WEB_BASE_URL?.trim();
  if (configured) {
    return configured;
  }

  if (env.PROD) {
    throw new Error('VITE_KT_BLOG_WEB_BASE_URL is required in production');
  }

  return LOCAL_BLOG_WEB_BASE_URL;
}
