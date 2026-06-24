/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createQqbotNapcatWebuiSession,
  heartbeatQqbotNapcatWebuiSession,
  revokeQqbotNapcatWebuiSession,
} from '#/api/qqbot/napcat';

import QqBotAccountNapcatWebui from './index';

const testState = vi.hoisted(() => ({
  intervalControls: {
    callback: undefined as (() => unknown) | undefined,
    pause: vi.fn(),
    resume: vi.fn(),
  },
  pushSpy: vi.fn(),
  route: {
    params: {
      accountId: 'account-1',
    } as Record<string, unknown>,
  },
}));
const { intervalControls, pushSpy, route } = testState;

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push: pushSpy,
  }),
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    name: 'MockPage',
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  }),
}));

vi.mock('@vben/icons', () => ({
  ArrowLeft: defineComponent({
    name: 'MockArrowLeft',
    setup() {
      return () => h('i', { 'data-testid': 'arrow-left' });
    },
  }),
}));

vi.mock('antdv-next', () => ({
  Alert: defineComponent({
    name: 'MockAlert',
    props: {
      message: String,
      type: String,
    },
    setup(props) {
      return () =>
        h('div', { role: 'alert' }, [props.message, props.type as string]);
    },
  }),
  Button: defineComponent({
    name: 'MockButton',
    props: {
      danger: Boolean,
      disabled: Boolean,
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
    setup(props, { slots }) {
      return () =>
        h(
          'div',
          { 'data-spinning': String(props.spinning) },
          slots.default?.(),
        );
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
}));

vi.mock('@vueuse/core', () => ({
  useIntervalFn: vi.fn((callback: () => unknown) => {
    intervalControls.callback = callback;
    return {
      pause: intervalControls.pause,
      resume: intervalControls.resume,
    };
  }),
}));

vi.mock('#/api/qqbot/napcat', () => ({
  createQqbotNapcatWebuiSession: vi.fn(),
  heartbeatQqbotNapcatWebuiSession: vi.fn(),
  revokeQqbotNapcatWebuiSession: vi.fn(),
}));

/**
 * Creates a mocked gateway session payload for page lifecycle tests.
 *
 * @param overrides - Partial fields that should replace the default fixture.
 * @returns A gateway session payload shaped like the backend response.
 */
function createSessionFixture(overrides = {}) {
  return {
    account: {
      id: 'account-1',
      name: '主账号',
      selfId: '10001',
    },
    container: {
      id: 'container-1',
      name: 'kt-qqbot-napcat-10001',
      webuiStatus: 'online' as const,
    },
    expiresAt: new Date('2026-06-24T15:30:00+08:00').getTime(),
    iframeUrl: '/qqbot/napcat/webui/session/session-1/',
    sessionId: 'session-1',
    ...overrides,
  };
}

describe('qqbot account NapCat WebUI page', () => {
  beforeEach(() => {
    route.params.accountId = 'account-1';
    pushSpy.mockReset();
    intervalControls.callback = undefined;
    intervalControls.pause.mockReset();
    intervalControls.resume.mockReset();
    vi.clearAllMocks();
    vi.mocked(createQqbotNapcatWebuiSession).mockResolvedValue(
      createSessionFixture(),
    );
    vi.mocked(heartbeatQqbotNapcatWebuiSession).mockResolvedValue({
      expiresAt: new Date('2026-06-24T15:40:00+08:00').getTime(),
      sessionId: 'session-1',
      status: 'active',
    });
    vi.mocked(revokeQqbotNapcatWebuiSession).mockResolvedValue({
      sessionId: 'session-1',
      status: 'revoked',
    });
  });

  it('creates a session for the route account and renders the gateway iframe', async () => {
    const wrapper = mount(QqBotAccountNapcatWebui);
    await flushPromises();

    expect(createQqbotNapcatWebuiSession).toHaveBeenCalledWith({
      accountId: 'account-1',
    });
    expect(intervalControls.resume).toHaveBeenCalledTimes(1);
    expect(wrapper.find('iframe').attributes('src')).toBe(
      '/qqbot/napcat/webui/session/session-1/',
    );
    expect(wrapper.text()).toContain('主账号（10001）');
  });

  it('revokes the active session and pauses heartbeat on unmount', async () => {
    const wrapper = mount(QqBotAccountNapcatWebui);
    await flushPromises();

    wrapper.unmount();
    await flushPromises();

    expect(intervalControls.pause).toHaveBeenCalled();
    expect(revokeQqbotNapcatWebuiSession).toHaveBeenCalledWith('session-1');
  });

  it('uses the captured heartbeat callback to extend expiry while ready', async () => {
    const wrapper = mount(QqBotAccountNapcatWebui);
    await flushPromises();

    await intervalControls.callback?.();
    await flushPromises();

    expect(heartbeatQqbotNapcatWebuiSession).toHaveBeenCalledWith('session-1');
    expect(wrapper.text()).toContain('2026-06-24 15:40:00');
  });

  it('renders an error state and hides iframe when session creation fails', async () => {
    vi.mocked(createQqbotNapcatWebuiSession).mockRejectedValueOnce(
      new Error('Gateway unavailable'),
    );

    const wrapper = mount(QqBotAccountNapcatWebui);
    await flushPromises();

    expect(wrapper.find('iframe').exists()).toBe(false);
    expect(wrapper.text()).toContain('Gateway unavailable');
    expect(intervalControls.resume).not.toHaveBeenCalled();
  });

  it('routes back to the QQBot account list from the back button', async () => {
    const wrapper = mount(QqBotAccountNapcatWebui);
    await flushPromises();

    await wrapper.find('button').trigger('click');

    expect(pushSpy).toHaveBeenCalledWith({ name: 'QqBotAccount' });
  });
});
