import type { WordpressBlogApi } from '#/api/blog';

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
  /**
   * Wires the current article route id to a full-bleed Blog Web iframe preview.
   */
  setup() {
    const route = useRoute();
    const router = useRouter();
    const article = ref<null | WordpressBlogApi.Article>(null);
    const errorMessage = ref('');
    const state = ref<PreviewState>('loading');
    const routeArticleId = computed(() =>
      normalizeRouteParam(route.params.articleId),
    );
    const previewTitle = computed(
      () => getArticleTitle(article.value) || '文章预览',
    );
    const iframeUrl = computed(() =>
      article.value
        ? buildKtBlogPreviewUrl(article.value, routeArticleId.value)
        : '',
    );
    const iframeHost = computed(() => getPreviewHost(iframeUrl.value));
    const statusMeta = computed(() => getStatusMeta(state.value));
    const articleStatusMeta = computed(() =>
      getArticleStatusMeta(article.value?.status),
    );
    const primaryStatusMeta = computed(() =>
      article.value ? articleStatusMeta.value : statusMeta.value,
    );

    watch(
      routeArticleId,
      () => {
        void loadArticlePreview();
      },
      { immediate: true },
    );

    /**
     * Navigates back to the Blog article list.
     */
    function goBack() {
      void router.push({ name: 'BlogArticle' });
    }

    /**
     * Opens the current public KT Blog Web preview in a browser tab for direct inspection.
     */
    function openPreviewInNewWindow() {
      if (!iframeUrl.value) {
        return;
      }

      window.open(iframeUrl.value, '_blank', 'noopener,noreferrer');
    }

    /**
     * Reloads the article detail and rebuilds the iframe URL for the current route id.
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
        errorMessage.value =
          error instanceof Error ? error.message : '文章预览加载失败';
      }
    }

    /**
     * Renders the floating status card without taking layout space from the preview iframe.
     *
     * @returns Overlay card with article metadata and navigation actions.
     */
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
            {routeArticleId.value ? (
              <span>ID：{routeArticleId.value}</span>
            ) : null}
            {iframeHost.value ? <span>Host：{iframeHost.value}</span> : null}
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

    /**
     * Renders loading, error, and ready iframe states inside the fixed preview canvas.
     *
     * @returns Current preview body content.
     */
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
              message={errorMessage.value || '文章预览加载失败'}
              showIcon
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

    /**
     * Renders the stable page root required by Vben route transitions.
     *
     * @returns Single-root preview page shell.
     */
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
 * @param value Raw vue-router route param value.
 * @returns A single trimmed article id string.
 */
function normalizeRouteParam(value: unknown) {
  if (Array.isArray(value)) return `${value[0] || ''}`.trim();
  return `${value || ''}`.trim();
}

/**
 * @param article Blog article detail returned by the Admin API.
 * @returns Plain article title for metadata and iframe title attributes.
 */
function getArticleTitle(article?: null | WordpressBlogApi.Article) {
  const value = article?.title;
  if (typeof value === 'string') return stripHtml(value);

  return stripHtml(value?.raw || value?.rendered || '');
}

/**
 * @param previewUrl Iframe URL built from the KT Blog Web base URL.
 * @returns Host shown in the floating card so operators can verify the embedded target.
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
 * @param value HTML-ish rendered text from WordPress-compatible article fields.
 * @returns Plain text safe for compact Admin metadata.
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
 * @param state Current preview page lifecycle state.
 * @returns Ant Design tag color and Chinese label for the floating card.
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
 * @param status Article publish status returned by the Admin API.
 * @returns Ant Design tag color and Chinese label for article metadata.
 */
function getArticleStatusMeta(status?: string) {
  return (
    articleStatusOptions.find((item) => item.value === status) ||
    articleStatusOptions[1]
  );
}
