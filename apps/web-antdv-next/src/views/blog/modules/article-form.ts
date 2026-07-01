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

const ARGON_HTML_PATTERN =
  /\b(?:wp-block-|hljs-codeblock|hljs-ln|hljs-control|fancybox-wrapper|lazyload|collapse-block)/;
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

/**
 * Builds the content field schema for Markdown, rich HTML, or raw WordPress HTML preservation.
 * @param mode Current editor mode; source mode uses a raw textarea to avoid runtime DOM rewrites.
 * @param markdownEditor Markdown editor component used for normal local article authoring.
 * @param richHtmlEditor Tiptap HTML editor component used for plain HTML authoring.
 * @returns Vben form schema for the article content field.
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
 * Builds the editor mode selector schema and forwards mode changes to the article list page.
 * @param onChange Callback that receives the next editor mode selected in the form.
 * @returns Vben form schema for selecting the article editor mode.
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
 * Maps the UI editor mode back to the API's persisted content format contract.
 * @param mode Current editor mode from the article form.
 * @returns API content format saved with the article.
 */
export function getContentFormatForEditorMode(
  mode: BlogArticleEditorMode,
): BlogArticleContentFormat {
  return mode === 'markdown' ? 'markdown' : 'html';
}

/**
 * Chooses the editor mode for an existing article without forcing imported Argon HTML through Tiptap or Markdown.
 * @param article Article row returned by the local blog API.
 * @returns Source HTML for Argon runtime snapshots, rich HTML for plain tags, otherwise Markdown.
 */
export function getBlogArticleEditorMode(
  article?: Partial<WordpressBlogApi.Article>,
): BlogArticleEditorMode {
  const html = getRenderedValue(article?.contentHtml || article?.content);
  if (!html) return 'markdown';
  if (ARGON_HTML_PATTERN.test(html)) return 'html-source';
  return HTML_TAG_PATTERN.test(html) ? 'html-rich' : 'markdown';
}

/**
 * Chooses the persisted content format for an existing article.
 * @param article Article row returned by the local blog API.
 * @returns API content format derived from the detected editor mode.
 */
export function getBlogArticleContentFormat(
  article?: Partial<WordpressBlogApi.Article>,
): BlogArticleContentFormat {
  return getContentFormatForEditorMode(getBlogArticleEditorMode(article));
}

/**
 * Builds form defaults for creating a new article from current table filters.
 * @param searchValues Active table search filters used to prefill category and tag fields.
 * @param searchValues.categories Active category filters copied into the create form.
 * @param searchValues.tags Active tag filters copied into the create form.
 * @returns Article form defaults in Markdown mode.
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
 * Builds edit form values, preserving WordPress/Argon HTML when the article depends on runtime classes.
 * @param row Article row selected from the article table.
 * @returns Form values and content format for the edit modal.
 */
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

/**
 * Builds the API payload while preserving the current content format selected for the modal.
 * @param values Current form values from Vben Form.
 * @param editingId Current article id, or undefined for create.
 * @param editorMode Current editor mode.
 * @returns Payload accepted by the blog article save/update API.
 */
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

/**
 * Converts WordPress rendered fields or strings into readable plain text.
 * @param value Rendered field or string value.
 * @returns HTML-free text.
 */
export function getRenderedText(
  value?: string | WordpressBlogApi.RenderedField,
) {
  return stripHtml(getRenderedValue(value));
}

/**
 * Reads a rendered field without stripping HTML.
 * @param value Rendered field or string value.
 * @returns Raw/rendered string.
 */
function getRenderedValue(value?: string | WordpressBlogApi.RenderedField) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.raw || value.rendered || '';
}

/**
 * Chooses editable Markdown from an API rendered field and its explicit Markdown source.
 * @param value Rendered field or string value.
 * @param markdown Explicit Markdown source saved on local articles.
 * @returns Markdown text for the Milkdown editor.
 */
function getEditableMarkdown(
  value?: string | WordpressBlogApi.RenderedField,
  markdown?: string,
) {
  if (markdown) return markdown;
  return getRenderedValue(value);
}

/**
 * Strips simple HTML tags from Admin labels and excerpts.
 * @param value HTML or text value.
 * @returns Trimmed text.
 */
function stripHtml(value: string) {
  return value
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll('&nbsp;', ' ')
    .trim();
}
