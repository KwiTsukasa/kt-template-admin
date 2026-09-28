/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { PropType } from 'vue';

import type { EnvironmentDashboardApi } from '#/api/system/environment';

import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import EnvironmentDashboardPage from '@test-source/apps/web-antdv-next/src/views/dashboard/analytics/index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getEnvironmentDashboard,
  runEnvironmentSelfCheck,
} from '#/api/system/environment';

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
  Drawer: defineComponent({
    props: { open: Boolean, title: { type: String, default: '' } },
    setup(props, { slots }) {
      return () =>
        props.open &&
        h('aside', { role: 'dialog' }, [props.title, slots.default?.()]);
    },
  }),
  Select: defineComponent({
    props: {
      options: { type: Array as PropType<any[]>, default: () => [] },
      value: { type: String, default: '' },
    },
    emits: ['change'],
    setup(props, { emit }) {
      return () =>
        h(
          'select',
          {
            value: props.value,
            onChange: (event: Event) =>
              emit('change', (event.target as HTMLSelectElement).value),
          },
          props.options?.map((item: any) =>
            h('option', { value: item.value }, item.label),
          ),
        );
    },
  }),
  Tabs: defineComponent({
    props: {
      items: { type: Array as PropType<any[]>, default: () => [] },
      activeKey: { type: String, default: 'services' },
    },
    emits: ['update:activeKey'],
    setup(props, { emit }) {
      return () =>
        h('section', [
          h(
            'nav',
            props.items.map((item: any) =>
              h(
                'button',
                { onClick: () => emit('update:activeKey', item.key) },
                item.label,
              ),
            ),
          ),
          props.items
            .find((item: any) => item.key === props.activeKey)
            ?.content?.(),
        ]);
    },
  }),
  Alert: defineComponent({
    name: 'MockAlert',
    props: {
      title: { default: '', type: String },
      type: { default: 'info', type: String },
    },
    setup(props, { slots }) {
      return () =>
        h('div', { role: 'alert' }, [props.title, slots.description?.()]);
    },
  }),
  Badge: defineComponent({
    name: 'MockBadge',
    props: {
      status: { default: 'default', type: String },
      text: { default: '', type: String },
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
      type: { default: 'default', type: String },
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
      title: { default: '', type: String },
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
      color: { default: 'default', type: String },
    },
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
  Tooltip: defineComponent({
    name: 'MockTooltip',
    props: {
      title: { default: '', type: String },
    },
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    props: {
      dataSource: { type: Array as PropType<any[]>, default: () => [] },
      rowActions: { type: Array as PropType<any[]>, default: () => [] },
    },
    setup(props) {
      return () =>
        h(
          'table',
          props.dataSource.map((row: any) =>
            h('tr', [
              h('td', row.label),
              h('td', row.summary),
              h(
                'td',
                props.rowActions.map((action: any) =>
                  h(
                    'button',
                    { onClick: () => action.onClick(row) },
                    action.label,
                  ),
                ),
              ),
            ]),
          ),
        );
    },
  }),
}));

type FakeEventSourceListener = (event: MessageEvent<string>) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  closed = false;
  readonly listeners = new Map<string, Set<FakeEventSourceListener>>();
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: FakeEventSourceListener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close() {
    this.closed = true;
  }

  dispatch(type: string, payload: unknown) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(payload),
    });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  removeEventListener(type: string, listener: FakeEventSourceListener) {
    this.listeners.get(type)?.delete(listener);
  }
}

