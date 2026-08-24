/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { MediaGovernanceApi } from '#/api/media-governance';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import RssDiscoveryPanel from '@test-source/apps/web-antdv-next/src/views/media/governance/series/RssDiscoveryPanel';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  discoverMediaGovernanceRssSources,
  getMediaGovernanceRssIdentityCandidates,
} from '#/api/media-governance';

const mocks = vi.hoisted(() => ({
  formValues: { keyword: '死神 千年血战篇' },
}));

vi.mock('#/adapter/form', () => {
  const chain: Record<string, any> = {};
  chain.trim = () => chain;
  chain.min = () => chain;
  chain.max = () => chain;
  return {
    useVbenForm: (options: { schema: Array<Record<string, any>> }) => {
      const field = options.schema[0];
      if (!field) throw new Error('expected RSS identity search field');
      return [
        defineComponent({
          name: 'MockVbenForm',
          setup() {
            return () => {
              let componentProps = field.componentProps || {};
              if (typeof componentProps === 'function') {
                componentProps = componentProps();
              }
              return h(
                'div',
                { 'data-testid': 'identity-search-form' },
                h(field.component, {
                  ...componentProps,
                  'onUpdate:value': (value: string) => {
                    mocks.formValues.keyword = value;
                  },
                  value: mocks.formValues.keyword,
                }),
              );
            };
          },
        }),
        {
          getValues: vi.fn(async () => ({ ...mocks.formValues })),
          resetForm: vi.fn(async () => undefined),
          resetValidate: vi.fn(async () => undefined),
          setValues: vi.fn(async (values) => {
            Object.assign(mocks.formValues, values);
          }),
          validate: vi.fn(async () => ({ valid: true })),
        },
      ];
    },
    z: { string: () => chain },
  };
});

vi.mock('@antdv-next/icons', () => ({
  CheckOutlined: defineComponent({
    name: 'MockCheckIcon',
    setup() {
      return () => h('span', 'check');
    },
  }),
  ReloadOutlined: defineComponent({
    name: 'MockReloadIcon',
    setup() {
      return () => h('span', 'reload');
    },
  }),
  SearchOutlined: defineComponent({
    name: 'MockSearchIcon',
    setup() {
      return () => h('span', 'search');
    },
  }),
}));

vi.mock('antdv-next', () => {
  const SlotStub = defineComponent({
    name: 'SlotStub',
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  });
  return {
    Button: defineComponent({
      name: 'MockButton',
      emits: ['click'],
      setup(_, { emit, slots }) {
        return () =>
          h(
            'button',
            { onClick: (event) => emit('click', event) },
            slots.default?.(),
          );
      },
    }),
    Empty: defineComponent({
      name: 'MockEmpty',
      props: { description: { default: '', type: String } },
      setup(props) {
        return () => h('div', props.description);
      },
    }),
    InputSearch: defineComponent({
      name: 'MockInputSearch',
      inheritAttrs: false,
      props: {
        enterButton: { default: false, type: [Boolean, Object, String] },
        value: { default: '', type: String },
      },
      emits: ['search', 'update:value'],
      setup(props, { attrs, emit }) {
        return () =>
          h('div', { ...attrs, class: 'mock-input-search' }, [
            h('input', {
              onInput: (event) =>
                emit('update:value', (event.target as HTMLInputElement).value),
              onKeydown: (event) => {
                if (event.key === 'Enter') {
                  emit('search', props.value, event, { source: 'input' });
                }
              },
              value: props.value,
            }),
            h(
              'button',
              {
                onClick: (event) =>
                  emit('search', props.value, event, { source: 'input' }),
              },
              props.enterButton,
            ),
          ]);
      },
    }),
    Spin: SlotStub,
    Steps: defineComponent({
      name: 'MockSteps',
      props: {
        current: { default: 0, type: Number },
        items: { default: () => [], type: Array },
      },
      emits: ['change'],
      setup(props, { emit }) {
        return () =>
          h(
            'ol',
            {
              'data-current': String(props.current),
              'data-testid': 'rss-discovery-steps',
            },
            (props.items as Array<{ disabled?: boolean; title: string }>).map(
              (item, index) =>
                h(
                  'li',
                  h(
                    'button',
                    {
                      'data-step-index': String(index),
                      disabled: item.disabled,
                      onClick: () => emit('change', index),
                    },
                    item.title,
                  ),
                ),
            ),
          );
      },
    }),
    Tag: SlotStub,
    Tooltip: SlotStub,
  };
});

vi.mock('#/api/media-governance', () => ({
  discoverMediaGovernanceRssSources: vi.fn(),
  getMediaGovernanceRssIdentityCandidates: vi.fn(),
}));

