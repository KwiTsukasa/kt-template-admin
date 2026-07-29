/* @vitest-environment happy-dom */

import { resolveAdminRuntimeBase } from '@test-source/apps/web-antdv-next/src/router/runtime-base';
import { describe, expect, it } from 'vitest';

describe('admin runtime base', () => {
  it.each([
    ['/admin', '/admin/'],
    ['/admin/', '/admin/'],
    ['/admin/index.html', '/admin/'],
    ['/admin/dashboard', '/admin/'],
  ])('resolves gateway pathname %s to %s', (pathname, expected) => {
    expect(resolveAdminRuntimeBase(pathname)).toBe(expected);
  });

  it.each(['/', '/index.html', '/dashboard', '/administrator'])(
    'keeps legacy-root pathname %s mounted at root',
    (pathname) => {
      expect(resolveAdminRuntimeBase(pathname)).toBe('/');
    },
  );
});
