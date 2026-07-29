/* @vitest-environment node */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const appSourceRoot = resolve('apps/web-antdv-next/src');
const blogApiRoot = resolve(appSourceRoot, 'api/blog');
const accessStorePath = resolve('packages/stores/src/modules/access.ts');

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = resolve(directory, entry);
    if (statSync(filePath).isDirectory()) return collectSourceFiles(filePath);
    return /\.[cm]?[jt]sx?$/.test(entry) ? [filePath] : [];
  });
}

function readSource(filePath: string) {
  return readFileSync(filePath, 'utf8');
}

const applicationSourceFiles = collectSourceFiles(appSourceRoot);

function findSourceMatches(pattern: RegExp) {
  return applicationSourceFiles.flatMap((filePath) => {
    const matches = readSource(filePath).match(pattern);
    return matches ? [`${filePath}: ${matches[0]}`] : [];
  });
}

describe('blog WordPress runtime retirement contract', () => {
  it('exposes local Blog content APIs from the domain-neutral module', () => {
    const contentApiPath = resolve(blogApiRoot, 'content.ts');
    const legacyApiPath = resolve(blogApiRoot, 'wordpress.ts');
    const blogApiIndex = readSource(resolve(blogApiRoot, 'index.ts'));

    expect(existsSync(contentApiPath)).toBe(true);
    expect(existsSync(legacyApiPath)).toBe(false);
    expect(blogApiIndex).toContain("export * from './content';");
    expect(blogApiIndex).not.toContain("export * from './wordpress';");

    const contentApi = readSource(contentApiPath);
    expect(contentApi).toContain('export namespace BlogApi');
    expect(contentApi).not.toMatch(/WordpressBlogApi|importWordpress/i);
  });

  it('keeps article, theme, category, and tag operations on local Blog routes', () => {
    const contentApi = readSource(resolve(blogApiRoot, 'content.ts'));
    const expectedRoutes = [
      '/blog/article/category-options',
      '/blog/article/detail',
      '/blog/article/list',
      '/blog/article/remove',
      '/blog/article/save',
      '/blog/article/tag-options',
      '/blog/article/update',
      '/blog/category/list',
      '/blog/category/remove',
      '/blog/category/save',
      '/blog/category/update',
      '/blog/tag/list',
      '/blog/tag/remove',
      '/blog/tag/save',
      '/blog/tag/update',
      '/blog/theme/config',
      '/blog/theme/save',
    ];

    for (const route of expectedRoutes) {
      expect(contentApi).toContain(route);
    }
  });

  it('contains no executable WordPress import entry or legacy Blog namespace', () => {
    expect(
      findSourceMatches(
        /importWordpress|import-wordpress|导入\s*WordPress|WordpressBlogApi/i,
      ),
    ).toEqual([]);
  });

  it('contains no WordPress login state or nonce forwarding in Admin runtime source', () => {
    expect(
      findSourceMatches(
        /wordpressAvailable|wordpressAuth|wordpressError|ktWordpressAuth|X-WP-Nonce|\/wordpress\//i,
      ),
    ).toEqual([]);
  });

  it('contains no persisted WordPress authentication state in the shared access store', () => {
    expect(readSource(accessStorePath)).not.toMatch(
      /WordpressAuthState|wordpressAuth|setWordpressAuth/i,
    );
  });
});