describe('rss discovery panel', () => {
  const identity: MediaGovernanceApi.RssIdentityCandidate = {
    candidateId: 'bangumi:302286',
    episodeCount: 13,
    originalTitle: 'BLEACH 千年血戦篇',
    posterUrl: null,
    provider: 'bangumi',
    providerId: '302286',
    releaseYear: 2022,
    title: '死神 千年血战篇',
  };
  const option: MediaGovernanceApi.RssDiscoverySubscriptionOption = {
    feedUrl:
      'https://mikanani.kas.pub/RSS/Bangumi?bangumiId=2841&subgroupid=370',
    itemCount: 13,
    label: 'Mikan',
    provider: 'mikan',
  };
  const group: MediaGovernanceApi.RssDiscoveryGroup = {
    groupId: 'group-lolihouse',
    includePattern: 'LoliHouse',
    items: [],
    latestPublishedAt: '2026-08-23T12:00:00.000Z',
    maxSeeders: 20,
    providerCount: 6,
    providers: ['mikan', 'nyaa', 'acg-rip', 'dmhy', 'anibt', 'nekobt'],
    releaseGroup: 'LoliHouse',
    subscriptionOptions: [option],
    uniqueItemCount: 13,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.formValues.keyword = '死神 千年血战篇';
    vi.mocked(getMediaGovernanceRssIdentityCandidates).mockResolvedValue({
      items: [identity],
      providers: [
        {
          errorCode: null,
          itemCount: 1,
          label: 'Bangumi',
          provider: 'bangumi',
          rssCapable: false,
          status: 'available',
        },
      ],
    });
    vi.mocked(discoverMediaGovernanceRssSources).mockResolvedValue({
      groups: [group],
      identity,
      providers: [],
      queriedAt: '2026-08-24T00:00:00.000Z',
      totalUniqueItems: 13,
    });
  });

  it('does not request sources until the user explicitly selects an identity', async () => {
    const onApply = vi.fn(async () => undefined);
    const onFinalStepChange = vi.fn(async () => undefined);
    const onInvalidate = vi.fn(async () => undefined);
    const wrapper = mount(RssDiscoveryPanel, {
      props: {
        initialKeyword: '死神 千年血战篇',
        onApply,
        onFinalStepChange,
        onInvalidate,
        seasonNumber: 2,
        seriesId: 'media-series-bleach',
        workId: 'media-work-bleach',
      },
      slots: {
        default: () => h('div', { 'data-testid': 'subscription-parameters' }),
      },
    });
    await flushPromises();

    const searchButton = wrapper.get(
      '[data-testid="identity-search-form"] button',
    );
    expect(searchButton.find('[aria-label="搜索身份"]').exists()).toBe(true);
    await searchButton.trigger('click');
    await flushPromises();

    expect(getMediaGovernanceRssIdentityCandidates).toHaveBeenCalledWith(
      '死神 千年血战篇',
    );
    expect(discoverMediaGovernanceRssSources).not.toHaveBeenCalled();
    expect(
      wrapper
        .get('[data-testid="rss-discovery-steps"]')
        .attributes('data-current'),
    ).toBe('0');

    await wrapper.get('.media-rss-discovery__identity').trigger('click');
    await flushPromises();

    expect(discoverMediaGovernanceRssSources).toHaveBeenCalledWith(
      'media-series-bleach',
      'media-work-bleach',
      2,
      { provider: 'bangumi', providerId: '302286', releaseYear: 2022 },
    );
    expect(wrapper.find('.media-rss-discovery__identity').exists()).toBe(false);
    expect(wrapper.text()).toContain('LoliHouse');
    expect(wrapper.text()).toContain('6 个来源');
    expect(
      wrapper
        .get('[data-testid="rss-discovery-steps"]')
        .attributes('data-current'),
    ).toBe('1');

    await wrapper.get('[aria-label="重新聚合来源"]').trigger('click');
    await flushPromises();
    expect(discoverMediaGovernanceRssSources).toHaveBeenCalledTimes(2);
    expect(getMediaGovernanceRssIdentityCandidates).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.media-rss-discovery__group').exists()).toBe(true);

    await wrapper.get('.media-rss-discovery__feed-option').trigger('click');
    await flushPromises();
    expect(onApply).toHaveBeenCalledWith({ group, identity, option });
    expect(
      wrapper
        .get('[data-testid="rss-discovery-steps"]')
        .attributes('data-current'),
    ).toBe('2');
    expect(
      wrapper.get('[data-testid="subscription-parameters"]').isVisible(),
    ).toBe(true);
    expect(wrapper.find('.media-rss-discovery__group').exists()).toBe(false);

    await wrapper.get('[data-step-index="0"]').trigger('click');
    await flushPromises();
    expect(
      wrapper
        .get('[data-testid="rss-discovery-steps"]')
        .attributes('data-current'),
    ).toBe('0');
    expect(wrapper.find('.media-rss-discovery__identity').exists()).toBe(true);
    expect(
      wrapper
        .find(
          '.media-rss-discovery__parameters--hidden [data-testid="subscription-parameters"]',
        )
        .exists(),
    ).toBe(true);

    await wrapper.get('[data-step-index="1"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('.media-rss-discovery__group').exists()).toBe(true);
    expect(wrapper.find('.media-rss-discovery__identity').exists()).toBe(false);

    await wrapper.get('[data-step-index="2"]').trigger('click');
    await flushPromises();
    expect(
      wrapper.get('[data-testid="subscription-parameters"]').isVisible(),
    ).toBe(true);
    expect(onFinalStepChange).toHaveBeenLastCalledWith(true);
  });
});
