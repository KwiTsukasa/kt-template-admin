import { describe, expect, it, vi } from 'vitest';
import routes from '@test-source/apps/web-antdv-next/src/router/routes/modules/automation';
import { isSupportedAdminMenuName } from '@test-source/apps/web-antdv-next/src/api/core/menu';

vi.mock('#/api/request', () => ({ requestClient: { get: vi.fn() } }));

describe('automation module navigation', () => {
  it('has seven independent menus and keeps every editor outside the visible navigation', () => {
    const children = routes[0]?.children || [];
    expect(children.filter(route => !route.meta?.hideInMenu).map(route => route.path).sort()).toEqual([
      '/automation/executions', '/automation/forms', '/automation/rules', '/automation/schedules',
      '/automation/tasks', '/automation/triggers', '/automation/workflows',
    ]);
    expect(children.find(route => route.name === 'AutomationWorkflowDesigner')).toMatchObject({
      path: '/automation/workflows/:workflowId/designer',
      meta: { hideInMenu: true, activePath: '/automation/workflows' },
    });
    expect(new Set(children.map(route => route.name)).size).toBe(children.length);
  });

  it('accepts current routes and review permission while rejecting retired giant task forms', () => {
    for (const route of routes[0]?.children || []) expect(isSupportedAdminMenuName(String(route.name))).toBe(true);
    expect(isSupportedAdminMenuName('AutomationTaskReview')).toBe(true);
    expect(isSupportedAdminMenuName('TaskSchedulingTasks')).toBe(false);
    expect(isSupportedAdminMenuName('PluginPlatformTasks')).toBe(false);
  });
});
