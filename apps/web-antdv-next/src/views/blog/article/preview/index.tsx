import type { BlogApi } from '#/api/blog';

import { computed, defineComponent, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ArrowLeft } from '@vben/icons';

import { Alert, Button, Space, Spin, Tag } from 'antdv-next';

import { buildKtBlogPreviewUrl, getArticleDetail } from '#/api/blog';

import './index.scss';

type PreviewState = 'error' | 'loading' | 'ready';

const AAlert = Alert as any;
const AButton = Button as any;
const ASpace = Space as any;
const ASpin = Spin as any;
const ATag = Tag as any;
const articleStatusOptions = [
  { color: 'success', label: '已发布', value: 'publish' },
  { color: 'default', label: '草稿', value: 'draft' },
  { color: 'warning', label: '待审核', value: 'pending' },
  { color: 'processing', label: '私有', value: 'private' },
] as const;

export default defineComponent({
  name: 'BlogArticlePreview',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const article = ref<BlogApi.Article | null>(null);
    const errorMessage = ref('');
    const state = ref<PreviewState>('loading');
    const routeArticleId = computed(() =>
      normalizeRouteParam(route.params.articleId),
    );
    const previewTitle = computed(
      () => getArticleTitle(article.value) || '文章预览',
    );
    const iframeUrl = computed(() => {
      if (article.value) {
        return buildKtBlogPreviewUrl(article.value, routeArticleId.value);
      }
      return '';
    });
    const iframeHost = computed(() => getPreviewHost(iframeUrl.value));
    const statusMeta = computed(() => getStatusMeta(state.value));
    const articleStatusMeta = computed(() =>
      getArticleStatusMeta(article.value?.status),
    );
    const primaryStatusMeta = computed(() => {
      if (article.value) {
        return articleStatusMeta.value;
      }
      return statusMeta.value;
    });

    watch(
      routeArticleId,
      () => {
        void loadArticlePreview();
      },
      { immediate: true },
    );

    /**
     * 根据浏览器历史优先返回来源页面；没有可用记录时跳转到模块默认列表页。
     */
    function goBack() {
      void router.push({ name: 'BlogArticle' });
    }

    /**
     * 仅在文章预览地址非空时通过隔离的新窗口打开 iframe 页面。
     */
    function openPreviewInNewWindow() {
      if (!iframeUrl.value) {
        return;
      }

      window.open(iframeUrl.value, '_blank', 'noopener,noreferrer');
    }

    /**
     * 按路由文章标识加载预览内容，并明确维护加载、就绪或错误状态；缺少标识时直接显示错误。
     */
    async function loadArticlePreview() {
      const articleId = routeArticleId.value;
      article.value = null;
      errorMessage.value = '';

      if (!articleId) {
        state.value = 'error';
        errorMessage.value = '缺少文章 ID';
        return;
      }

      state.value = 'loading';

      try {
        article.value = await getArticleDetail(articleId);
        state.value = 'ready';
      } catch (error) {
        state.value = 'error';
        if (error instanceof Error) {
          errorMessage.value = error.message;
        } else {
          errorMessage.value = '文章预览加载失败';
        }
      }
    }

    const renderFloatingCard = () => {
      return (
        <div class="blog-article-preview__floating-card">
          <div class="blog-article-preview__floating-head">
            <span class="blog-article-preview__floating-title">
              {previewTitle.value}
            </span>
            <ATag color={primaryStatusMeta.value.color}>
              {primaryStatusMeta.value.label}
            </ATag>
          </div>
          <div class="blog-article-preview__floating-meta">
            <span>文章预览</span>
            <span>运行态：{statusMeta.value.label}</span>
            {(() => {
              if (routeArticleId.value) {
                return <span>ID：{routeArticleId.value}</span>;
              }
              return null;
            })()}
            {(() => {
              if (iframeHost.value) {
                return <span>Host：{iframeHost.value}</span>;
              }
              return null;
            })()}
          </div>
          <ASpace class="blog-article-preview__floating-actions" size={6}>
            <AButton onClick={goBack} size="small" type="text">
              <ArrowLeft class="blog-article-preview__back-icon" />
              返回
            </AButton>
            <AButton
              disabled={state.value === 'loading'}
              onClick={loadArticlePreview}
              size="small"
            >
              刷新
            </AButton>
            <AButton
              data-testid="blog-preview-open"
              disabled={state.value !== 'ready' || !iframeUrl.value}
              onClick={openPreviewInNewWindow}
              size="small"
            >
              新窗口
            </AButton>
          </ASpace>
        </div>
      );
    };

    const renderBody = () => {
      if (state.value === 'ready' && iframeUrl.value) {
        return (
          <div class="blog-article-preview__iframe-shell">
            <iframe
              class="blog-article-preview__iframe"
              src={iframeUrl.value}
              title={`文章预览 ${previewTitle.value}`}
            />
          </div>
        );
      }

      if (state.value === 'error') {
        return (
          <div class="blog-article-preview__message">
            <AAlert
              showIcon
              title={errorMessage.value || '文章预览加载失败'}
              type="error"
            />
            <AButton onClick={loadArticlePreview} type="primary">
              重新加载
            </AButton>
          </div>
        );
      }

      return (
        <div class="blog-article-preview__center">
          <ASpin spinning />
        </div>
      );
    };

    const renderPage = () => {
      return (
        <div class="blog-article-preview-page">
          <div class="blog-article-preview">
            <div class="blog-article-preview__content">{renderBody()}</div>
            {renderFloatingCard()}
          </div>
        </div>
      );
    };

    return renderPage;
  },
});

