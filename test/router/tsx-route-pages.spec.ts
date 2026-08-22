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

  it('keeps only production routes', () => {
    expect(existsSync(join(routerRoot, 'routes/modules/demos.ts'))).toBe(false);
    expect(existsSync(join(routerRoot, 'routes/modules/examples.ts'))).toBe(
      false,
    );
    expect(existsSync(join(appRoot, 'views/demos'))).toBe(false);
    expect(existsSync(join(appRoot, 'views/examples'))).toBe(false);

    expect(existsSync(join(routerRoot, 'routes/modules/vben.ts'))).toBe(false);
    expect(existsSync(join(appRoot, 'views/_core/about'))).toBe(false);
    expect(existsSync(join(appRoot, 'locales/langs/zh-CN/demos.json'))).toBe(
      false,
    );
    expect(existsSync(join(appRoot, 'locales/langs/zh-CN/examples.json'))).toBe(
      false,
    );

    const profileRoutes = readFileSync(
      join(routerRoot, 'routes/modules/profile.ts'),
      'utf8',
    );
    expect(profileRoutes).toContain("name: 'Profile'");
    expect(profileRoutes).toContain("path: '/profile'");
    expect(profileRoutes).not.toMatch(/Vben|Project|About/u);
  });

  it('uses one canonical kebab-case route for Bot send logs', () => {
    const accessSource = readFileSync(join(routerRoot, 'access.ts'), 'utf8');
    const botRoutes = readFileSync(
      join(routerRoot, 'routes/modules/bot.ts'),
      'utf8',
    );

    expect(botRoutes).toContain("path: '/bot/send-log'");
    expect(botRoutes).toContain("import('#/views/bot/send-log/list')");
    expect(botRoutes).not.toContain('sendLog');
    expect(accessSource).not.toContain('sendLog');
    expect(existsSync(join(appRoot, 'views/bot/send-log/list.tsx'))).toBe(true);
  });
});
