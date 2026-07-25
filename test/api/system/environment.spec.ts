import {
  getEnvironmentDashboard,
  getEnvironmentDashboardEventsUrl,
  runEnvironmentSelfCheck,
} from '@test-source/apps/web-antdv-next/src/api/system/environment';
import { describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('environment dashboard api', () => {
  it('loads the aggregate dashboard', async () => {
    await getEnvironmentDashboard();

    expect(requestClient.get).toHaveBeenCalledWith(
      '/system/environment/dashboard',
    );
  });

  it('runs readonly self check', async () => {
    await runEnvironmentSelfCheck();

    expect(requestClient.post).toHaveBeenCalledWith(
      '/system/environment/self-check',
    );
  });

  it('builds the SSE stream url without exposing MQTT config', () => {
    expect(getEnvironmentDashboardEventsUrl()).toBe(
      '/system/environment/events/stream',
    );
    expect(getEnvironmentDashboardEventsUrl('evt-1')).toBe(
      '/system/environment/events/stream?lastEventId=evt-1',
    );
  });
});
