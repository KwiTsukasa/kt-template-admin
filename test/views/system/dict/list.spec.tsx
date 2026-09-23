/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
/* @vitest-environment happy-dom */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import KtTable from '@test-source/apps/web-antdv-next/src/components/kt-table/KtTable';
import DictPage from '@test-source/apps/web-antdv-next/src/views/system/dict/list';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  codes: vi.fn(),
  groups: vi.fn(),
  items: vi.fn(),
  media: undefined as any,
  modalData: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>();
  mocks.media = ref(false);
  return { ...actual, useMediaQuery: () => mocks.media };
});

vi.mock('#/api/system/dict', () => ({
  deleteDict: mocks.remove,
  getDictCodeOptions: mocks.codes,
  getDictGroups: mocks.groups,
  getDictList: mocks.items,
  toggleDictStatus: vi.fn(),
}));
vi.mock('#/hooks/useDict', () => ({ clearDictCache: vi.fn() }));
vi.mock('#/adapter/form', () => ({
  useVbenForm: () => [
    defineComponent({ setup: () => () => h('form') }),
    {
      getValues: vi.fn(async () => ({})),
      resetForm: vi.fn(async () => undefined),
      setState: vi.fn(),
      setValues: vi.fn(async () => undefined),
      validate: vi.fn(async () => ({ valid: true })),
    },
  ],
  z: {},
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  }),
  useVbenModal: () => {
    const api = {
      open: vi.fn(),
      setData: vi.fn((value) => {
        mocks.modalData(value);
        return api;
      }),
    };
    return [
      defineComponent({
        name: 'FakeModal',
        emits: ['success'],
        setup: () => () => h('div'),
      }),
      api,
    ];
  },
}));
vi.mock('antdv-next', () => {
  const Box = defineComponent({
    setup(_, { slots }) {
      return () => h('div', [slots.default?.(), slots.content?.()]);
    },
  });
  return {
    Alert: defineComponent({
      props: { action: null, title: String },
      setup(props) {
        return () => h('div', { role: 'alert' }, [props.title, props.action]);
      },
    }),
    Button: Box,
    Checkbox: Box,
    Divider: Box,
    Modal: { confirm: vi.fn() },
    Pagination: Box,
    Popover: Box,
    Select: defineComponent({
      name: 'FakeSelect',
      props: { options: Array, value: String },
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
            (props.options || []).map((item: any) =>
              h('option', { value: item.value }, item.label),
            ),
          );
      },
    }),
    Space: Box,
    Table: defineComponent({
      props: {
        dataSource: { default: () => [], type: Array },
        onRow: Function,
      },
      setup(props) {
        return () =>
          h(
            'div',
            { 'data-rows': '' },
            props.dataSource.map((row: any) =>
              h(
                'button',
                {
                  'data-row': row.dictCode || row.id,
                  onClick: (event: MouseEvent) =>
                    props.onRow?.(row)?.onClick(event),
                },
                row.id,
              ),
            ),
          );
      },
    }),
    TableSummary: Box,
    TableSummaryCell: Box,
    TableSummaryRow: Box,
    Tag: Box,
    Tooltip: Box,
    message: { loading: vi.fn(), success: vi.fn() },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.media.value = false;
  mocks.groups.mockResolvedValue({
    items: [
      { dictCode: 'A', id: 'group-a', itemCount: 1 },
      { dictCode: 'B', id: 'group-b', itemCount: 1 },
    ],
    total: 2,
  });
  mocks.items.mockImplementation(async (params) => {
    if (params.dictCode === 'A') {
      return { items: [{ dictCode: 'A', id: 'easy' }], total: 1 };
    }
    throw new Error('B offline');
  });
  mocks.codes.mockResolvedValue([
    { label: 'A', value: 'A' },
    { label: 'B', value: 'B' },
  ]);
  mocks.remove.mockResolvedValue(undefined);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(560);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
    })),
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * 控制先后完成的字典读取，以验证过期响应不会更换当前展示身份。
 * @returns 可手动兑现的异步读取结果。
 */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}

/**
 * 从当前页面的字典项表格读取真实公开重试入口。
 * @param wrapper - 已挂载的字典主从页面。
 * @returns 当前字典项表格的公开加载方法。
 */
function itemTableApi(wrapper: ReturnType<typeof mount>) {
  const tables = wrapper.findAllComponents(KtTable);
  const itemTable = tables[tables.length - 1];
  return (itemTable?.vm as any).$?.exposed as { reload: () => Promise<void> };
}

