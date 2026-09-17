import { isSupportedAdminMenuName } from '@test-source/apps/web-antdv-next/src/api/core/menu';
import routes from '@test-source/apps/web-antdv-next/src/router/routes/modules/automation';
import { describe, expect, it, vi } from 'vitest';

vi.mock('#/api/request', () => ({ requestClient: { get: vi.fn() } }));

describe('automation module navigation', () => {
  it('keeps workflow and schedule entries visible and groups form and rule resources', () => {
    const children = routes[0]?.children || [];
    expect(
      children
        .filter((route) => !route.meta?.hideInMenu)
        .map((route) => route.path)
        .toSorted(),
    ).toEqual([
      '/automation/resources',
      '/automation/schedules',
      '/automation/workflows',
    ]);
    expect(
      children
        .find((route) => route.name === 'AutomationResources')
        ?.children?.map((route) => route.path),
    ).toEqual(['/automation/forms', '/automation/rules']);
    expect(
      children.find((route) => route.name === 'AutomationWorkflowDesigner'),
    ).toMatchObject({
      path: '/automation/workflows/:workflowId/designer',
      meta: { hideInMenu: true, activePath: '/automation/workflows' },
    });
    expect(new Set(children.map((route) => route.name)).size).toBe(
      children.length,
    );
  });

  it('accepts current routes and review permission while rejecting retired giant task forms', () => {
    const pending = [...routes];
    for (const route of pending) {
      expect(isSupportedAdminMenuName(String(route.name))).toBe(true);
      pending.push(...(route.children ?? []));
    }
    expect(isSupportedAdminMenuName('AutomationTaskReview')).toBe(true);
    expect(isSupportedAdminMenuName('TaskSchedulingTasks')).toBe(false);
    expect(isSupportedAdminMenuName('PluginPlatformTasks')).toBe(false);
  });
});
