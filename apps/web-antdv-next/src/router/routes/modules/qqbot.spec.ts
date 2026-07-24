import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('qqbot routes', () => {
  it('adds two flat message-push route children without loading future pages', () => {
    const source = readFileSync(
      'apps/web-antdv-next/src/router/routes/modules/qqbot.ts',
      'utf8',
    );

    for (const [name, path, componentPath, title] of [
      [
        'QqBotMessageSubscription',
        '/qqbot/message-subscription',
        '#/views/qqbot/message-subscription/list',
        '消息订阅',
      ],
      [
        'QqBotMessageTemplate',
        '/qqbot/message-template',
        '#/views/qqbot/message-template/list',
        '消息模板',
      ],
    ] as const) {
      expect(source).toMatch(
        new RegExp(
          String.raw`\{\s*component: \(\) => import\('${componentPath}'\),\s*meta: \{\s*icon: 'lucide:[^']+',\s*title: '${title}',\s*\},\s*name: '${name}',\s*path: '${path}',\s*\}`,
          's',
        ),
      );
    }
  });
});
