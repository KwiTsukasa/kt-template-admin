import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

import {
  createNetworkDdnsRecord,
  createNetworkPortForward,
  deleteNetworkDdnsRecord,
  deleteNetworkPortForward,
  disableNetworkPortForwardKeeper,
  enableNetworkPortForwardKeeper,
  getNetworkAgentStatus,
  getNetworkDdnsList,
  getNetworkDdnsProviderStatus,
  getNetworkDdnsSourceOptions,
  getNetworkManagementEventsUrl,
  getNetworkPortForwardEndpointHistory,
  getNetworkPortForwardList,
  probeNetworkPortForward,
  retryNetworkDdnsRecord,
  retryNetworkPortForward,
  updateNetworkDdnsRecord,
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

const ddnsInput = {
  domain: 'kwitsukasa.top',
  enabled: true,
  name: 'NAS IPv4',
  portForwardId: '90071992547409930',
  recordType: 'A' as const,
  remark: 'managed DNS',
  sourceType: 'port_forward_ipv4' as const,
  subDomain: 'nas',
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

  it('uses the dual-stack DDNS CRUD endpoints without credential fields', async () => {
    await getNetworkDdnsList({
      pageNo: 1,
      pageSize: 20,
      recordType: 'AAAA',
    });
    await getNetworkDdnsSourceOptions('A');
    await getNetworkDdnsProviderStatus();
    await createNetworkDdnsRecord(ddnsInput);
    await updateNetworkDdnsRecord('ddns-1', ddnsInput);
    await retryNetworkDdnsRecord('ddns-1');
    await deleteNetworkDdnsRecord('ddns-1');

    expect(requestClient.get).toHaveBeenNthCalledWith(
      1,
      '/system/network/ddns/list',
      { params: { pageNo: 1, pageSize: 20, recordType: 'AAAA' } },
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      2,
      '/system/network/ddns/source-options',
      { params: { recordType: 'A' } },
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      3,
      '/system/network/ddns/provider-status',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      1,
      '/system/network/ddns',
      ddnsInput,
    );
    expect(requestClient.put).toHaveBeenCalledWith(
      '/system/network/ddns/ddns-1',
      ddnsInput,
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      2,
      '/system/network/ddns/ddns-1/retry',
    );
    expect(requestClient.delete).toHaveBeenCalledWith(
      '/system/network/ddns/ddns-1',
    );
    expect(JSON.stringify(ddnsInput)).not.toMatch(
      /secret|credential|password|token/i,
    );
  });

  it('keeps AAAA source selection server-controlled and free of a mapping ID', async () => {
    const ipv6Input = {
      ...ddnsInput,
      portForwardId: undefined,
      recordType: 'AAAA' as const,
      sourceType: 'agent_ipv6' as const,
      subDomain: 'nas6',
    };

    await createNetworkDdnsRecord(ipv6Input);

    expect(requestClient.post).toHaveBeenCalledWith(
      '/system/network/ddns',
      ipv6Input,
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
