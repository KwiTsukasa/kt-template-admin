/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getArticleDetail } from '#/api/blog';

import BlogArticlePreview from './index';

const testState = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  route: {
    params: {
      articleId: '50',
    } as Record<string, unknown>,
  },
}));
const { pushSpy, route } = testState;

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push: pushSpy,
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
      message: { default: '', type: String },
      type: { default: '', type: String },
    },
    setup(props) {
      return () =>
        h('div', { role: 'alert' }, [props.message, props.type as string]);
    },
  }),
  Button: defineComponent({
    name: 'MockButton',
    props: {
      disabled: Boolean,
      type: { default: '', type: String },
    },
    emits: ['click'],
    setup(props, { attrs, emit, slots }) {
      return () =>
        h(
          'button',
          {
            ...attrs,
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
    setup(props) {
      return () => h('div', { 'data-spinning': String(props.spinning) });
    },
  }),
  Tag: defineComponent({
    name: 'MockTag',
    props: {
      color: { default: '', type: String },
    },
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock('#/api/blog', async () => {
  const actual =
    await vi.importActual<typeof import('#/api/blog')>('#/api/blog');

  return {
    ...actual,
    getArticleDetail: vi.fn(),
  };
});

describe('blog article preview page', () => {
  beforeEach(() => {
    route.params.articleId = '50';
    pushSpy.mockReset();
    vi.clearAllMocks();
    vi.mocked(getArticleDetail).mockResolvedValue({
      id: '50',
      slug: 'fnos-nas-docker-jenkins-k3d-k8s',
      status: 'publish',
      title: {
        rendered: '飞牛 NAS Docker',
      },
    });
  });

  it('loads article detail and renders an iframe-only preview surface', async () => {
    const wrapper = mount(BlogArticlePreview);
    await flushPromises();

    expect(getArticleDetail).toHaveBeenCalledWith('50');
    expect(wrapper.find('iframe').attributes('src')).toBe(
      'http://127.0.0.1:5173/#/post/fnos-nas-docker-jenkins-k3d-k8s?adminPreview=1&articleId=50',
    );
    expect(wrapper.find('.blog-article-preview__header').exists()).toBe(false);
    expect(wrapper.find('.blog-article-preview__floating-card').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain('飞牛 NAS Docker');
    expect(wrapper.text()).toContain('文章预览');
    expect(wrapper.text()).toContain('已发布');
    expect(wrapper.text()).toContain('运行态：已就绪');
    expect(wrapper.text()).toContain('127.0.0.1:5173');
  });

  it('does not call detail API when route article id is missing', async () => {
    route.params.articleId = '';

    const wrapper = mount(BlogArticlePreview);
    await flushPromises();

    expect(getArticleDetail).not.toHaveBeenCalled();
    expect(wrapper.find('iframe').exists()).toBe(false);
    expect(wrapper.text()).toContain('缺少文章 ID');
  });

  it('routes back to article list from the floating card', async () => {
    const wrapper = mount(BlogArticlePreview);
    await flushPromises();

    await wrapper.find('button').trigger('click');

    expect(pushSpy).toHaveBeenCalledWith({ name: 'BlogArticle' });
  });

  it('reloads article detail from the floating card refresh action', async () => {
    const wrapper = mount(BlogArticlePreview);
    await flushPromises();

    await wrapper.findAll('button')[1]?.trigger('click');
    await flushPromises();

    expect(getArticleDetail).toHaveBeenCalledTimes(2);
  });

  it('shows the API error message when article detail loading fails', async () => {
    vi.mocked(getArticleDetail).mockRejectedValueOnce(
      new Error('detail failed'),
    );

    const wrapper = mount(BlogArticlePreview);
    await flushPromises();

    expect(wrapper.find('iframe').exists()).toBe(false);
    expect(wrapper.text()).toContain('detail failed');
    expect(wrapper.text()).toContain('异常');
  });

  it('opens the current KT Blog Web preview in a new window', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const wrapper = mount(BlogArticlePreview);
    await flushPromises();

    await wrapper.find('[data-testid="blog-preview-open"]').trigger('click');

    expect(openSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:5173/#/post/fnos-nas-docker-jenkins-k3d-k8s?adminPreview=1&articleId=50',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
