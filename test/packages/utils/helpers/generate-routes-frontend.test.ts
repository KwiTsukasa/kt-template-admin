import type { RouteRecordRaw } from 'vue-router';

import {
  generateRoutesByFrontend,
  hasAuthority,
} from '@test-source/packages/utils/src/helpers/generate-routes-frontend';
import { describe, expect, it } from 'vitest';

// Mock 路由数据
const mockRoutes = [
  {
    meta: {
      authority: ['admin', 'user'],
      hideInMenu: false,
    },
    path: '/dashboard',
    children: [
      {
        path: '/dashboard/overview',
        meta: { authority: ['admin'], hideInMenu: false },
      },
      {
        path: '/dashboard/stats',
        meta: { authority: ['user'], hideInMenu: true },
      },
    ],
  },
  {
    meta: { authority: ['admin'], hideInMenu: false },
    path: '/settings',
  },
  {
    meta: { hideInMenu: false },
    path: '/profile',
  },
] as RouteRecordRaw[];

/** 返回指定位置的路由测试数据，不允许测试静默使用越界值。 */
function getMockRoute(index: number): RouteRecordRaw {
  const route = mockRoutes[index];
  if (!route) throw new Error(`缺少索引为 ${index} 的路由测试数据`);
  return route;
}

describe('hasAuthority', () => {
  it('should return true if there is no authority defined', () => {
    expect(hasAuthority(getMockRoute(2), ['admin'])).toBe(true);
  });

  it('should return true if the user has the required authority', () => {
    expect(hasAuthority(getMockRoute(0), ['admin'])).toBe(true);
  });

  it('should return false if the user does not have the required authority', () => {
    expect(hasAuthority(getMockRoute(1), ['user'])).toBe(false);
  });
});

describe('generateRoutesByFrontend', () => {
  it('should handle routes without children', async () => {
    const generatedRoutes = await generateRoutesByFrontend(mockRoutes, [
      'user',
    ]);
    expect(generatedRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/profile', // This route has no children and should be included
        }),
      ]),
    );
  });

  it('should handle empty roles array', async () => {
    const generatedRoutes = await generateRoutesByFrontend(mockRoutes, []);
    expect(generatedRoutes).toEqual(
      expect.arrayContaining([
        // Only routes without authority should be included
        expect.objectContaining({
          path: '/profile',
        }),
      ]),
    );
    expect(generatedRoutes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/dashboard',
        }),
        expect.objectContaining({
          path: '/settings',
        }),
      ]),
    );
  });

  it('should handle missing meta fields', async () => {
    const routesWithMissingMeta = [
      { path: '/path1' }, // No meta
      { meta: {}, path: '/path2' }, // Empty meta
      { meta: { authority: ['admin'] }, path: '/path3' }, // Only authority
    ];
    const generatedRoutes = await generateRoutesByFrontend(
      routesWithMissingMeta as RouteRecordRaw[],
      ['admin'],
    );
    expect(generatedRoutes).toEqual([
      { path: '/path1' },
      { meta: {}, path: '/path2' },
      { meta: { authority: ['admin'] }, path: '/path3' },
    ]);
  });
});
