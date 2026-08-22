/* @vitest-environment happy-dom */

import type { QqbotMessageSubscriberApi } from '#/api/message-management/subscribers/qqbot';

import { flushPromises, mount } from '@vue/test-utils';

import MessagePushTargetPicker, {
  isValidMessagePushTargetId,
} from '@test-source/apps/web-antdv-next/src/views/qqbot/account/components/MessagePushTargetPicker';
import Select from 'antdv-next/dist/select/index';
import { describe, expect, it } from 'vitest';

/** 创建群聊与私聊候选目标。 */
function createOptions(): QqbotMessageSubscriberApi.TargetOption[] {
  return [
    {
      label: '帕鲁测试群',
      targetId: '10000000000000001',
      targetType: 'group',
    },
    {
      label: '测试好友',
      targetId: '20000000000000001',
      targetType: 'private',
    },
  ];
}

/** 按覆盖参数挂载消息推送目标选择器。 */
function mountPicker(
  overrides: Partial<{
    available: boolean;
    connectionMode: QqbotMessageSubscriberApi.TargetOptionsResponse['connectionMode'];
    disabled: boolean;
    loading: boolean;
    manualEntry: boolean;
    options: QqbotMessageSubscriberApi.TargetOption[];
    reasonCode: null | string;
    value: QqbotMessageSubscriberApi.PublishTargetInput[];
  }> = {},
) {
  return mount(MessagePushTargetPicker, {
    props: {
      available: true,
      options: createOptions(),
      reasonCode: null,
      value: [],
      ...overrides,
    },
  });
}

/** 读取选择器最近一次提交的目标数组。 */
function latestValue(
  wrapper: ReturnType<typeof mountPicker>,
): QqbotMessageSubscriberApi.PublishTargetInput[] {
  const emitted = wrapper.emitted('update:value')?.at(-1)?.[0];
  if (!Array.isArray(emitted)) throw new Error('Expected one target update');
  return emitted as QqbotMessageSubscriberApi.PublishTargetInput[];
}

