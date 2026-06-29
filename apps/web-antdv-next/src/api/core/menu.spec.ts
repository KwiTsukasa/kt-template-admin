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
        ],
      },
      {
        name: 'Unsupported',
        path: '/unsupported',
        component: '/unsupported/index',
      },
      {
        name: 'QqBot',
        path: '/qqbot',
        children: [
          {
            name: 'QqBotAccount',
            path: '/qqbot/account',
            component: '/qqbot/account/list',
            children: [
              {
                name: 'QqBotAccountWebUI',
                authCode: 'QqBot:Account:WebUI',
                type: 'button',
              },
            ],
          },
          {
            name: 'QqBotAccountNapcatWebui',
            path: '/qqbot/account/:accountId/napcat-webui',
            component: '/qqbot/account/napcat-webui/index',
            meta: {
              activePath: '/qqbot/account',
              hideInMenu: true,
              title: 'NapCat WebUI',
            },
          },
        ],
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
        ],
      },
      {
        name: 'QqBot',
        path: '/qqbot',
        children: [
          {
            name: 'QqBotAccount',
            path: '/qqbot/account',
            component: '/qqbot/account/list',
            children: [
              {
                name: 'QqBotAccountWebUI',
                authCode: 'QqBot:Account:WebUI',
                type: 'button',
              },
            ],
          },
          {
            name: 'QqBotAccountNapcatWebui',
            path: '/qqbot/account/:accountId/napcat-webui',
            component: '/qqbot/account/napcat-webui/index',
            meta: {
              activePath: '/qqbot/account',
              hideInMenu: true,
              title: 'NapCat WebUI',
            },
          },
        ],
      },
    ]);
  });

  it('uses backend sort as the authoritative menu order before menu generation', async () => {
    requestClientGet.mockResolvedValue([
      {
        name: 'Dashboard',
        path: '/dashboard',
        sort: 200,
        meta: {
          order: -1,
          title: 'Dashboard',
        },
      },
      {
        name: 'QqBot',
        path: '/qqbot',
        sort: 1,
        meta: {
          title: 'QQBot',
        },
        children: [
          {
            name: 'QqBotAccount',
            path: '/qqbot/account',
            component: '/qqbot/account/list',
            sort: 1,
            meta: {
              title: '账号连接',
            },
          },
        ],
      },
      {
        name: 'Blog',
        path: '/blog',
        sort: 0,
        meta: {
          order: 100,
          title: '博客管理',
        },
      },
    ]);

    const { getAllMenusApi } = await import('./menu');
    const menus = await getAllMenusApi();

    expect(menus.map((menu) => menu.meta?.order)).toEqual([200, 1, 0]);
    expect(menus[1]?.children?.[0]?.meta?.order).toBe(1);
  });
});
