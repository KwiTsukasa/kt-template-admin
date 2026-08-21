/* @vitest-environment happy-dom */

import { flushPromises, mount } from '@vue/test-utils';

import LlmChatWorkspace from '@test-source/apps/web-antdv-next/src/views/llm/chat/components/LlmChatWorkspace';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@antdv-next/icons', async () => {
  const { defineComponent, h } = await import('vue');
  const createIcon = (name: string) =>
    defineComponent({
      name,
      setup() {
        return () => h('span', { 'data-icon': name });
      },
    });
  return {
    PlusOutlined: createIcon('PlusOutlined'),
    SendOutlined: createIcon('SendOutlined'),
    StopOutlined: createIcon('StopOutlined'),
  };
});

vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const createElementComponent = (name: string, tag = 'div') =>
    defineComponent({
      inheritAttrs: false,
      name,
      setup(_, { attrs, slots }) {
        return () => h(tag, attrs, slots.default?.());
      },
    });
  const MockTextArea = defineComponent({
    emits: ['change', 'pressEnter'],
    inheritAttrs: false,
    name: 'MockTextArea',
    props: {
      autoSize: { default: undefined, type: Object },
      maxlength: { default: undefined, type: Number },
      placeholder: { default: '', type: String },
      value: { default: '', type: String },
    },
    setup(props, { attrs, emit }) {
      return () =>
        h('textarea', {
          ...attrs,
          maxlength: props.maxlength,
          onChange: (event: Event) => emit('change', event),
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === 'Enter') emit('pressEnter', event);
          },
          placeholder: props.placeholder,
          value: props.value,
        });
    },
  });
  const Paragraph = createElementComponent('MockTypographyParagraph', 'p');
  const Text = createElementComponent('MockTypographyText', 'span');
  return {
    Alert: createElementComponent('MockAlert'),
    Button: createElementComponent('MockButton', 'button'),
    Card: createElementComponent('MockCard'),
    Empty: createElementComponent('MockEmpty'),
    Input: createElementComponent('MockInput', 'input'),
    Select: createElementComponent('MockSelect'),
    Space: createElementComponent('MockSpace'),
    Tag: createElementComponent('MockTag', 'span'),
    TextArea: MockTextArea,
    Typography: { Paragraph, Text },
  };
});

vi.mock('#/components/markdown', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    KtMilkdownEditor: defineComponent({
      name: 'MockKtMilkdownEditor',
      setup() {
        return () => h('div');
      },
    }),
  };
});

describe('lLM chat workspace composer', () => {
  it('uses one compact action slot and sends only on a plain Enter', async () => {
    const wrapper = mount(LlmChatWorkspace, {
      props: {
        canSend: true,
        composer: '你好',
      },
    });
    const textArea = wrapper.getComponent({ name: 'MockTextArea' });
    const textarea = wrapper.get('textarea');

    expect(textArea.props('autoSize')).toEqual({ maxRows: 6, minRows: 1 });
    expect(textarea.attributes('maxlength')).toBe('20000');
    expect(wrapper.get('.llm-chat-composer-count').text()).toBe('2 / 20000');
    expect(wrapper.findAll('.llm-chat-composer-action')).toHaveLength(1);
    expect(wrapper.find('[aria-label="发送"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="停止生成"]').exists()).toBe(false);
    expect(wrapper.find('.ant-input-data-count').exists()).toBe(false);

    await textarea.trigger('keydown', {
      key: 'Enter',
      keyCode: 13,
      which: 13,
    });
    await flushPromises();
    expect(wrapper.emitted('send')).toHaveLength(1);

    await textarea.trigger('keydown', {
      key: 'Enter',
      keyCode: 13,
      shiftKey: true,
      which: 13,
    });
    await flushPromises();
    expect(wrapper.emitted('send')).toHaveLength(1);

    await textarea.trigger('keydown', {
      isComposing: true,
      key: 'Enter',
      keyCode: 13,
      which: 13,
    });
    await flushPromises();
    expect(wrapper.emitted('send')).toHaveLength(1);
  });

  it('replaces send with stop while a stream is active', async () => {
    const wrapper = mount(LlmChatWorkspace, {
      props: {
        canSend: false,
        canStop: true,
        composer: '',
      },
    });

    expect(wrapper.findAll('.llm-chat-composer-action')).toHaveLength(1);
    expect(wrapper.find('[aria-label="发送"]').exists()).toBe(false);
    const stop = wrapper.get('[aria-label="停止生成"]');
    await stop.trigger('click');

    expect(wrapper.emitted('stop')).toHaveLength(1);
  });
});