describe('message-push target picker', () => {
  it.each([
    ['', false],
    ['01234', false],
    ['1234', false],
    ['12345', true],
    ['12345678901234567890', true],
    ['123456789012345678901', false],
  ])('validates the exact manual target matrix for %s', (targetId, valid) => {
    expect(isValidMessagePushTargetId(targetId)).toBe(valid);
  });

  it('accepts official OpenIDs while keeping NapCat numeric validation unchanged', () => {
    expect(
      isValidMessagePushTargetId(
        'group_openid-Example_123',
        'official-webhook',
      ),
    ).toBe(true);
    expect(
      isValidMessagePushTargetId('openid/invalid', 'official-websocket'),
    ).toBe(false);
    expect(isValidMessagePushTargetId('group_openid-Example_123')).toBe(false);
  });

  it('renders manual OpenID guidance for official accounts', () => {
    const wrapper = mountPicker({
      connectionMode: 'official-webhook',
      manualEntry: true,
      options: [],
    });
    expect(wrapper.text()).toContain('用户 OpenID 或群 OpenID');
    const selects = wrapper.findAllComponents(Select);
    expect(selects[0]?.props('placeholder')).toBe('输入群 OpenID');
    expect(selects[1]?.props('placeholder')).toBe('输入用户 OpenID');
  });

  it('renders exactly two controlled tags Selects with type-scoped options', () => {
    const wrapper = mountPicker();
    const selects = wrapper.findAllComponents(Select);

    expect(selects).toHaveLength(2);
    expect(
      wrapper.get('.qqbot-message-push-target-picker').attributes('style'),
    ).toContain('width: 100%');
    expect(selects[0]?.props()).toMatchObject({
      mode: 'tags',
      value: [],
    });
    expect(selects[1]?.props()).toMatchObject({
      mode: 'tags',
      value: [],
    });
    expect(selects[0]?.props('labelInValue')).not.toBe(true);
    expect(selects[1]?.props('labelInValue')).not.toBe(true);
    expect(selects[0]?.vm.$.vnode.props?.style).toMatchObject({
      width: '100%',
    });
    expect(selects[1]?.vm.$.vnode.props?.style).toMatchObject({
      width: '100%',
    });
    expect(selects[0]?.props('options')).toEqual([
      expect.objectContaining({
        targetId: '10000000000000001',
        value: '10000000000000001',
      }),
    ]);
    expect(selects[1]?.props('options')).toEqual([
      expect.objectContaining({
        targetId: '20000000000000001',
        value: '20000000000000001',
      }),
    ]);
  });

  it.each([
    [0, '测试群'],
    [0, '100000000000000'],
    [1, '好友'],
    [1, '200000000000000'],
  ])('searches selector %s by known label or string ID', (index, query) => {
    const wrapper = mountPicker();
    const select = wrapper.findAllComponents(Select)[index];
    const option = (select?.props('options') || [])[0] as Record<
      string,
      unknown
    >;
    const filter = select?.props('filterOption') as (
      input: string,
      option: Record<string, unknown>,
    ) => boolean;

    expect(filter(query as string, option)).toBe(true);
    expect(filter('unrelated', option)).toBe(false);
  });

  it('uses actual controlled Select updates for multiple known/manual string IDs', async () => {
    const wrapper = mountPicker();
    const [group, privateSelect] = wrapper.findAllComponents(Select);

    group?.vm.$emit('update:value', ['10000000000000001', '30000000000000001']);
    await flushPromises();
    expect(latestValue(wrapper)).toEqual([
      {
        targetId: '10000000000000001',
        targetName: '帕鲁测试群',
        targetType: 'group',
      },
      { targetId: '30000000000000001', targetType: 'group' },
    ]);

    await wrapper.setProps({ value: latestValue(wrapper) });
    privateSelect?.vm.$emit('update:value', [
      '20000000000000001',
      '40000000000000001',
    ]);
    await flushPromises();
    const combined = latestValue(wrapper);
    expect(combined).toEqual([
      {
        targetId: '10000000000000001',
        targetName: '帕鲁测试群',
        targetType: 'group',
      },
      { targetId: '30000000000000001', targetType: 'group' },
      {
        targetId: '20000000000000001',
        targetName: '测试好友',
        targetType: 'private',
      },
      { targetId: '40000000000000001', targetType: 'private' },
    ]);
    expect(combined.every(({ targetId }) => typeof targetId === 'string')).toBe(
      true,
    );
  });

  it('rejects invalid/non-string values and remounts only that Select', async () => {
    const wrapper = mountPicker({
      value: [
        {
          targetId: '20000000000000001',
          targetName: '测试好友',
          targetType: 'private',
        },
      ],
    });
    const initial = wrapper.findAllComponents(Select);
    const groupKey = initial[0]?.vm.$.vnode.key;
    const privateKey = initial[1]?.vm.$.vnode.key;

    initial[0]?.vm.$emit('update:value', [
      ' 12345 ',
      '01234',
      12_345,
      { value: '99999' },
      '12345',
    ]);
    await flushPromises();

    expect(latestValue(wrapper)).toEqual([
      { targetId: '12345', targetType: 'group' },
      {
        targetId: '20000000000000001',
        targetName: '测试好友',
        targetType: 'private',
      },
    ]);
    const next = wrapper.findAllComponents(Select);
    expect(next[0]?.vm.$.vnode.key).not.toBe(groupKey);
    expect(next[1]?.vm.$.vnode.key).toBe(privateKey);
    expect(next[0]?.props('value')).toEqual([]);
  });

  it('shows the exact unavailable reason while manual input remains enabled', async () => {
    const wrapper = mountPicker({
      available: false,
      options: [],
      reasonCode: 'onebot_unavailable',
    });
    const [group, privateSelect] = wrapper.findAllComponents(Select);

    expect(wrapper.text()).toContain('onebot_unavailable');
    expect(group?.props('disabled')).toBe(false);
    expect(privateSelect?.props('disabled')).toBe(false);
    group?.vm.$emit('update:value', ['12345']);
    await flushPromises();
    expect(latestValue(wrapper)).toEqual([
      { targetId: '12345', targetType: 'group' },
    ]);
  });

  it('keeps names only for the same type and omits unknown manual names', async () => {
    const equalId = '10000000000000001';
    const wrapper = mountPicker({
      options: [
        {
          label: '群名称',
          targetId: equalId,
          targetType: 'group',
        },
        {
          label: '私聊名称',
          targetId: equalId,
          targetType: 'private',
        },
      ],
    });
    const [group, privateSelect] = wrapper.findAllComponents(Select);
    group?.vm.$emit('update:value', [equalId, '30000000000000001']);
    await flushPromises();
    await wrapper.setProps({ value: latestValue(wrapper) });
    privateSelect?.vm.$emit('update:value', [equalId]);
    await flushPromises();

    expect(latestValue(wrapper)).toEqual([
      {
        targetId: equalId,
        targetName: '群名称',
        targetType: 'group',
      },
      { targetId: '30000000000000001', targetType: 'group' },
      {
        targetId: equalId,
        targetName: '私聊名称',
        targetType: 'private',
      },
    ]);
  });

  it('preserves an existing same-type API name when candidates are unavailable', async () => {
    const wrapper = mountPicker({
      available: false,
      options: [],
      reasonCode: 'onebot_unavailable',
      value: [
        {
          targetId: '10000000000000001',
          targetName: '历史群名',
          targetType: 'group',
        },
      ],
    });
    const group = wrapper.findAllComponents(Select)[0];

    group?.vm.$emit('update:value', ['10000000000000001', '30000000000000001']);
    await flushPromises();
    expect(latestValue(wrapper)).toEqual([
      {
        targetId: '10000000000000001',
        targetName: '历史群名',
        targetType: 'group',
      },
      { targetId: '30000000000000001', targetType: 'group' },
    ]);
  });

  it('removing one type leaves the other controlled values untouched', async () => {
    const wrapper = mountPicker({
      value: [
        { targetId: '10000000000000001', targetType: 'group' },
        {
          targetId: '20000000000000001',
          targetName: '测试好友',
          targetType: 'private',
        },
      ],
    });
    const group = wrapper.findAllComponents(Select)[0];

    group?.vm.$emit('update:value', []);
    await flushPromises();
    expect(latestValue(wrapper)).toEqual([
      {
        targetId: '20000000000000001',
        targetName: '测试好友',
        targetType: 'private',
      },
    ]);
  });
});
