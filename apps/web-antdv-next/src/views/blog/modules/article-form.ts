import type { VbenFormSchema } from '#/adapter/form';
import type { BlogApi } from '#/api/blog';

export type BlogArticleEditorMode = 'html-rich' | 'html-source' | 'markdown';
export type BlogArticleContentFormat = 'html' | 'markdown';
export type BlogArticleFormValues = BlogApi.ArticleBody & {
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

/**
 * 按编辑器模式生成文章内容字段 Schema，并绑定对应编辑器适配器。
 *
 * @param mode - 文章内容使用的 Markdown、富文本或源码 HTML 编辑模式。
 * @param markdownEditor - 用于读写 Markdown 内容的编辑器适配器。
 * @param richHtmlEditor - 用于读写富 HTML 内容的编辑器适配器。
 * @returns 与所选编辑模式匹配、并绑定对应编辑器的文章内容字段配置。
 */
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

/**
 * 生成文章编辑模式单选字段，并把有效模式变更转交给调用方回调。
 *
 * @param onChange - 用户切换 Markdown 或富文本模式后接收新模式的回调。
 * @returns 可直接加入 Vben 表单的文章编辑模式字段配置。
 */
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

/**
 * 把文章编辑器模式映射为后端内容格式，Markdown 与富文本分别返回固定枚举。
 *
 * @param mode - 文章内容使用的 Markdown、富文本或源码 HTML 编辑模式。
 * @returns Markdown 模式返回 `markdown`，富文本模式返回对应 HTML 格式。
 */
export function getContentFormatForEditorMode(
  mode: BlogArticleEditorMode,
): BlogArticleContentFormat {
  if (mode === 'markdown') {
    return 'markdown';
  }
  return 'html';
}

/**
 * 根据文章内容格式选择 Markdown 或富文本编辑器，未知格式回退到富文本。
 *
 * @param article - 提供已保存内容格式的文章记录；缺失时使用富文本模式。
 * @returns 文章应使用的 Markdown 或富文本编辑模式，未知格式回退为富文本。
 */
export function getBlogArticleEditorMode(
  article?: Partial<BlogApi.Article>,
): BlogArticleEditorMode {
  const html = getRenderedValue(article?.contentHtml || article?.content);
  if (!html) return 'markdown';
  if (SOURCE_ONLY_HTML_PATTERN.test(html)) return 'html-source';
  if (hasMarkdownSource(article)) return 'markdown';
  if (ARGON_BASE_CODEBLOCK_PATTERN.test(html)) return 'html-source';
  if (HTML_TAG_PATTERN.test(html)) {
    return 'html-rich';
  }
  return 'markdown';
}

/**
 * 读取文章保存的内容格式，旧数据缺失时依据可用源码推断格式。
 *
 * @param article - 提供显式内容格式及可用于旧数据推断的源码字段的文章记录。
 * @returns 文章明确保存或根据源码推断出的内容格式。
 */
export function getBlogArticleContentFormat(
  article?: Partial<BlogApi.Article>,
): BlogArticleContentFormat {
  return getContentFormatForEditorMode(getBlogArticleEditorMode(article));
}

/**
 * 根据文章列表搜索条件生成新建表单初值，并固定默认编辑模式与发布状态。
 *
 * @param searchValues - 用于预填新建表单的文章搜索条件；未传入时使用 `{}`。
 * @returns 包含默认 Markdown 模式、草稿状态及可选分类标签预填值的新建表单数据。
 */
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

/**
 * 把文章详情转换为编辑表单值，同时补齐分类、标签与编辑器内容。
 *
 * @param row - 需要转换为编辑器、分类和标签表单字段的文章详情。
 * @returns 由文章详情转换出的编辑表单值，包含分类、标签与匹配编辑器的内容。
 */
export function getBlogArticleEditFormValues(
  row: BlogApi.Article,
): BlogArticleFormValues {
  const editorMode = getBlogArticleEditorMode(row);
  const contentFormat = getContentFormatForEditorMode(editorMode);

  return {
    categories: row.categories || [],
    content: (() => {
      if (contentFormat === 'html') {
        return getRenderedValue(row.contentHtml || row.content);
      }
      return getEditableMarkdown(row.content, row.contentMarkdown);
    })(),
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

/**
 * 从文章表单提取可提交字段，补齐内容格式、编辑标识并清理标题两端空白。
 *
 * @param values - 文章表单的标题、正文、编辑器模式、分类、标签和发布状态字段。
 * @param editingId - 当前编辑文章的唯一标识；新建文章时为 undefined。
 * @param editorMode - 文章编辑器当前使用的 Markdown 或富文本模式。
 * @returns 包含内容格式和编辑标识的文章提交载荷，不包含仅供前端使用的编辑器模式字段。
 */
export function buildBlogArticleSubmitPayload(
  values: BlogArticleFormValues,
  editingId: string | undefined,
  editorMode: BlogArticleEditorMode,
): BlogApi.ArticleBody {
  const { editorMode: _editorMode, ...payloadValues } = values;
  return {
    ...payloadValues,
    contentFormat: getContentFormatForEditorMode(editorMode),
    id: editingId,
    title: values.title?.trim() || '',
  };
}

/**
 * 把富文本内容移除标签并解码实体，生成可切换到 Markdown 编辑器的纯文本。
 *
 * @param value - 需要移除 HTML 标签并解码实体的文章展示内容。
 * @returns 去除 HTML 标签并解码实体后的纯文本。
 */
export function getRenderedText(value?: BlogApi.RenderedField | string) {
  return stripHtml(getRenderedValue(value));
}

/**
 * 根据文章内容格式选择 HTML 渲染值，Markdown 输入先转换后再返回。
 *
 * @param value - 文章正文及其内容格式，空内容会渲染为空字符串。
 * @returns 可直接展示的 HTML 内容；空输入时为空字符串。
 */
function getRenderedValue(value?: BlogApi.RenderedField | string) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.raw || value.rendered || '';
}

/**
 * 检查文章是否保留非空 Markdown 源内容，避免把仅有渲染 HTML 误判为可编辑源码。
 *
 * @param article - 要检查内容格式与 Markdown 源码是否同时有效的文章记录。
 * @returns 文章内容格式为 Markdown 且源码非空时返回 true，否则返回 false。
 */
function hasMarkdownSource(article?: Partial<BlogApi.Article>) {
  return !!article?.contentMarkdown?.trim();
}

/**
 * 优先使用保存的 Markdown 源码；缺失时把现有展示内容转换为可编辑纯文本。
 *
 * @param value - 富文本或已渲染正文，在 Markdown 源码缺失时转为纯文本。
 * @param markdown - 文章或编辑器当前使用的 Markdown 源文本。
 * @returns 可写入 Markdown 编辑器的源码或从展示内容转换出的纯文本。
 */
function getEditableMarkdown(
  value?: BlogApi.RenderedField | string,
  markdown?: string,
) {
  if (markdown) return markdown;
  return getRenderedValue(value);
}

/**
 * 移除 HTML 标签并还原常见实体，返回适合摘要展示的纯文本。
 *
 * @param value - 需要转换为 Markdown 可编辑纯文本的 HTML 内容。
 * @returns 去除标签并压缩空白后的纯文本。
 */
function stripHtml(value: string) {
  return value
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll('&nbsp;', ' ')
    .trim();
}
