/* @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';

import { buildKtBlogPreviewUrl, resolveKtBlogWebBaseUrl } from './preview-url';

describe('blog preview url helpers', () => {
  it('builds a KT Blog Web preview URL with encoded slug and trace params', () => {
    const url = buildKtBlogPreviewUrl(
      {
        id: '61',
        slug: '中文 Slug',
      },
      '61',
    );

    expect(url).toBe(
      'http://127.0.0.1:5173/#/post/%E4%B8%AD%E6%96%87%20Slug?adminPreview=1&articleId=61',
    );
  });

  it('uses the configured production Blog Web origin', () => {
    expect(
      resolveKtBlogWebBaseUrl({
        PROD: true,
        VITE_KT_BLOG_WEB_BASE_URL: 'https://blog.kwitsukasa.top/',
      }),
    ).toBe('https://blog.kwitsukasa.top/');
  });

  it('throws in production when the Blog Web origin is not configured', () => {
    expect(() =>
      resolveKtBlogWebBaseUrl({
        PROD: true,
        VITE_KT_BLOG_WEB_BASE_URL: '',
      }),
    ).toThrow('VITE_KT_BLOG_WEB_BASE_URL is required in production');
  });
});
