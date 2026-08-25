/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { MediaGovernanceApi } from '#/api/media-governance';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import SeriesWorkCreateModal from '@test-source/apps/web-antdv-next/src/views/media/governance/series/SeriesWorkCreateModal';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createMediaGovernanceSeries,
  createMediaGovernanceWork,
  getMediaGovernanceCatalogIdentityCandidates,
} from '#/api/media-governance';

const mocks = vi.hoisted(() => ({
  formValues: { keyword: '咒术回战', workType: 'tv' },
  modalOptions: undefined as any,
  modalState: {} as Record<string, unknown>,
}));

vi.mock('#/adapter/form', () => {
  const chain: Record<string, any> = {};
  chain.trim = () => chain;
  chain.min = () => chain;
  chain.max = () => chain;
  return {
    useVbenForm: (options: { schema: Array<Record<string, any>> }) => {
      const keywordField = options.schema.find(
        (field) => field.fieldName === 'keyword',
      );
      if (!keywordField) throw new Error('expected identity keyword field');
      return [
        defineComponent({
          name: 'MockIdentityForm',
          setup() {
            return () => {
              let componentProps = keywordField.componentProps || {};
              if (typeof componentProps === 'function') {
                componentProps = componentProps();
              }
              return h(keywordField.component, {
                ...componentProps,
                'data-testid': 'identity-search',
                value: mocks.formValues.keyword,
              });
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

vi.mock('@vben/common-ui', () => ({
  useVbenModal: (options: any) => {
    mocks.modalOptions = options;
    const api: Record<string, any> = {
      close: vi.fn(async () => undefined),
      lock: vi.fn(),
      open: vi.fn(() => {
        options.onOpenChange?.(true);
        return api;
      }),
      setState: vi.fn((state) => {
        Object.assign(mocks.modalState, state);
        return api;
      }),
      unlock: vi.fn(),
    };
    return [
      defineComponent({
        name: 'MockModal',
        setup(_, { slots }) {
          return () => h('section', slots.default?.());
        },
      }),
      api,
    ];
  },
}));

vi.mock('@antdv-next/icons', () => ({
  CheckOutlined: defineComponent({
    setup() {
      return () => h('span', 'check');
    },
  }),
  SearchOutlined: defineComponent({
    setup() {
      return () => h('span', 'search');
    },
  }),
}));

vi.mock('antdv-next', () => {
  const SlotStub = defineComponent({
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  });
  return {
    Button: defineComponent({
      inheritAttrs: false,
      emits: ['click'],
      setup(_, { attrs, emit, slots }) {
        return () =>
          h(
            'button',
            { ...attrs, onClick: (event) => emit('click', event) },
            slots.default?.(),
          );
      },
    }),
    Empty: defineComponent({
      props: { description: { default: '', type: String } },
      setup(props) {
        return () => h('div', props.description);
      },
    }),
    InputSearch: defineComponent({
      inheritAttrs: false,
      props: { enterButton: { default: false, type: [Boolean, Object] } },
      emits: ['search'],
      setup(props, { attrs, emit }) {
        return () =>
          h('div', attrs, [
            h('button', { onClick: () => emit('search') }, props.enterButton),
          ]);
      },
    }),
    Spin: SlotStub,
    Tag: SlotStub,
    message: { warning: vi.fn() },
  };
});

vi.mock('#/api/media-governance', () => ({
  createMediaGovernanceSeries: vi.fn(),
  createMediaGovernanceWork: vi.fn(),
  getMediaGovernanceCatalogIdentityCandidates: vi.fn(),
}));

describe('series and work identity modal', () => {
  const candidate: MediaGovernanceApi.RssIdentityCandidate = {
    candidateId: 'tmdb:tv:95479',
    episodeCount: null,
    originalTitle: 'Jujutsu Kaisen',
    posterUrl: null,
    provider: 'tmdb',
    providerId: '95479',
    releaseYear: 2020,
    title: '咒术回战',
  };
  const detail = {
    series: { id: 'media-series-jjk' },
    works: [{ id: 'media-work-jjk-tv' }],
  } as MediaGovernanceApi.SeriesDetail;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.formValues.keyword = '咒术回战';
    mocks.formValues.workType = 'tv';
    mocks.modalOptions = undefined;
    mocks.modalState = {};
    vi.mocked(getMediaGovernanceCatalogIdentityCandidates).mockResolvedValue({
      items: [candidate],
      providers: [],
    });
    vi.mocked(createMediaGovernanceSeries).mockResolvedValue(detail);
    vi.mocked(createMediaGovernanceWork).mockResolvedValue(detail);
  });

  it('searches, selects and creates a Series with its primary Work identity', async () => {
    const wrapper = mount(SeriesWorkCreateModal);
    (wrapper.vm as any).openCreateSeries();
    await flushPromises();
    mocks.formValues.keyword = '咒术回战';
    await wrapper
      .get('[data-testid="identity-search"] button')
      .trigger('click');
    await flushPromises();

    expect(getMediaGovernanceCatalogIdentityCandidates).toHaveBeenCalledWith(
      '咒术回战',
      'tv',
    );
    await wrapper
      .get('.media-series-identity-picker__candidate')
      .trigger('click');
    expect(mocks.modalState.confirmDisabled).toBe(false);
    await mocks.modalOptions.onConfirm();

    expect(createMediaGovernanceSeries).toHaveBeenCalledWith({
      identity: { provider: 'tmdb', providerId: '95479', releaseYear: 2020 },
      workType: 'tv',
    });
    expect(wrapper.emitted('saved')?.at(0)).toEqual([detail]);
  });

  it('uses the same verified picker to add a Work under one Series', async () => {
    const wrapper = mount(SeriesWorkCreateModal);
    (wrapper.vm as any).openCreateWork('media-series-jjk');
    await flushPromises();
    mocks.formValues.keyword = '咒术回战';
    await wrapper
      .get('[data-testid="identity-search"] button')
      .trigger('click');
    await flushPromises();
    await wrapper
      .get('.media-series-identity-picker__candidate')
      .trigger('click');
    await mocks.modalOptions.onConfirm();

    expect(createMediaGovernanceWork).toHaveBeenCalledWith('media-series-jjk', {
      identity: {
        provider: 'tmdb',
        providerId: '95479',
        releaseYear: 2020,
      },
      workType: 'tv',
    });
  });

  it('submits a verified theatrical Work without rewriting its identity', async () => {
    const theatricalCandidate: MediaGovernanceApi.RssIdentityCandidate = {
      candidateId: 'bangumi:subject:604826',
      episodeCount: null,
      originalTitle: null,
      posterUrl: null,
      provider: 'bangumi',
      providerId: '604826',
      releaseYear: 2026,
      title: '超辉夜姬！',
    };
    mocks.formValues.keyword = '超辉夜姬！';
    mocks.formValues.workType = 'theatrical';
    vi.mocked(getMediaGovernanceCatalogIdentityCandidates).mockResolvedValue({
      items: [theatricalCandidate],
      providers: [],
    });
    const wrapper = mount(SeriesWorkCreateModal);
    (wrapper.vm as any).openCreateWork('media-series-theatrical');
    await flushPromises();
    mocks.formValues.keyword = '超辉夜姬！';
    mocks.formValues.workType = 'theatrical';
    await wrapper
      .get('[data-testid="identity-search"] button')
      .trigger('click');
    await flushPromises();
    await wrapper
      .get('.media-series-identity-picker__candidate')
      .trigger('click');
    await mocks.modalOptions.onConfirm();

    expect(getMediaGovernanceCatalogIdentityCandidates).toHaveBeenCalledWith(
      '超辉夜姬！',
      'theatrical',
    );
    expect(createMediaGovernanceWork).toHaveBeenCalledWith(
      'media-series-theatrical',
      {
        identity: {
          provider: 'bangumi',
          providerId: '604826',
          releaseYear: 2026,
        },
        workType: 'theatrical',
      },
    );
  });
});
