/* @vitest-environment node */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve('apps/web-antdv-next/src/views/blog/article/list.tsx'),
  'utf8',
);

describe('blog article list preview entry', () => {
  function getSourceSlice(start: string, end: string) {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex + start.length);

    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeGreaterThan(startIndex);

    return source.slice(startIndex, endIndex);
  }

  it('keeps the preview row action wired to the hidden iframe route', () => {
    expect(source).toContain("key: 'preview'");
    expect(source).toContain("permissionCodes: ['Blog:Article:Preview']");
    expect(source).toContain("name: 'BlogArticlePreview'");
    expect(source).toContain('articleId: row.id');
  });

  it('opens the article modal before waiting for modal-contained form schema updates', () => {
    const openCreateBody = getSourceSlice(
      'async function openCreate',
      'function openEdit',
    );
    const openEditBody = getSourceSlice(
      'function openEdit',
      'function openPreview',
    );

    expect(source).toContain('void resetArticleModalForm(');
    expect(openCreateBody).toContain(
      'articleModalApi.setData({ values }).open();',
    );
    expect(openEditBody).toContain(
      'articleModalApi.setData({ values }).open();',
    );
    expect(openCreateBody).not.toMatch(
      /await setArticleEditorMode[\s\S]*articleModalApi\.setData\(\{ values \}\)\.open\(\)/,
    );
    expect(openEditBody).not.toMatch(
      /await setArticleEditorMode[\s\S]*articleModalApi\.setData\(\{ values \}\)\.open\(\)/,
    );
  });

  it('wires Tiptap editor mode switching without dropping current content', () => {
    expect(source).toContain(
      "import { KtTiptapHtmlEditor } from '#/components/richText';",
    );
    expect(source).toContain('createBlogArticleEditorModeSchema');
    expect(source).toContain(
      'void setArticleEditorMode(mode, { preserveContent: true });',
    );
    expect(source).toContain(
      'contentFormat: getContentFormatForEditorMode(mode)',
    );
    expect(source).toContain('editorMode: mode');
  });
});
