import routes from '@test-source/apps/web-antdv-next/src/router/routes/modules/media-governance';
import { describe, expect, it } from 'vitest';

describe('media governance route module', () => {
  it('keeps the LLM redirect route out of the tab bar', () => {
    const sessionRoute = routes[0]?.children?.find(
      (route) => route.name === 'MediaGovernanceAgentSession',
    );

    expect(sessionRoute).toMatchObject({
      meta: {
        hideInMenu: true,
        hideInTab: true,
      },
      path: '/media/governance/tasks/:taskId/agent',
    });
  });
});
