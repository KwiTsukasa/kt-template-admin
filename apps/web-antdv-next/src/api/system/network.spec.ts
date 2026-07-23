import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

import {
  createNetworkPortForward,
  deleteNetworkPortForward,
  disableNetworkPortForwardKeeper,
  enableNetworkPortForwardKeeper,
  getNetworkAgentStatus,
  getNetworkManagementEventsUrl,
  getNetworkPortForwardEndpointHistory,
  getNetworkPortForwardList,
  probeNetworkPortForward,
  retryNetworkPortForward,
  updateNetworkPortForward,
} from './network';

vi.mock('#/api/request', () => ({
  requestClient: {
    delete: vi.fn(),
    get: vi.fn(),
    getBaseUrl: vi.fn(() => '/api'),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const input = {
  externalPort: 45_678,
  internalPort: 45_678,
  name: 'Game UDP',
  protocol: 'udp' as const,
  remark: 'managed mapping',
};

describe('system network api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the persisted CRUD endpoints without any router secret', async () => {
    await getNetworkPortForwardList({ pageNo: 1, pageSize: 20 });
    await createNetworkPortForward(input);
    await updateNetworkPortForward('mapping-1', input);
    await deleteNetworkPortForward('mapping-1');

    expect(requestClient.get).toHaveBeenCalledWith(
      '/system/network/port-forward/list',
      { params: { pageNo: 1, pageSize: 20 } },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/system/network/port-forward',
      input,
    );
    expect(requestClient.put).toHaveBeenCalledWith(
      '/system/network/port-forward/mapping-1',
      input,
    );
    expect(requestClient.delete).toHaveBeenCalledWith(
      '/system/network/port-forward/mapping-1',
    );
    expect(JSON.stringify(input)).not.toContain('password');
  });

  it('uses distinct reconciliation and Keeper action endpoints', async () => {
    await retryNetworkPortForward('mapping-1');
    await enableNetworkPortForwardKeeper('mapping-1');
    await disableNetworkPortForwardKeeper('mapping-1');
    await probeNetworkPortForward('mapping-1');

    expect(requestClient.post).toHaveBeenNthCalledWith(
      1,
      '/system/network/port-forward/mapping-1/retry',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      2,
      '/system/network/port-forward/mapping-1/keeper/enable',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      3,
      '/system/network/port-forward/mapping-1/keeper/disable',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      4,
      '/system/network/port-forward/mapping-1/probe',
    );
  });

  it('loads Agent status and paged endpoint history independently', async () => {
    await getNetworkAgentStatus();
    await getNetworkPortForwardEndpointHistory('mapping-1', {
      pageNo: 2,
      pageSize: 10,
    });

    expect(requestClient.get).toHaveBeenNthCalledWith(
      1,
      '/system/network/agent/status',
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      2,
      '/system/network/port-forward/mapping-1/endpoint-history',
      { params: { pageNo: 2, pageSize: 10 } },
    );
  });

  it('builds the credentialed SSE URL with an optional replay cursor', () => {
    expect(getNetworkManagementEventsUrl()).toBe(
      '/api/system/network/events/stream',
    );
    expect(getNetworkManagementEventsUrl('network-event-1')).toBe(
      '/api/system/network/events/stream?lastEventId=network-event-1',
    );
  });
});
