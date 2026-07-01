/* @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';

import {
  BLOG_ARTICLE_CONTENT_FIELD_CLASS,
  BLOG_ARTICLE_FORM_CLASS,
  BLOG_ARTICLE_HTML_RICH_CLASS,
  BLOG_ARTICLE_HTML_TEXTAREA_CLASS,
  buildBlogArticleSubmitPayload,
  createBlogArticleContentSchema,
  getBlogArticleCreateFormDefaults,
  getBlogArticleEditFormValues,
  getContentFormatForEditorMode,
} from './article-form';

describe('blog article form helpers', () => {
  it('edits WordPress Argon HTML articles as raw HTML to preserve codeblocks', () => {
    const values = getBlogArticleEditFormValues({
      categories: ['技术'],
      contentHtml:
        '<pre class="wp-block-code hljs-codeblock"><code class="hljs sql"><table class="hljs-ln"><tbody><tr><td class="hljs-ln-line hljs-ln-code">select 1;</td></tr></tbody></table></code><div class="hljs-control"></div></pre>',
      contentMarkdown: '```sql\nselect 1;\n```',
      excerpt: '摘要',
      id: '50',
      slug: 'wordpress-post',
      status: 'publish',
      tags: ['WordPress'],
      title: 'WordPress 文章',
    });

    expect(values.editorMode).toBe('html-source');
    expect(values.contentFormat).toBe('html');
    expect(values.content).toContain('hljs-codeblock');
  });

  it('keeps existing markdown articles in markdown mode when rendered html is present', () => {
    const values = getBlogArticleEditFormValues({
      categories: [],
      contentHtml: '<h1>标题</h1><p>正文</p>',
      contentMarkdown: '# 标题\n\n正文',
      excerpt: '',
      id: '52',
      slug: 'markdown-post',
      status: 'publish',
      tags: [],
      title: 'Markdown 文章',
    });

    expect(values.editorMode).toBe('markdown');
    expect(values.contentFormat).toBe('markdown');
    expect(values.content).toBe('# 标题\n\n正文');
  });

  it('keeps markdown fenced code articles in markdown mode after Argon base rendering', () => {
    const values = getBlogArticleEditFormValues({
      categories: [],
      contentHtml:
        '<pre class="wp-block-code hljs-codeblock"><code class="hljs typescript">const a = 1;</code></pre>',
      contentMarkdown: '```ts\nconst a = 1;\n```',
      excerpt: '',
      id: '53',
      slug: 'markdown-code-post',
      status: 'publish',
      tags: [],
      title: 'Markdown 代码文章',
    });

    expect(values.editorMode).toBe('markdown');
    expect(values.contentFormat).toBe('markdown');
    expect(values.content).toBe('```ts\nconst a = 1;\n```');
  });

  it('edits plain HTML articles with the rich HTML editor by default', () => {
    const values = getBlogArticleEditFormValues({
      categories: [],
      contentHtml: '<h2>标题</h2><p>正文</p>',
      excerpt: '',
      id: '51',
      slug: 'plain-html-post',
      status: 'publish',
      tags: [],
      title: 'Plain HTML',
    });

    expect(values.editorMode).toBe('html-rich');
    expect(values.contentFormat).toBe('html');
    expect(values.content).toBe('<h2>标题</h2><p>正文</p>');
  });

  it('keeps new local articles in markdown editor mode', () => {
    const values = getBlogArticleCreateFormDefaults();

    expect(values.editorMode).toBe('markdown');
    expect(values.contentFormat).toBe('markdown');
  });

  it('keeps markdown as the default editing mode for new local articles', () => {
    const payload = buildBlogArticleSubmitPayload(
      {
        content: '# 标题',
        contentFormat: 'markdown',
        editorMode: 'markdown',
        status: 'draft',
        title: '新文章',
      },
      undefined,
      'markdown',
    );

    expect(payload).toMatchObject({
      content: '# 标题',
      contentFormat: 'markdown',
      title: '新文章',
    });
  });

  it('keeps html format in update payloads instead of forcing markdown', () => {
    const payload = buildBlogArticleSubmitPayload(
      {
        content: '<pre class="wp-block-code hljs-codeblock"></pre>',
        contentFormat: 'markdown',
        editorMode: 'html-source',
        status: 'publish',
        title: 'WordPress 文章',
      },
      '50',
      'html-source',
    );

    expect(payload).toMatchObject({
      contentFormat: 'html',
      id: '50',
    });
    expect(payload).not.toHaveProperty('editorMode');
  });

  it('maps both html editor modes to the persisted html content format', () => {
    expect(getContentFormatForEditorMode('html-rich')).toBe('html');
    expect(getContentFormatForEditorMode('html-source')).toBe('html');
    expect(getContentFormatForEditorMode('markdown')).toBe('markdown');
  });

  it('uses the rich HTML component and class for html-rich mode', () => {
    const schema = createBlogArticleContentSchema(
      'html-rich',
      'MarkdownEditor',
      'RichHtmlEditor',
    );

    expect(BLOG_ARTICLE_FORM_CLASS).toBe('blog-article-form');
    expect(schema.formItemClass).toContain(BLOG_ARTICLE_CONTENT_FIELD_CLASS);
    expect(schema.component).toBe('RichHtmlEditor');
    expect(schema.componentProps).toMatchObject({
      class: BLOG_ARTICLE_HTML_RICH_CLASS,
      minHeight: 560,
      placeholder: '请输入 HTML 富文本正文',
    });
  });

  it('uses a full-width content form item and a tall raw html textarea', () => {
    const schema = createBlogArticleContentSchema(
      'html-source',
      'MarkdownEditor',
      'RichHtmlEditor',
    );

    expect(schema.formItemClass).toContain(BLOG_ARTICLE_CONTENT_FIELD_CLASS);
    expect(schema.component).toBe('Textarea');
    expect(schema.componentProps).toMatchObject({
      autoSize: { maxRows: 30, minRows: 18 },
      class: BLOG_ARTICLE_HTML_TEXTAREA_CLASS,
    });
  });
});
