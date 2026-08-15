/* @vitest-environment node */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cwd } from 'node:process';

import { describe, expect, it } from 'vitest';

const routerRoot = resolve(cwd(), 'apps/web-antdv-next/src/router');
const appRoot = resolve(cwd(), 'apps/web-antdv-next/src');

function collectRouterFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectRouterFiles(entryPath);
    if (!entry.name.endsWith('.ts')) return [];
    return [entryPath];
  });
}

describe('admin route pages', () => {
  it('loads every view route entry from TSX', () => {
    const vueRouteImports = collectRouterFiles(routerRoot).flatMap(
      (filePath) => {
        const source = readFileSync(filePath, 'utf8');
        const matches = source.matchAll(
          /import\(['"](#\/views\/[^'"]+\.vue)['"]\)/gu,
        );
        return [...matches].map(
          (match) => `${filePath.replace(`${routerRoot}/`, '')}: ${match[1]}`,
        );
      },
    );

    expect(vueRouteImports).toEqual([]);
  });

  it('keeps only production Vben routes', () => {
    expect(existsSync(join(routerRoot, 'routes/modules/demos.ts'))).toBe(false);
    expect(existsSync(join(routerRoot, 'routes/modules/examples.ts'))).toBe(
      false,
    );
    expect(existsSync(join(appRoot, 'views/demos'))).toBe(false);
    expect(existsSync(join(appRoot, 'views/examples'))).toBe(false);

    const vbenRoutes = readFileSync(
      join(routerRoot, 'routes/modules/vben.ts'),
      'utf8',
    );
    expect(vbenRoutes).toContain("name: 'Project'");
    expect(vbenRoutes).toContain("path: '/vben-admin'");
    expect(vbenRoutes).toContain("name: 'About'");
    expect(vbenRoutes).toContain("path: '/about'");
    expect(vbenRoutes).not.toMatch(/Vben(?:About|Antdv|Project)/u);
  });
});
