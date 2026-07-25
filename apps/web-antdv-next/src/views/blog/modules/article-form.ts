import type { VbenFormSchema } from '#/adapter/form';
import type { WordpressBlogApi } from '#/api/blog';

export type BlogArticleEditorMode = 'html-rich' | 'html-source' | 'markdown';
export type BlogArticleContentFormat = 'html' | 'markdown';
export type BlogArticleFormValues = WordpressBlogApi.ArticleBody & {
  editorMode?: BlogArticleEditorMode;
};

export const BLOG_ARTICLE_FORM_CLASS = 'blog-article-form';
export const BLOG_ARTICLE_MODAL_CLASS = 'blog-article-modal';
export const BLOG_ARTICLE_MODAL_CONTENT_CLASS = 'blog-article-modal__content';
export const BLOG_ARTICLE_CONTENT_FIELD_CLASS = 'blog-article-form__content';
export const BLOG_ARTICLE_HTML_RICH_CLASS = 'blog-article-form__html-rich';
export const BLOG_ARTICLE_HTML_TEXTAREA_CLASS =
  'blog-article-form__html-source';
export const BLOG_ARTICLE_MARKDOWN_MIN_HEIGHT = 560;

const ARGON_BASE_CODEBLOCK_PATTERN = /\b(?:wp-block-code|hljs-codeblock)\b/;
const SOURCE_ONLY_HTML_PATTERN =
  /\b(?:hljs-ln|hljs-control|fancybox-wrapper|lazyload|collapse-block|wp-block-(?!code\b)[\w-]+)/;
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

export function createBlogArticleContentSchema(
  mode: BlogArticleEditorMode,
  markdownEditor: unknown,
  richHtmlEditor?: unknown,
): VbenFormSchema {
  const common = {
    fieldName: 'content',
    formItemClass: BLOG_ARTICLE_CONTENT_FIELD_CLASS,
    label: '内容',
  };

  if (mode === 'html-source') {
    return {
      ...common,
      component: 'Textarea',
      componentProps: {
        autoSize: { maxRows: 30, minRows: 18 },
        class: BLOG_ARTICLE_HTML_TEXTAREA_CLASS,
        placeholder: '保留 WordPress / Argon HTML 原文，保存时仅做安全清洗',
      },
      controlClass: 'w-full',
      wrapperClass: 'items-stretch',
    } as VbenFormSchema;
  }

  if (mode === 'html-rich') {
    return {
      ...common,
      component: richHtmlEditor as VbenFormSchema['component'],
      componentProps: {
        class: BLOG_ARTICLE_HTML_RICH_CLASS,
        minHeight: BLOG_ARTICLE_MARKDOWN_MIN_HEIGHT,
        placeholder: '请输入 HTML 富文本正文',
      },
      controlClass: 'w-full',
      wrapperClass: 'items-stretch',
    } as VbenFormSchema;
  }

  return {
    ...common,
    component: markdownEditor as VbenFormSchema['component'],
    componentProps: {
      minHeight: BLOG_ARTICLE_MARKDOWN_MIN_HEIGHT,
      placeholder: '请输入 Markdown 正文',
    },
    controlClass: 'w-full',
    wrapperClass: 'items-stretch',
  } as VbenFormSchema;
}

export function createBlogArticleEditorModeSchema(
  onChange?: (mode: BlogArticleEditorMode) => void,
): VbenFormSchema {
  return {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      onChange: (event: { target?: { value?: BlogArticleEditorMode } }) => {
        const mode = event?.target?.value;
        if (mode) onChange?.(mode);
      },
      options: [
        { label: 'Markdown', value: 'markdown' },
        { label: '富文本 HTML', value: 'html-rich' },
        { label: '源码 HTML', value: 'html-source' },
      ],
      optionType: 'button',
    },
    fieldName: 'editorMode',
    label: '编辑模式',
  } as VbenFormSchema;
}

export function getContentFormatForEditorMode(
  mode: BlogArticleEditorMode,
): BlogArticleContentFormat {
  return mode === 'markdown' ? 'markdown' : 'html';
}

export function getBlogArticleEditorMode(
  article?: Partial<WordpressBlogApi.Article>,
): BlogArticleEditorMode {
  const html = getRenderedValue(article?.contentHtml || article?.content);
  if (!html) return 'markdown';
  if (SOURCE_ONLY_HTML_PATTERN.test(html)) return 'html-source';
  if (hasMarkdownSource(article)) return 'markdown';
  if (ARGON_BASE_CODEBLOCK_PATTERN.test(html)) return 'html-source';
  return HTML_TAG_PATTERN.test(html) ? 'html-rich' : 'markdown';
}

export function getBlogArticleContentFormat(
  article?: Partial<WordpressBlogApi.Article>,
): BlogArticleContentFormat {
  return getContentFormatForEditorMode(getBlogArticleEditorMode(article));
}

export function getBlogArticleCreateFormDefaults(
  searchValues: {
    categories?: string[];
    tags?: string[];
  } = {},
): BlogArticleFormValues {
  return {
    categories: [...(searchValues.categories || [])],
    content: '',
    contentFormat: 'markdown',
    editorMode: 'markdown',
    excerpt: '',
    slug: '',
    status: 'draft',
    sticky: false,
    tags: [...(searchValues.tags || [])],
    title: '',
  };
}

export function getBlogArticleEditFormValues(
  row: WordpressBlogApi.Article,
): BlogArticleFormValues {
  const editorMode = getBlogArticleEditorMode(row);
  const contentFormat = getContentFormatForEditorMode(editorMode);

  return {
    categories: row.categories || [],
    content:
      contentFormat === 'html'
        ? getRenderedValue(row.contentHtml || row.content)
        : getEditableMarkdown(row.content, row.contentMarkdown),
    contentFormat,
    editorMode,
    excerpt: getRenderedText(row.excerpt),
    id: row.id,
    slug: row.slug || '',
    status: row.status || 'draft',
    sticky: !!row.sticky,
    tags: row.tags || [],
    title: getRenderedText(row.title),
  };
}

export function buildBlogArticleSubmitPayload(
  values: BlogArticleFormValues,
  editingId: string | undefined,
  editorMode: BlogArticleEditorMode,
): WordpressBlogApi.ArticleBody {
  const { editorMode: _editorMode, ...payloadValues } = values;
  return {
    ...payloadValues,
    contentFormat: getContentFormatForEditorMode(editorMode),
    id: editingId,
    title: values.title?.trim() || '',
  };
}

export function getRenderedText(
  value?: string | WordpressBlogApi.RenderedField,
) {
  return stripHtml(getRenderedValue(value));
}

function getRenderedValue(value?: string | WordpressBlogApi.RenderedField) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.raw || value.rendered || '';
}

function hasMarkdownSource(article?: Partial<WordpressBlogApi.Article>) {
  return !!article?.contentMarkdown?.trim();
}

function getEditableMarkdown(
  value?: string | WordpressBlogApi.RenderedField,
  markdown?: string,
) {
  if (markdown) return markdown;
  return getRenderedValue(value);
}

function stripHtml(value: string) {
  return value
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll('&nbsp;', ' ')
    .trim();
}
