const LOCAL_BLOG_WEB_BASE_URL = 'http://127.0.0.1:5173/';

type BlogPreviewArticle = {
  id?: string;
  slug?: string;
};

type BlogPreviewEnv = {
  PROD?: boolean;
  VITE_KT_BLOG_WEB_BASE_URL?: string;
};

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

export function resolveKtBlogWebBaseUrl(
  env: BlogPreviewEnv,
  currentOrigin = window.location.origin,
) {
  const configured = env.VITE_KT_BLOG_WEB_BASE_URL?.trim();
  if (configured) {
    return new URL(configured, currentOrigin).toString();
  }

  if (env.PROD) {
    throw new Error('VITE_KT_BLOG_WEB_BASE_URL is required in production');
  }

  return LOCAL_BLOG_WEB_BASE_URL;
}
