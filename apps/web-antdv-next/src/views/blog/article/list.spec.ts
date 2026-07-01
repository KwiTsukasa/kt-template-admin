/* @vitest-environment node */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('list.tsx', import.meta.url), 'utf8');

describe('blog article list preview entry', () => {
  it('keeps the preview row action wired to the hidden iframe route', () => {
    expect(source).toContain("key: 'preview'");
    expect(source).toContain("permissionCodes: ['Blog:Article:Preview']");
    expect(source).toContain("name: 'BlogArticlePreview'");
    expect(source).toContain('articleId: row.id');
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
