import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import botRoutes from '@test-source/apps/web-antdv-next/src/router/routes/modules/bot';
import messageManagementRoutes from '@test-source/apps/web-antdv-next/src/router/routes/modules/message-management';
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

  it('keeps generic message pages out of the Bot route module', () => {
    const botChildren = botRoutes[0]?.children || [];
    const botSource = readFileSync(
      resolve('apps/web-antdv-next/src/router/routes/modules/bot.ts'),
      'utf8',
    );

    expect(
      botChildren.some((route) =>
        String(route.path).includes('message-subscription'),
      ),
    ).toBe(false);
    expect(
      botChildren.some((route) =>
        String(route.path).includes('message-template'),
      ),
    ).toBe(false);
    expect(botSource).not.toContain('views/message-management');
  });
});