async function flushDashboardUpdates() {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

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

  it('opens selected service evidence in a drawer without inactive placeholder actions', async () => {
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(
      createDashboardFixture(),
    );

    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    await wrapper
      .findAll('.environment-topology__service')
      .find((service) => service.text().includes('Jenkins'))
      ?.trigger('click');
    expect(wrapper.find('[role="dialog"]').text()).toContain(
      'ENV_DASHBOARD_JENKINS_URL missing',
    );
    expect(wrapper.text()).not.toContain('触发 Jenkins 部署');
    await wrapper.find('select[aria-label="站点"]').setValue('r4se');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.findAll('.environment-topology__service')).toHaveLength(0);
  });

  it('renders API-provided MQTT events without instantiating a MQTT client', async () => {
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(
      createDashboardFixture(true),
    );

    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();

    expect(wrapper.find('.environment-topology').exists()).toBe(true);
    expect(wrapper.find('.environment-event-stream').exists()).toBe(true);
    expect(wrapper.find('table').exists()).toBe(false);
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

    const wrapper = mount(EnvironmentDashboardPage);
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
    expect(wrapper.get('select[aria-label="站点"]').element.value).toBe('');
    expect(wrapper.findAll('.environment-topology')).toHaveLength(4);
    wrapper.unmount();
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

  it('shows placeholders and progress before the first snapshot resolves', async () => {
    vi.mocked(getEnvironmentDashboard).mockImplementation(
      () => new Promise(() => {}),
    );
    const wrapper = mount(EnvironmentDashboardPage);
    await nextTick();
    expect(wrapper.get('[role="status"]').text()).toContain('正在读取环境快照');
    expect(
      wrapper
        .findAll('.environment-dashboard-page__metric strong')
        .map((item) => item.text()),
    ).toEqual(['—', '—', '—', '—']);
    wrapper.unmount();
  });

  it('defaults to all environments and keeps a selected scope through refresh, self-check and snapshot compensation', async () => {
    const fixture = createDashboardFixture(true);
    fixture.events.push({
      eventId: 'local-event',
      siteId: 'local-dev',
      severity: 'ok',
      sourceKind: 'live',
      summary: 'Local environment event',
      observedAt: '2026-06-18 10:05:00',
      topic: 'local/example',
    });
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(fixture);
    vi.mocked(runEnvironmentSelfCheck).mockResolvedValue(fixture);
    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();
    const select = wrapper.get('select[aria-label="站点"]');
    expect(select.element.value).toBe('');
    expect(select.findAll('option')[0]?.text()).toBe('全部环境');
    expect(wrapper.findAll('.environment-topology')).toHaveLength(4);
    expect(wrapper.get('[aria-label="全部环境概览"]').text()).toContain(
      '全部环境',
    );
    expect(
      wrapper
        .findAll('.environment-dashboard-page__metric strong')
        .map((item) => item.text()),
    ).toEqual(['2', '4', '2', '2']);
    expect(wrapper.text()).toContain('Local environment event');
    expect(wrapper.text()).toContain('MQTT reported NapCat degraded');

    await select.setValue('nas-prod');
    expect(wrapper.findAll('.environment-topology')).toHaveLength(1);
    expect(wrapper.get('[aria-label="当前环境概览"]').text()).toContain(
      '当前环境',
    );
    expect(
      wrapper
        .findAll('.environment-dashboard-page__metric strong')
        .map((item) => item.text()),
    ).toEqual(['1', '3', '1', '2']);
    expect(wrapper.text()).not.toContain('Local environment event');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '刷新')
      ?.trigger('click');
    await flushDashboardUpdates();
    expect(select.element.value).toBe('nas-prod');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '只读自检')
      ?.trigger('click');
    await flushDashboardUpdates();
    expect(select.element.value).toBe('nas-prod');
    FakeEventSource.instances[0]?.dispatch('snapshot-required', {
      eventId: 'gap-scope',
      siteId: 'nas-prod',
      severity: 'unknown',
      sourceKind: 'local',
      summary: 'Scope compensation',
      observedAt: '2026-06-18 10:06:00',
      topic: 'scope/example',
    });
    await flushDashboardUpdates();
    expect(select.element.value).toBe('nas-prod');
    await select.setValue('');
    expect(wrapper.findAll('.environment-topology')).toHaveLength(4);
    expect(wrapper.text()).toContain('Local environment event');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('binds duplicate service IDs to their own environment without changing the all filter', async () => {
    const fixture = createDashboardFixture();
    const localNode = fixture.sites.find((site) => site.id === 'local-dev')
      ?.nodes[0];
    localNode?.services.push({
      id: 'jenkins',
      label: 'Local Jenkins',
      status: 'ok',
      summary: 'Local Jenkins evidence',
      signals: [
        {
          id: 'local-jenkins-probe',
          label: 'Local Probe',
          sourceKind: 'live',
          status: 'ok',
          summary: 'Local-only signal',
          evidence: [
            {
              source: 'Local Jenkins',
              summary: 'Evidence belongs to Local Dev',
              type: 'live',
            },
          ],
        },
      ],
    });
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(fixture);
    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();
    await wrapper
      .findAll('.environment-topology__service')
      .find((button) => button.text().includes('Local Jenkins'))
      ?.trigger('click');
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      'Evidence belongs to Local Dev',
    );
    expect(wrapper.get('[role="dialog"]').text()).toContain('Local Dev');
    expect(wrapper.get('[role="dialog"]').text()).not.toContain(
      'ENV_DASHBOARD_JENKINS_URL missing',
    );
    expect(wrapper.get('select[aria-label="站点"]').element.value).toBe('');
    await wrapper
      .findAll('.environment-topology__service')
      .find(
        (button) =>
          button.text().includes('Jenkins') &&
          !button.text().includes('Local Jenkins'),
      )
      ?.trigger('click');
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      'ENV_DASHBOARD_JENKINS_URL missing',
    );
    expect(wrapper.get('[role="dialog"]').text()).toContain('NAS Production');
    wrapper.unmount();
  });

  it('keeps an empty selected environment and returns to all only when that environment is removed', async () => {
    const fixture = createDashboardFixture();
    vi.mocked(getEnvironmentDashboard).mockResolvedValue(fixture);
    const wrapper = mount(EnvironmentDashboardPage);
    await flushDashboardUpdates();
    const select = wrapper.get('select[aria-label="站点"]');
    await select.setValue('r4se');
    expect(wrapper.findAll('.environment-topology__service')).toHaveLength(0);
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '刷新')
      ?.trigger('click');
    await flushDashboardUpdates();
    expect(select.element.value).toBe('r4se');
    expect(
      wrapper
        .findAll('.environment-dashboard-page__metric strong')
        .map((item) => item.text()),
    ).toEqual(['0', '0', '0', '0']);
    vi.mocked(getEnvironmentDashboard).mockResolvedValue({
      ...fixture,
      sites: fixture.sites.filter((site) => site.id !== 'r4se'),
    });
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '刷新')
      ?.trigger('click');
    await flushDashboardUpdates();
    expect(select.element.value).toBe('');
    expect(wrapper.findAll('.environment-topology__service')).toHaveLength(4);
    wrapper.unmount();
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