describe('system dictionary visible identity', () => {
  it('keeps the displayed A identity and rows when requesting B fails', async () => {
    const wrapper = mount(DictPage);
    await flushPromises();
    expect(wrapper.text()).toContain('字典项：A');
    expect(wrapper.findAll('[data-rows]')[1]?.text()).toContain('easy');
    await wrapper.get('[data-row="B"]').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[data-rows]')[1]?.text()).toContain('easy');
    expect(wrapper.text()).toContain('字典项：A');
    expect(
      wrapper.find('.dict-page__groups .kt-table__load-error').exists(),
    ).toBe(false);
    expect(
      wrapper.find('.dict-page__items .kt-table__load-error').exists(),
    ).toBe(true);
    const create = wrapper.get(
      '.dict-page__items .kt-table__header-button > div > div',
    );
    await create.trigger('click');
    expect(mocks.modalData.mock.lastCall?.[0]).toEqual({ dictCode: 'A' });
    mocks.items.mockImplementation(async (params) => ({
      items: [{ dictCode: params.dictCode, id: 'cn' }],
      total: 1,
    }));
    await itemTableApi(wrapper).reload();
    await flushPromises();
    expect(mocks.items.mock.lastCall?.[0]).toMatchObject({ dictCode: 'B' });
    expect(wrapper.findAll('[data-rows]')[1]?.text()).toContain('cn');
    expect(wrapper.text()).toContain('字典项：B');
    wrapper.unmount();
  });

  it('keeps B after its newer response wins over a late A response', async () => {
    const first = deferred<{
      items: Array<{ dictCode: string; id: string }>;
      total: number;
    }>();
    const second = deferred<{
      items: Array<{ dictCode: string; id: string }>;
      total: number;
    }>();
    mocks.items.mockImplementation((params) => {
      if (params.dictCode === 'A') return first.promise;
      return second.promise;
    });
    const wrapper = mount(DictPage);
    await flushPromises();
    await wrapper.get('[data-row="B"]').trigger('click');
    await flushPromises();
    second.resolve({ items: [{ dictCode: 'B', id: 'cn' }], total: 1 });
    await flushPromises();
    expect(wrapper.text()).toContain('字典项：B');
    expect(wrapper.findAll('[data-rows]')[1]?.text()).toContain('cn');
    first.resolve({ items: [{ dictCode: 'A', id: 'easy' }], total: 1 });
    await flushPromises();
    expect(wrapper.text()).toContain('字典项：B');
    expect(wrapper.findAll('[data-rows]')[1]?.text()).toContain('cn');
    wrapper.unmount();
  });

  it('does not invent a selection when the accepted group directory is empty', async () => {
    mocks.groups.mockResolvedValueOnce({ items: [], total: 0 });
    const wrapper = mount(DictPage);
    await flushPromises();
    expect(wrapper.text()).toContain('字典项');
    expect(wrapper.text()).not.toContain('字典项：');
    expect(mocks.items).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does not prefill a new item before any group is confirmed', async () => {
    const pendingGroups = deferred<{
      items: Array<{ dictCode: string; id: string; itemCount: number }>;
      total: number;
    }>();
    mocks.groups.mockImplementationOnce(() => pendingGroups.promise);
    const wrapper = mount(DictPage);
    await flushPromises();
    const create = wrapper.get(
      '.dict-page__items .kt-table__header-button > div > div',
    );
    await create.trigger('click');
    expect(mocks.modalData.mock.lastCall?.[0]).toBeUndefined();
    pendingGroups.resolve({
      items: [{ dictCode: 'A', id: 'group-a', itemCount: 1 }],
      total: 1,
    });
    await flushPromises();
    await create.trigger('click');
    expect(mocks.modalData.mock.lastCall?.[0]).toEqual({ dictCode: 'A' });
    wrapper.unmount();
  });

  it('refreshes the desktop group directory and item table once after saving', async () => {
    const wrapper = mount(DictPage);
    await flushPromises();
    const groupCalls = mocks.groups.mock.calls.length;
    const itemCalls = mocks.items.mock.calls.length;
    wrapper.findComponent({ name: 'FakeModal' }).vm.$emit('success');
    await flushPromises();
    expect(mocks.groups).toHaveBeenCalledTimes(groupCalls + 1);
    expect(mocks.items).toHaveBeenCalledTimes(itemCalls + 1);
    wrapper.unmount();
  });

  it('corrects an absent desktop selection after the group page is accepted', async () => {
    const wrapper = mount(DictPage);
    await flushPromises();
    mocks.groups.mockResolvedValueOnce({
      items: [{ dictCode: 'C', id: 'group-c', itemCount: 1 }],
      total: 1,
    });
    mocks.items.mockImplementation(async (params) => ({
      items: [{ dictCode: params.dictCode, id: 'item-c' }],
      total: 1,
    }));
    const groupTable = wrapper.findAllComponents(KtTable)[0];
    const api = (groupTable?.vm as any).$?.exposed as {
      reload: () => Promise<void>;
    };
    await api.reload();
    await flushPromises();
    expect(mocks.items.mock.lastCall?.[0]).toMatchObject({ dictCode: 'C' });
    expect(wrapper.text()).toContain('字典项：C');
    wrapper.unmount();
  });

  it('uses complete code options on compact width and preserves the item table instance', async () => {
    mocks.media.value = true;
    const wrapper = mount(DictPage);
    await flushPromises();
    expect(mocks.groups).not.toHaveBeenCalled();
    expect(mocks.codes).toHaveBeenCalledOnce();
    expect(mocks.items).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('字典项：A');
    const originalItem = wrapper.findComponent(KtTable).vm;
    mocks.media.value = false;
    await flushPromises();
    expect(mocks.groups).toHaveBeenCalledOnce();
    expect(mocks.items).toHaveBeenCalledOnce();
    expect(wrapper.findAllComponents(KtTable)[1]?.vm).toBe(originalItem);
    mocks.media.value = true;
    await flushPromises();
    expect(mocks.codes).toHaveBeenCalledOnce();
    expect(mocks.items).toHaveBeenCalledOnce();
    expect(wrapper.findComponent(KtTable).vm).toBe(originalItem);
    wrapper.unmount();
  });

  it('selects a code outside the desktop group page through complete compact options', async () => {
    mocks.media.value = true;
    mocks.codes.mockResolvedValueOnce([
      { label: 'A', value: 'A' },
      { label: 'C', value: 'C' },
    ]);
    mocks.items.mockImplementation(async (params) => ({
      items: [{ dictCode: params.dictCode, id: params.dictCode }],
      total: 1,
    }));
    const wrapper = mount(DictPage);
    await flushPromises();
    await wrapper.get('.dict-page__selector select').setValue('C');
    await flushPromises();
    expect(mocks.groups).not.toHaveBeenCalled();
    expect(mocks.items.mock.lastCall?.[0]).toMatchObject({ dictCode: 'C' });
    expect(wrapper.text()).toContain('字典项：C');
    wrapper.unmount();
  });

  it('keeps compact selector on displayed A while B fails, then retries B', async () => {
    mocks.media.value = true;
    const wrapper = mount(DictPage);
    await flushPromises();
    expect(wrapper.findComponent({ name: 'FakeSelect' }).props('value')).toBe(
      'A',
    );
    await wrapper.get('.dict-page__selector select').setValue('B');
    await flushPromises();
    expect(mocks.items.mock.lastCall?.[0]).toMatchObject({ dictCode: 'B' });
    expect(wrapper.findComponent({ name: 'FakeSelect' }).props('value')).toBe(
      'A',
    );
    expect(wrapper.text()).toContain('字典项：A');
    mocks.items.mockImplementation(async (params) => ({
      items: [{ dictCode: params.dictCode, id: 'cn' }],
      total: 1,
    }));
    await itemTableApi(wrapper).reload();
    await flushPromises();
    expect(wrapper.findComponent({ name: 'FakeSelect' }).props('value')).toBe(
      'B',
    );
    expect(wrapper.text()).toContain('字典项：B');
    expect(wrapper.get('[data-rows]').text()).toContain('cn');
    wrapper.unmount();
  });

  it('refreshes compact options and items once after saving', async () => {
    mocks.media.value = true;
    const wrapper = mount(DictPage);
    await flushPromises();
    const codeCalls = mocks.codes.mock.calls.length;
    const itemCalls = mocks.items.mock.calls.length;
    wrapper.findComponent({ name: 'FakeModal' }).vm.$emit('success');
    await flushPromises();
    expect(mocks.codes).toHaveBeenCalledTimes(codeCalls + 1);
    expect(mocks.items).toHaveBeenCalledTimes(itemCalls + 1);
    expect(mocks.groups).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('refreshes saved rows even when the compact code directory fails, without retrying unchanged rows twice', async () => {
    mocks.media.value = true;
    const wrapper = mount(DictPage);
    await flushPromises();
    mocks.codes.mockRejectedValueOnce(new Error('codes offline'));
    mocks.items.mockResolvedValue({
      items: [{ dictCode: 'A', id: 'updated' }],
      total: 1,
    });
    wrapper.findComponent({ name: 'FakeModal' }).vm.$emit('success');
    await flushPromises();
    expect(wrapper.text()).toContain('字典编码读取失败');
    expect(wrapper.get('[data-rows]').text()).toContain('updated');
    const itemCalls = mocks.items.mock.calls.length;
    const retry = wrapper
      .findAll('.dict-page__selector div')
      .find((element) => element.text() === '重试');
    await retry?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('字典项：A');
    expect(mocks.items).toHaveBeenCalledTimes(itemCalls);
    wrapper.unmount();
  });

  it('refreshes deleted rows after compact code failure and keeps the same-code retry single', async () => {
    mocks.media.value = true;
    const wrapper = mount(DictPage);
    await flushPromises();
    mocks.codes.mockRejectedValueOnce(new Error('codes offline'));
    mocks.items.mockResolvedValue({ items: [], total: 0 });
    const itemApi = itemTableApi(wrapper) as any;
    const action = itemApi
      .getProps()
      .rowActions.find((item: { key: string }) => item.key === 'delete');
    await action.onClick({ dictCode: 'A', id: 'easy', label: 'easy' });
    await flushPromises();
    expect(mocks.remove).toHaveBeenCalledWith('easy');
    expect(wrapper.get('[data-rows]').text()).not.toContain('easy');
    expect(wrapper.text()).toContain('字典编码读取失败');
    const itemCalls = mocks.items.mock.calls.length;
    const retry = wrapper
      .findAll('.dict-page__selector div')
      .find((element) => element.text() === '重试');
    await retry?.trigger('click');
    await flushPromises();
    expect(mocks.items).toHaveBeenCalledTimes(itemCalls);
    wrapper.unmount();
  });

  it('discards a pre-save pending code directory and reads a fresh post-save directory', async () => {
    const oldCodes = deferred<Array<{ label: string; value: string }>>();
    mocks.media.value = true;
    mocks.codes.mockImplementationOnce(() => oldCodes.promise);
    mocks.codes.mockResolvedValueOnce([{ label: 'B', value: 'B' }]);
    mocks.items.mockResolvedValue({
      items: [{ dictCode: 'B', id: 'new-b' }],
      total: 1,
    });
    const wrapper = mount(DictPage);
    await flushPromises();
    wrapper.findComponent({ name: 'FakeModal' }).vm.$emit('success');
    await flushPromises();
    expect(mocks.codes).toHaveBeenCalledOnce();
    oldCodes.resolve([{ label: 'A', value: 'A' }]);
    await flushPromises();
    expect(mocks.codes).toHaveBeenCalledTimes(2);
    expect(mocks.items).toHaveBeenCalledOnce();
    expect(mocks.items.mock.lastCall?.[0]).toMatchObject({ dictCode: 'B' });
    expect(wrapper.text()).toContain('字典项：B');
    wrapper.unmount();
  });

  it('does not repeat B when a pending code retry merely confirms the user-selected B', async () => {
    const pendingCodes = deferred<Array<{ label: string; value: string }>>();
    mocks.media.value = true;
    const wrapper = mount(DictPage);
    await flushPromises();
    mocks.codes.mockRejectedValueOnce(new Error('codes offline'));
    wrapper.findComponent({ name: 'FakeModal' }).vm.$emit('success');
    await flushPromises();
    mocks.codes.mockImplementationOnce(() => pendingCodes.promise);
    const retry = wrapper
      .findAll('.dict-page__selector div')
      .find((element) => element.text() === '重试');
    await retry?.trigger('click');
    await wrapper.get('.dict-page__selector select').setValue('B');
    await flushPromises();
    const itemCalls = mocks.items.mock.calls.length;
    pendingCodes.resolve([
      { label: 'A', value: 'A' },
      { label: 'B', value: 'B' },
    ]);
    await flushPromises();
    expect(mocks.items).toHaveBeenCalledTimes(itemCalls);
    expect(mocks.items.mock.lastCall?.[0]).toMatchObject({ dictCode: 'B' });
    wrapper.unmount();
  });

  it('refreshes compact options after a desktop save changes the directory', async () => {
    mocks.media.value = true;
    const wrapper = mount(DictPage);
    await flushPromises();
    mocks.media.value = false;
    await flushPromises();
    wrapper.findComponent({ name: 'FakeModal' }).vm.$emit('success');
    await flushPromises();
    mocks.media.value = true;
    await flushPromises();
    expect(mocks.codes).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('字典项：A');
    wrapper.unmount();
  });

  it('consumes a failed desktop group refresh at the save event boundary', async () => {
    const wrapper = mount(DictPage);
    await flushPromises();
    const itemCalls = mocks.items.mock.calls.length;
    mocks.groups.mockRejectedValueOnce(new Error('groups offline'));
    mocks.items.mockResolvedValue({
      items: [{ dictCode: 'A', id: 'updated' }],
      total: 1,
    });
    wrapper.findComponent({ name: 'FakeModal' }).vm.$emit('success');
    await flushPromises();
    expect(
      wrapper.find('.dict-page__groups .kt-table__load-error').exists(),
    ).toBe(true);
    expect(mocks.items).toHaveBeenCalledTimes(itemCalls + 1);
    expect(wrapper.findAll('[data-rows]')[1]?.text()).toContain('updated');
    expect(wrapper.text()).toContain('字典项：A');
    const groupTable = wrapper.findAllComponents(KtTable)[0];
    const groupApi = (groupTable?.vm as any).$?.exposed as {
      reload: () => Promise<void>;
    };
    await groupApi.reload();
    await flushPromises();
    expect(mocks.items).toHaveBeenCalledTimes(itemCalls + 2);
    expect(mocks.items.mock.lastCall?.[0]).toMatchObject({ dictCode: 'A' });
    expect(wrapper.text()).toContain('字典项：A');
    expect(wrapper.findAll('[data-rows]')[1]?.text()).toContain('updated');
    wrapper.unmount();
  });

  it('consumes a failed compact item refresh at the save event boundary', async () => {
    mocks.media.value = true;
    const wrapper = mount(DictPage);
    await flushPromises();
    mocks.items.mockRejectedValueOnce(new Error('items offline'));
    wrapper.findComponent({ name: 'FakeModal' }).vm.$emit('success');
    await flushPromises();
    expect(
      wrapper.find('.dict-page__items .kt-table__load-error').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain('字典项：A');
    wrapper.unmount();
  });

  it('ignores a compact code directory that finishes after switching to desktop', async () => {
    const pendingCodes = deferred<Array<{ label: string; value: string }>>();
    mocks.media.value = true;
    mocks.codes.mockImplementationOnce(() => pendingCodes.promise);
    const wrapper = mount(DictPage);
    await flushPromises();
    mocks.media.value = false;
    await flushPromises();
    expect(wrapper.text()).toContain('字典项：A');
    pendingCodes.resolve([{ label: 'B', value: 'B' }]);
    await flushPromises();
    expect(wrapper.text()).toContain('字典项：A');
    expect(mocks.items.mock.lastCall?.[0]).toMatchObject({ dictCode: 'A' });
    wrapper.unmount();
  });

  it('keeps unknown compact options retryable without erasing displayed rows', async () => {
    mocks.media.value = true;
    mocks.codes.mockRejectedValueOnce(new Error('codes offline'));
    const wrapper = mount(DictPage);
    await flushPromises();
    expect(wrapper.text()).toContain('字典编码读取失败');
    expect(wrapper.text()).not.toContain('暂无字典编码');
    expect(mocks.items).not.toHaveBeenCalled();
    const retry = wrapper
      .findAll('.dict-page__selector div')
      .find((element) => element.text() === '重试');
    await retry?.trigger('click');
    await flushPromises();
    expect(mocks.codes).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('字典项：A');
    wrapper.unmount();
  });

  it('shows a confirmed empty compact directory without requesting invented items', async () => {
    mocks.media.value = true;
    mocks.codes.mockResolvedValueOnce([]);
    const wrapper = mount(DictPage);
    await flushPromises();
    expect(wrapper.text()).toContain('暂无字典编码');
    expect(wrapper.text()).not.toContain('字典项：');
    expect(mocks.items).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
