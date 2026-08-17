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
 * 把文章标识和编辑内容编码到博客预览地址，供新窗口展示未发布内容。
 *
 * @param article - 要编码进预览载荷的文章标题、正文与内容格式。
 * @param articleId - 用于构建未发布文章预览地址的文章唯一标识。
 * @returns 携带文章标识与预览内容的博客站点 URL。
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
 * 从环境配置解析博客地址；开发环境缺失配置时回退到本地站点地址。
 *
 * @param env - 包含博客地址与生产模式标志的前端环境变量。
 * @param currentOrigin - 用于解析相对地址的当前页面来源；未传入时使用 `window.location.origin`。
 * @returns 去除尾部斜杠的博客站点基础地址；开发环境缺省时为本地地址。
 * @throws 生产环境未配置博客站点基础地址时抛出。
 */
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
