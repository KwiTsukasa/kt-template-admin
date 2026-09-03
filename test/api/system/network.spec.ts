import {
  createNetworkDdnsRecord,
  createNetworkPortForwardGroup,
  deleteNetworkDdnsRecord,
  deleteNetworkPortForwardGroup,
  disableNetworkTcpNatmap,
  disableNetworkUdpKeeper,
  disableNetworkUdpNatmap,
  enableNetworkTcpNatmap,
  enableNetworkUdpKeeper,
  enableNetworkUdpNatmap,
  getNetworkAgentStatus,
  getNetworkDdnsList,
  getNetworkDdnsProviderStatus,
  getNetworkDdnsSourceOptions,
  getNetworkManagementEventsUrl,
  getNetworkPortForwardChannelEndpointHistory,
  getNetworkPortForwardGroupList,
  probeNetworkUdpKeeper,
  retryNetworkDdnsRecord,
  retryNetworkPortForwardChannel,
  updateNetworkDdnsRecord,
  updateNetworkPortForwardGroup,
} from '@test-source/apps/web-antdv-next/src/api/system/network';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

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
  name: 'Game',
  protocolMode: 'tcp_udp' as const,
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

  it('uses only v2 group CRUD endpoints without any router secret', async () => {
    await getNetworkPortForwardGroupList({
      pageNo: 1,
      pageSize: 20,
      protocolMode: 'tcp_udp',
    });
    await createNetworkPortForwardGroup(input);
    await updateNetworkPortForwardGroup('group-1', input);
    await deleteNetworkPortForwardGroup('group-1');

    expect(requestClient.get).toHaveBeenCalledWith(
      '/system/network/port-forward-group/list',
      { params: { pageNo: 1, pageSize: 20, protocolMode: 'tcp_udp' } },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/system/network/port-forward-group',
      input,
    );
    expect(requestClient.put).toHaveBeenCalledWith(
      '/system/network/port-forward-group/group-1',
      input,
    );
    expect(requestClient.delete).toHaveBeenCalledWith(
      '/system/network/port-forward-group/group-1',
    );
    expect(
      [
        ...vi.mocked(requestClient.get).mock.calls,
        ...vi.mocked(requestClient.post).mock.calls,
        ...vi.mocked(requestClient.put).mock.calls,
        ...vi.mocked(requestClient.delete).mock.calls,
      ].map(([path]) => path),
    ).not.toContainEqual(
      expect.stringMatching(/^\/system\/network\/port-forward(?:\/|$)/),
    );
    expect(JSON.stringify(input)).not.toContain('password');
  });

  it('uses independent v2 channel reconciliation and mechanism endpoints', async () => {
    await retryNetworkPortForwardChannel('group-1', 'tcp');
    await retryNetworkPortForwardChannel('group-1', 'udp');
    await enableNetworkTcpNatmap('group-1');
    await disableNetworkTcpNatmap('group-1');
    await enableNetworkUdpNatmap('group-1');
    await disableNetworkUdpNatmap('group-1');
    await enableNetworkUdpKeeper('group-1');
    await disableNetworkUdpKeeper('group-1');
    await probeNetworkUdpKeeper('group-1');

    expect(requestClient.post).toHaveBeenNthCalledWith(
      1,
      '/system/network/port-forward-group/group-1/channels/tcp/retry',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      2,
      '/system/network/port-forward-group/group-1/channels/udp/retry',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      3,
      '/system/network/port-forward-group/group-1/channels/tcp/natmap/enable',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      4,
      '/system/network/port-forward-group/group-1/channels/tcp/natmap/disable',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      5,
      '/system/network/port-forward-group/group-1/channels/udp/natmap/enable',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      6,
      '/system/network/port-forward-group/group-1/channels/udp/natmap/disable',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      7,
      '/system/network/port-forward-group/group-1/channels/udp/keeper/enable',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      8,
      '/system/network/port-forward-group/group-1/channels/udp/keeper/disable',
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      9,
      '/system/network/port-forward-group/group-1/channels/udp/keeper/probe',
    );
  });

  it('loads Agent status and protocol-scoped endpoint history independently', async () => {
    await getNetworkAgentStatus();
    await getNetworkPortForwardChannelEndpointHistory('group-1', 'tcp', {
      pageNo: 2,
      pageSize: 10,
    });
    await getNetworkPortForwardChannelEndpointHistory('group-1', 'udp', {
      pageNo: 1,
      pageSize: 20,
    });

    expect(requestClient.get).toHaveBeenNthCalledWith(
      1,
      '/system/network/agent/status',
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      2,
      '/system/network/port-forward-group/group-1/channels/tcp/endpoint-history',
      { params: { pageNo: 2, pageSize: 10 } },
    );
    expect(requestClient.get).toHaveBeenNthCalledWith(
      3,
      '/system/network/port-forward-group/group-1/channels/udp/endpoint-history',
      { params: { pageNo: 1, pageSize: 20 } },
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