/**
 * 把路由参数数组或标量归一为去除两端空白的单个字符串。
 *
 * @param value - 文章路由参数的字符串、字符串数组或空值；数组只读取首项。
 * @returns 去除两端空白的首个路由参数字符串；参数缺失时为空字符串。
 */
function normalizeRouteParam(value: unknown) {
  if (Array.isArray(value)) return `${value[0] || ''}`.trim();
  return `${value || ''}`.trim();
}

/**
 * 优先读取文章标题，缺失时使用“未命名文章”作为预览标题。
 *
 * @param article - 提供预览标题的文章记录；可为空。
 * @returns 去除 HTML 后的文章标题；标题缺失时返回“未命名文章”。
 */
function getArticleTitle(article?: BlogApi.Article | null) {
  const value = article?.title;
  if (typeof value === 'string') return stripHtml(value);

  return stripHtml(value?.raw || value?.rendered || '');
}

/**
 * 从博客基础地址提取预览主机名，地址无效时返回原始配置文本。
 *
 * @param previewUrl - 待提取主机名的博客预览 URL；非法地址会按原文本回退。
 * @returns 博客预览地址的主机名；地址非法时为原始配置文本。
 */
function getPreviewHost(previewUrl: string) {
  if (!previewUrl) {
    return '';
  }

  try {
    const url = new URL(previewUrl, window.location.origin);
    return url.host || url.pathname;
  } catch {
    return '';
  }
}

/**
 * 移除 HTML 标签并还原常见实体，返回适合摘要展示的纯文本。
 *
 * @param value - 需要去除标签并解码实体的文章 HTML。
 * @returns 去除标签并压缩空白后的纯文本。
 */
function stripHtml(value: string) {
  return value
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

/**
 * 将预览加载阶段映射为异常、加载中或已就绪的标签颜色。
 *
 * @param state - 文章预览当前的 loading、ready 或 error 加载阶段。
 * @returns 包含展示标签、颜色与说明的将预览加载阶段映射为异常、加载中或已就绪的标签颜色。
 */
function getStatusMeta(state: PreviewState) {
  const statusMap = {
    error: { color: 'error', label: '异常' },
    loading: { color: 'processing', label: '加载中' },
    ready: { color: 'success', label: '已就绪' },
  } as const;

  return statusMap[state];
}

/**
 * 将文章发布状态映射为标签和颜色，未知状态按草稿展示。
 *
 * @param status - 文章发布状态；未知或缺省值按草稿展示。
 * @returns 包含展示标签、颜色与说明的将文章发布状态映射为标签和颜色，未知状态按草稿展示。
 */
function getArticleStatusMeta(status?: string) {
  return (
    articleStatusOptions.find((item) => item.value === status) ||
    articleStatusOptions[1]
  );
}
