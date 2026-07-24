/* @vitest-environment happy-dom */

/* eslint-disable no-template-curly-in-string */

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { flushPromises, mount } from '@vue/test-utils';

import Mentions from 'antdv-next/dist/mentions/index';
import { describe, expect, it } from 'vitest';

import MessageTemplateMentions from './MessageTemplateMentions';

/** Creates one complete source-variable fixture for Mentions behavior. */
function createVariable(
  overrides: Partial<QqbotMessagePushApi.SystemMessageSourceVariableDefinition> = {},
): QqbotMessagePushApi.SystemMessageSourceVariableDefinition {
  return {
    description: '组合后的完整服务端地址',
    example: 'pal.kwitsukasa.top:38213',
    key: 'endpoint',
    label: '连接端点',
    type: 'string',
    ...overrides,
  };
}

describe('message template mentions', () => {
  it('uses the installed runtime to insert exactly one complete token', async () => {
    const wrapper = mount(MessageTemplateMentions, {
      attachTo: document.body,
      props: {
        value: '$',
        variables: [createVariable()],
      },
    });
    const textarea = wrapper.get('textarea');
    const element = textarea.element as HTMLTextAreaElement;
    element.focus();
    element.setSelectionRange(1, 1);
    await textarea.trigger('keyup', { key: '$', keyCode: 52, which: 52 });
    await textarea.trigger('keydown', {
      key: 'Enter',
      keyCode: 13,
      which: 13,
    });
    await flushPromises();

    expect(wrapper.emitted('update:value')?.at(-1)).toEqual(['${{endpoint}}']);
    wrapper.unmount();
  });

  it('forwards the locked option values and Mentions mechanics', () => {
    const variables = [
      createVariable(),
      createVariable({ key: 'port', label: '公网端口' }),
    ];
    const wrapper = mount(MessageTemplateMentions, {
      props: { value: 'literal', variables },
    });
    const mentions = wrapper.getComponent(Mentions);
    const options = mentions.props('options') || [];

    expect(options).toEqual([
      expect.objectContaining({ value: '{{endpoint}}' }),
      expect.objectContaining({ value: '{{port}}' }),
    ]);
    expect(mentions.props()).toMatchObject({
      prefix: '$',
      rows: 4,
      split: '',
      value: 'literal',
    });
    expect(wrapper.get('textarea').attributes('maxlength')).toBe('2000');
    expect(options.some((option) => option.value === 'endpoint')).toBe(false);
    expect(options.some((option) => option.value === '${{endpoint}}')).toBe(
      false,
    );
  });

  it.each([
    ['key', 'ENDpoint'],
    ['label', '连接端'],
    ['description', '完整服务'],
    ['example', 'KWITSUKASA'],
  ])('searches independently by %s', (_, query) => {
    const wrapper = mount(MessageTemplateMentions, {
      props: { variables: [createVariable()] },
    });
    const mentions = wrapper.getComponent(Mentions);
    const option = (mentions.props('options') || [])[0];
    const filter = mentions.props('filterOption') as (
      input: string,
      option: Record<string, unknown>,
    ) => boolean;

    expect(option).toBeDefined();
    if (!option) throw new Error('Expected one variable option');
    const searchableOption = option as unknown as Record<string, unknown>;
    expect(filter(query, searchableOption)).toBe(true);
    expect(filter('unrelated-value', searchableOption)).toBe(false);
  });

  it('keeps disabled, loading, and value controlled', async () => {
    const wrapper = mount(MessageTemplateMentions, {
      props: {
        disabled: true,
        loading: true,
        value: 'server-owned',
        variables: [createVariable()],
      },
    });
    const mentions = wrapper.getComponent(Mentions);

    expect(mentions.props()).toMatchObject({
      disabled: true,
      loading: true,
      value: 'server-owned',
    });
    expect(wrapper.emitted('update:value')).toBeUndefined();
  });

  it('emits CQ-looking content as literal controlled text', async () => {
    const wrapper = mount(MessageTemplateMentions, {
      props: {
        value: '[CQ:at,qq=12345]',
        variables: [createVariable()],
      },
    });
    const mentions = wrapper.getComponent(Mentions);
    mentions.vm.$emit('update:value', '[CQ:at,qq=12345] $literal');
    await flushPromises();

    expect(wrapper.emitted('update:value')?.at(-1)).toEqual([
      '[CQ:at,qq=12345] $literal',
    ]);
    expect(wrapper.html()).not.toContain('innerHTML');
  });
});
