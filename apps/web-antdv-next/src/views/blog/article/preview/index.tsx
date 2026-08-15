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

    function goBack() {
      void router.push({ name: 'BlogArticle' });
    }

    function openPreviewInNewWindow() {
      if (!iframeUrl.value) {
        return;
      }

      window.open(iframeUrl.value, '_blank', 'noopener,noreferrer');
    }

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

function normalizeRouteParam(value: unknown) {
  if (Array.isArray(value)) return `${value[0] || ''}`.trim();
  return `${value || ''}`.trim();
}

function getArticleTitle(article?: BlogApi.Article | null) {
  const value = article?.title;
  if (typeof value === 'string') return stripHtml(value);

  return stripHtml(value?.raw || value?.rendered || '');
}

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

function stripHtml(value: string) {
  return value
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function getStatusMeta(state: PreviewState) {
  const statusMap = {
    error: { color: 'error', label: '异常' },
    loading: { color: 'processing', label: '加载中' },
    ready: { color: 'success', label: '已就绪' },
  } as const;

  return statusMap[state];
}

function getArticleStatusMeta(status?: string) {
  return (
    articleStatusOptions.find((item) => item.value === status) ||
    articleStatusOptions[1]
  );
}
