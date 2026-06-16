import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestClientGet = vi.fn();

vi.mock('#/api/request', () => ({
  requestClient: {
    get: requestClientGet,
  },
}));

describe('core menu api', () => {
  beforeEach(() => {
    requestClientGet.mockReset();
  });

  it('keeps supported dashboard routes from backend menus', async () => {
    requestClientGet.mockResolvedValue([
      {
        name: 'Dashboard',
        path: '/dashboard',
        redirect: '/analytics',
        children: [
          {
            name: 'Analytics',
            path: '/analytics',
            component: '/dashboard/analytics/index',
          },
          {
            name: 'Workspace',
            path: '/workspace',
            component: '/dashboard/workspace/index',
          },
        ],
      },
      {
        name: 'Unsupported',
        path: '/unsupported',
        component: '/unsupported/index',
      },
    ]);

    const { getAllMenusApi } = await import('./menu');
    const menus = await getAllMenusApi();

    expect(requestClientGet).toHaveBeenCalledWith('/menu/all');
    expect(menus).toEqual([
      {
        name: 'Dashboard',
        path: '/dashboard',
        redirect: '/analytics',
        children: [
          {
            name: 'Analytics',
            path: '/analytics',
            component: '/dashboard/analytics/index',
          },
          {
            name: 'Workspace',
            path: '/workspace',
            component: '/dashboard/workspace/index',
          },
        ],
      },
    ]);
  });
});
