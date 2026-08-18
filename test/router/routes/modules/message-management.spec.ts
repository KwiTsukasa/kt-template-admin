import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import messageManagementRoutes from '@test-source/apps/web-antdv-next/src/router/routes/modules/message-management';
import qqbotRoutes from '@test-source/apps/web-antdv-next/src/router/routes/modules/qqbot';
import { describe, expect, it } from 'vitest';

describe('message management routes', () => {
  it('owns templates, subscriptions, and station-notice subscriber configuration', () => {
    const parent = messageManagementRoutes[0];
    const children = parent?.children || [];

    expect(parent).toMatchObject({
      name: 'MessageManagement',
      path: '/message-management',
      redirect: '/message-management/subscription',
    });
    expect(children.map((route) => route.name)).toEqual([
      'MessageManagementTemplate',
      'MessageManagementSubscription',
      'MessageManagementStationNoticeSubscriber',
    ]);
    expect(children.map((route) => route.path)).toEqual([
      '/message-management/template',
      '/message-management/subscription',
      '/message-management/subscribers/station-notice',
    ]);
  });

  it('keeps generic message pages out of the QQBot route module', () => {
    const qqbotChildren = qqbotRoutes[0]?.children || [];
    const qqbotSource = readFileSync(
      resolve('apps/web-antdv-next/src/router/routes/modules/qqbot.ts'),
      'utf8',
    );

    expect(
      qqbotChildren.some((route) =>
        String(route.path).includes('message-subscription'),
      ),
    ).toBe(false);
    expect(
      qqbotChildren.some((route) =>
        String(route.path).includes('message-template'),
      ),
    ).toBe(false);
    expect(qqbotSource).not.toContain('views/message-management');
  });
});
