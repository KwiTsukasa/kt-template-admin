/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { EnvironmentDashboardApi } from '#/api/system/environment';

import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getEnvironmentDashboard,
  runEnvironmentSelfCheck,
} from '#/api/system/environment';

import EnvironmentDashboardPage from './index.vue';

vi.mock('#/api/system/environment', () => ({
  getEnvironmentDashboard: vi.fn(),
  getEnvironmentDashboardEventsUrl: vi.fn((lastEventId?: string) =>
    lastEventId
      ? `/system/environment/events/stream?lastEventId=${encodeURIComponent(lastEventId)}`
      : '/system/environment/events/stream',
  ),
  runEnvironmentSelfCheck: vi.fn(),
}));

vi.mock('antdv-next', () => ({
  Alert: defineComponent({
    name: 'MockAlert',
    props: {
      message: String,
      type: String,
    },
    setup(props, { slots }) {
      return () =>
        h('div', { role: 'alert' }, [props.message, slots.description?.()]);
    },
  }),
  Badge: defineComponent({
    name: 'MockBadge',
    props: {
      status: String,
      text: String,
    },
    setup(props) {
      return () => h('span', props.text as string);
    },
  }),
  Button: defineComponent({
    name: 'MockButton',
    props: {
      disabled: Boolean,
      loading: Boolean,
      type: String,
    },
    emits: ['click'],
    setup(props, { emit, slots }) {
      return () =>
        h(
          'button',
          {
            disabled: props.disabled,
            type: 'button',
            onClick: () => emit('click'),
          },
          slots.default?.(),
        );
    },
  }),
  Card: defineComponent({
    name: 'MockCard',
    props: {
      title: String,
    },
    setup(props, { slots }) {
      return () =>
        h('section', [
          props.title ? h('h2', props.title as string) : null,
          slots.default?.(),
        ]);
    },
  }),
  Empty: defineComponent({
    name: 'MockEmpty',
    setup() {
      return () => h('div', 'empty');
    },
  }),
  Space: defineComponent({
    name: 'MockSpace',
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  }),
  Spin: defineComponent({
    name: 'MockSpin',
    props: {
      spinning: Boolean,
    },
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  }),
  Tag: defineComponent({
    name: 'MockTag',
    props: {
      color: String,
    },
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
  Tooltip: defineComponent({
    name: 'MockTooltip',
    props: {
      title: String,
    },
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

type FakeEventSourceListener = (event: MessageEvent<string>) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  closed = false;
  readonly listeners = new Map<string, Set<FakeEventSourceListener>>();
  readonly url: string;

  /**
   * Records the stream URL used by the page so tests can dispatch typed SSE messages.
   *
   * @param url Browser EventSource URL built from the Admin API wrapper.
   */
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  /**
   * Stores typed SSE listeners registered by the production stream composable.
   *
   * @param type SSE event type supplied by the backend stream.
   * @param listener Component-side event handler receiving the JSON payload.
   */
  addEventListener(type: string, listener: FakeEventSourceListener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  /**
   * Marks the connection as closed so the unmount lifecycle can be asserted.
   */
  close() {
    this.closed = true;
  }

  /**
   * Delivers one typed SSE message to the mounted page.
   *
   * @param type SSE event name sent by the API.
   * @param payload JSON-serializable event payload.
   */
  dispatch(type: string, payload: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(payload),
    });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  /**
   * Removes an SSE listener during component cleanup.
   *
   * @param type SSE event type supplied by the backend stream.
   * @param listener Previously registered component handler.
   */
  removeEventListener(type: string, listener: FakeEventSourceListener) {
    this.listeners.get(type)?.delete(listener);
  }
}

/**
 * Flushes Vue microtasks created by API promises and reactive state updates.
 */
async function flushDashboardUpdates() {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

/**
 * Builds a complete four-site dashboard fixture that mirrors the backend contract.
 *
 * @param includeMqttEvent Whether the API snapshot should already contain a MQTT-origin event.
 */
function createDashboardFixture(
  includeMqttEvent = false,
): EnvironmentDashboardApi.EnvironmentDashboardResponse {
  return {
    actions: [
      {
        disabledReason: '第一版只允许只读自检',
        enabled: true,
        id: 'run-self-check',
        label: '只读自检',
        riskLevel: 'low',
      },
      {
        disabledReason: '高风险操作需要人工审批',
        enabled: false,
        id: 'trigger-jenkins-deploy',
        label: '触发 Jenkins 部署',
        riskLevel: 'high',
      },
    ],
    events: includeMqttEvent
      ? [
          {
            eventId: 'evt-mqtt-1',
            observedAt: '2026-06-18 10:02:00',
            severity: 'degraded',
            siteId: 'nas-prod',
            sourceKind: 'mqtt',
            summary: 'MQTT reported NapCat degraded',
            topic: 'kt/env/nas-prod/napcat',
          },
        ]
      : [],
    generatedAt: '2026-06-18 10:00:00',
    refreshedAt: '2026-06-18 10:00:01',
    sites: [
      {
        id: 'local-dev',
        label: 'Local Dev',
        nodes: [
          {
            id: 'local-dev-host',
            label: 'Local Host',
            services: [
              {
                id: 'admin-local',
                label: 'Admin Local',
                signals: [
                  {
                    evidence: [],
                    id: 'admin-local-http',
                    label: 'HTTP',
                    sourceKind: 'live',
                    status: 'ok',
                    summary: 'Vite reachable',
                  },
                ],
                status: 'ok',
                summary: 'Admin is reachable',
              },
            ],
            status: 'ok',
          },
        ],
        status: 'online',
        summary: 'local ready',
      },
      {
        id: 'nas-prod',
        label: 'NAS Production',
        nodes: [
          {
            id: 'nas-node',
            label: 'NAS Node',
            services: [
              {
                id: 'jenkins',
                label: 'Jenkins',
                signals: [
                  {
                    evidence: [
                      {
                        observedAt: '2026-06-18 10:00:01',
                        source: 'ENV_DASHBOARD_JENKINS_URL',
                        summary: 'ENV_DASHBOARD_JENKINS_URL missing',
                        type: 'unwired',
                      },
                    ],
                    id: 'jenkins-config',
                    label: 'Read-only config',
                    sourceKind: 'unwired',
                    status: 'unwired',
                    summary: 'Jenkins read-only config missing',
                  },
                ],
                status: 'unwired',
                summary: 'Jenkins read-only config missing',
              },
              {
                id: 'k8s',
                label: 'K8s',
                signals: [
                  {
                    evidence: [
                      {
                        observedAt: '2026-06-18 10:00:01',
                        source: 'ENV_DASHBOARD_K8S_API_SERVER',
                        summary: 'ENV_DASHBOARD_K8S_API_SERVER missing',
                        type: 'unwired',
                      },
                    ],
                    id: 'k8s-config',
                    label: 'Read-only config',
                    sourceKind: 'unwired',
                    status: 'unwired',
                    summary: 'K8s read-only config missing',
                  },
                ],
                status: 'unwired',
                summary: 'K8s read-only config missing',
              },
              {
                id: 'napcat',
                label: 'NapCat',
                signals: [
                  {
                    evidence: [],
                    id: 'napcat-login',
                    label: 'Login',
                    sourceKind: 'live',
                    status: 'ok',
                    summary: 'NapCat online',
                  },
                ],
                status: 'ok',
                summary: 'NapCat online',
              },
            ],
            status: 'unwired',
          },
        ],
        status: 'unknown',
        summary: 'remote evidence partial',
      },
      {
        id: 'tencent-cloud',
        label: 'Tencent Cloud',
        nodes: [],
        status: 'unknown',
        summary: 'cloud config pending',
      },
      {
        id: 'r4se',
        label: 'r4se',
        nodes: [],
        status: 'isolated',
        summary: 'remote site isolated',
      },
    ],
    summary: {
      blocked: 0,
      degraded: includeMqttEvent ? 1 : 0,
      down: 0,
      ok: 2,
      totalSignals: 4,
      unknown: 0,
      unwired: 2,
    },
    topology: {
      edges: [
        {
          from: 'local-dev',
          id: 'edge-local-api',
          label: 'serves',
          to: 'admin-local',
        },
      ],
      nodes: [],
    },
  };
}

describe('environment dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('mqtt', {
      connect: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders all four sites from the dashboard snapshot', async () => {
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(
      createDashboardFixture(),
    );

    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();

    expect(wrapper.text()).toContain('Local Dev');
    expect(wrapper.text()).toContain('NAS Production');
    expect(wrapper.text()).toContain('Tencent Cloud');
    expect(wrapper.text()).toContain('r4se');
  });

  it('renders disabled write actions with their reason', async () => {
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(
      createDashboardFixture(),
    );

    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();

    const deployButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('触发 Jenkins 部署'));
    expect(deployButton?.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('高风险操作需要人工审批');
  });

  it('renders API-provided MQTT events without instantiating a MQTT client', async () => {
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(
      createDashboardFixture(true),
    );

    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();

    expect(wrapper.text()).toContain('MQTT reported NapCat degraded');
    expect((globalThis as any).mqtt.connect).not.toHaveBeenCalled();
  });

  it('updates one node from an environment-signal SSE without reloading the dashboard', async () => {
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(
      createDashboardFixture(),
    );

    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();

    FakeEventSource.instances[0]?.dispatch('environment-signal', {
      eventId: 'evt-signal-1',
      observedAt: '2026-06-18 10:03:00',
      serviceId: 'napcat',
      severity: 'degraded',
      signalId: 'napcat-login',
      siteId: 'nas-prod',
      sourceKind: 'mqtt',
      summary: 'NapCat login degraded by SSE',
      topic: 'kt/env/nas-prod/napcat',
    });
    await flushDashboardUpdates();

    expect(getEnvironmentDashboard).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('NapCat login degraded by SSE');
  });

  it('loads exactly one snapshot when SSE requests a snapshot', async () => {
    vi.mocked(getEnvironmentDashboard)
      .mockResolvedValueOnce(createDashboardFixture())
      .mockResolvedValueOnce(createDashboardFixture(true));

    mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();

    FakeEventSource.instances[0]?.dispatch('snapshot-required', {
      eventId: 'evt-gap',
      observedAt: '2026-06-18 10:04:00',
      severity: 'unknown',
      siteId: 'nas-prod',
      sourceKind: 'local',
      summary: 'Replay gap requires one snapshot',
      topic: 'kt/env/snapshot-required',
    });
    await flushDashboardUpdates();

    expect(getEnvironmentDashboard).toHaveBeenCalledTimes(2);
  });

  it('does not register dashboard polling or timer-based refresh', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(
      createDashboardFixture(),
    );

    mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();

    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('runs readonly self-check from the action button', async () => {
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(
      createDashboardFixture(),
    );
    vi.mocked(runEnvironmentSelfCheck).mockResolvedValue(
      createDashboardFixture(true),
    );

    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('只读自检'))
      ?.trigger('click');
    await flushDashboardUpdates();

    expect(runEnvironmentSelfCheck).toHaveBeenCalledTimes(1);
  });

  it('closes EventSource when the route page unmounts', async () => {
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(
      createDashboardFixture(),
    );

    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();

    wrapper.unmount();

    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });
});
