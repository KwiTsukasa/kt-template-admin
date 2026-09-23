/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
/* @vitest-environment happy-dom */

import type { KtTableRegisterApi } from '@test-source/apps/web-antdv-next/src/components/kt-table/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import KtTable from '@test-source/apps/web-antdv-next/src/components/kt-table/KtTable';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getValues: vi.fn(async () => ({})),
  resetForm: vi.fn(async () => undefined),
  validate: vi.fn(async () => ({ valid: true })),
}));

vi.mock('#/adapter/form', () => ({
  useVbenForm: () => [
    defineComponent({ setup: () => () => h('form') }),
    {
      getValues: mocks.getValues,
      resetForm: mocks.resetForm,
      setState: vi.fn(),
      setValues: vi.fn(async () => undefined),
      validate: mocks.validate,
    },
  ],
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('antdv-next', () => {
  const Box = defineComponent({
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  });
  return {
    Alert: defineComponent({
      props: { action: Object, title: String },
      setup(props) {
        return () =>
          h('div', { role: 'alert' }, [props.title, props.action as any]);
      },
    }),
    Button: defineComponent({
      setup(_, { attrs, slots }) {
        return () => h('button', attrs, slots.default?.());
      },
    }),
    Checkbox: Box,
    Divider: Box,
    Modal: { confirm: vi.fn() },
    Pagination: defineComponent({
      props: { current: Number, pageSize: Number, total: Number },
      emits: ['change'],
      setup(props, { emit }) {
        return () =>
          h(
            'div',
            {
              'data-page': String(props.current),
              'data-size': String(props.pageSize),
              'data-total': String(props.total),
            },
            [
              h(
                'button',
                {
                  onClick: () =>
                    emit('change', (props.current ?? 1) + 1, props.pageSize),
                },
                'next',
              ),
              h('button', { onClick: () => emit('change', 1, 20) }, 'size-20'),
            ],
          );
      },
    }),
    Popover: Box,
    Space: Box,
    Table: defineComponent({
      props: {
        columns: { default: () => [], type: Array },
        dataSource: { default: () => [], type: Array },
        loading: Boolean,
        locale: Object,
      },
      setup(props, { slots }) {
        return () =>
          h(
            'div',
            {
              'data-loading': String(props.loading),
              'data-empty-text': (props.locale as { emptyText?: string })
                ?.emptyText,
              'data-table': '',
            },
            props.dataSource.map((row: any, index: number) => {
              const indexColumn = (
                props.columns as Array<{ key: string }>
              ).find((column) => column.key === '__kt_table_index__');
              return h('div', [
                h('span', { 'data-row': '' }, row.id),
                h(
                  'span',
                  { 'data-index': '' },
                  slots.bodyCell?.({
                    column: indexColumn,
                    index,
                    record: row,
                  }),
                ),
              ]);
            }),
          );
      },
    }),
    TableSummary: Box,
    TableSummaryCell: Box,
    TableSummaryRow: Box,
    Tooltip: Box,
  };
});

/**
 * 返回手动完成的接口请求，控制表格请求的完成顺序。
 * @returns Promise 和对应的成功、失败函数。
 */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

/**
 * 使用真实 KtTable 与可控接口安装列表，保留公开注册 API。
 * @param list - 本次测试的分页数据接口。
 * @param extraProps - 覆盖用例所需的分页、数据源或自动加载等表格配置。
 * @returns 表格容器和已注册 API。
 * @throws 表格未触发 register 而无法取得公开 API 时抛出。
 */
function mountTable(
  list: ReturnType<typeof vi.fn>,
  extraProps: Record<string, unknown> = {},
) {
  let api: KtTableRegisterApi | undefined;
  const wrapper = mount(KtTable, {
    props: {
      api: { list },
      columns: [{ dataIndex: 'id', key: 'id', title: '标识' }],
      immediate: false,
      onRegister: (value: KtTableRegisterApi) => {
        api = value;
      },
      rowKey: 'id',
      showDefaultButtons: false,
      showHeader: false,
      showIndex: true,
      showSelection: false,
      ...extraProps,
    } as any,
  });
  if (!api) throw new Error('KtTable 未注册');
  return { api, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getValues.mockResolvedValue({});
  mocks.resetForm.mockResolvedValue(undefined);
  mocks.validate.mockResolvedValue({ valid: true });
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ktTable request ownership', () => {
  it('keeps the newer B rows when older A completes late', async () => {
    const a = deferred<{ items: Array<{ id: string }>; total: number }>();
    const b = deferred<{ items: Array<{ id: string }>; total: number }>();
    const list = vi
      .fn()
      .mockImplementationOnce(() => a.promise)
      .mockImplementationOnce(() => b.promise);
    const afterFetch = vi.fn(async (result) => result);
    const onAfterFetch = vi.fn(async () => undefined);
    const { api, wrapper } = mountTable(list, {
      afterFetch,
      hooks: [{ name: 'audit', onAfterFetch }],
    });
    const first = api.reload();
    await flushPromises();
    const second = api.reload();
    await flushPromises();
    b.resolve({ items: [{ id: 'B' }], total: 1 });
    await second;
    a.resolve({ items: [{ id: 'A' }], total: 1 });
    await first;
    expect(wrapper.get('[data-row]').text()).toBe('B');
    expect(afterFetch).toHaveBeenCalledTimes(1);
    expect(onAfterFetch).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('retains the displayed page when searching again fails', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'page-1' }], total: 60 })
      .mockResolvedValueOnce({ items: [{ id: 'page-2' }], total: 60 })
      .mockRejectedValueOnce(new Error('offline'));
    const { api, wrapper } = mountTable(list);
    await api.reload();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-page]').attributes('data-page')).toBe('2');
    await expect(api.search()).rejects.toThrow('offline');
    expect(wrapper.get('[data-row]').text()).toBe('page-2');
    expect(wrapper.get('[data-page]').attributes('data-page')).toBe('2');
    wrapper.unmount();
  });

  it('keeps old rows and page while a failed target page and size can be retried', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 'page-1' }], total: 60 })
      .mockResolvedValueOnce({ items: [{ id: 'page-2' }], total: 60 })
      .mockRejectedValueOnce(new Error('page failed'))
      .mockResolvedValueOnce({ items: [{ id: 'page-3' }], total: 60 })
      .mockRejectedValueOnce(new Error('size failed'))
      .mockResolvedValueOnce({ items: [{ id: 'size-20' }], total: 60 });
    const { api, wrapper } = mountTable(list);
    await api.reload();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-row]').text()).toBe('page-2');
    expect(wrapper.get('[data-page]').attributes('data-page')).toBe('2');
    expect(wrapper.get('[data-index]').text()).toBe('11');
    expect(wrapper.get('[data-total]').attributes('data-total')).toBe('60');
    expect(wrapper.get('[role="alert"]').text()).toContain('列表加载失败');
    expect(list.mock.lastCall?.[0]).toMatchObject({ pageNo: 3, pageSize: 10 });
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-row]').text()).toBe('page-3');
    expect(wrapper.get('[data-page]').attributes('data-page')).toBe('3');
    expect(list.mock.lastCall?.[0]).toMatchObject({ pageNo: 3, pageSize: 10 });

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'size-20')
      ?.trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-row]').text()).toBe('page-3');
    expect(wrapper.get('[data-page]').attributes('data-page')).toBe('3');
    expect(wrapper.get('[data-size]').attributes('data-size')).toBe('10');
    expect(list.mock.lastCall?.[0]).toMatchObject({ pageNo: 1, pageSize: 20 });
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-row]').text()).toBe('size-20');
    expect(wrapper.get('[data-page]').attributes('data-page')).toBe('1');
    expect(wrapper.get('[data-size]').attributes('data-size')).toBe('20');
    wrapper.unmount();
  });

  it('does not let an older failure clear a newer request loading state', async () => {
    const older = deferred<{ items: Array<{ id: string }>; total: number }>();
    const newer = deferred<{ items: Array<{ id: string }>; total: number }>();
    const list = vi
      .fn()
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);
    const { api, wrapper } = mountTable(list);
    const first = api.reload();
    await flushPromises();
    const second = api.reload();
    await flushPromises();
    older.reject(new Error('old failed'));
    await expect(first).rejects.toThrow('old failed');
    expect(wrapper.get('[data-loading]').attributes('data-loading')).toBe(
      'true',
    );
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    newer.resolve({ items: [{ id: 'new' }], total: 1 });
    await second;
    expect(wrapper.get('[data-loading]').attributes('data-loading')).toBe(
      'false',
    );
    wrapper.unmount();
  });

  it('stops a stale request during async beforeFetch before it reaches list', async () => {
    const slow = deferred<Record<string, unknown>>();
    const beforeFetch = vi
      .fn()
      .mockImplementationOnce(() => slow.promise)
      .mockImplementationOnce(async (params) => params);
    const list = vi.fn(async () => ({ items: [{ id: 'current' }], total: 1 }));
    const { api, wrapper } = mountTable(list, { beforeFetch });
    const first = api.reload();
    await flushPromises();
    const second = api.reload();
    await second;
    slow.resolve({ pageNo: 1 });
    await first;
    expect(list).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-row]').text()).toBe('current');
    wrapper.unmount();
  });

  it('shows an initial failure and retries the same request intent', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [{ id: 'recovered' }], total: 1 });
    const { api, wrapper } = mountTable(list);
    await expect(api.reload()).rejects.toThrow('offline');
    expect(wrapper.get('[data-empty-text]').attributes('data-empty-text')).toBe(
      '加载失败，请重试',
    );
    expect(wrapper.get('[role="alert"]').text()).toContain('列表加载失败');
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-row]').text()).toBe('recovered');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(list.mock.calls.map((call) => call[0].pageNo)).toEqual([1, 1]);
    wrapper.unmount();
  });

  it('validates before fetching, then search and reset request the first page', async () => {
    const list = vi.fn(async (_params: Record<string, unknown>) => ({
      items: [{ id: 'row' }],
      total: 60,
    }));
    const { api, wrapper } = mountTable(list, {
      formOptions: { schema: [{ component: 'Input', fieldName: 'name' }] },
    });
    mocks.validate.mockResolvedValueOnce({ valid: false });
    await api.search();
    expect(list).not.toHaveBeenCalled();
    expect(wrapper.get('[data-loading]').attributes('data-loading')).toBe(
      'false',
    );
    await api.reload();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    await api.search();
    expect(list.mock.lastCall?.[0]).toMatchObject({ pageNo: 1 });
    await wrapper.get('button').trigger('click');
    await flushPromises();
    await api.reset();
    expect(mocks.resetForm).toHaveBeenCalledOnce();
    expect(list.mock.lastCall?.[0]).toMatchObject({ pageNo: 1 });
    wrapper.unmount();
  });

  it('omits pagination params when disabled and keeps static dataSource reactive', async () => {
    const list = vi.fn(async (_params: Record<string, unknown>) => ({
      items: [{ id: 'remote' }],
      total: 1,
    }));
    const remote = mountTable(list, { showPagination: false });
    await remote.api.reload();
    expect(list.mock.lastCall?.[0]).toMatchObject({
      pageNo: undefined,
      pageSize: undefined,
    });
    remote.wrapper.unmount();

    const staticTable = mountTable(vi.fn(), {
      api: undefined,
      dataSource: [{ id: 'local-1' }],
    });
    expect(staticTable.wrapper.get('[data-row]').text()).toBe('local-1');
    await staticTable.wrapper.setProps({ dataSource: [{ id: 'local-2' }] });
    expect(staticTable.wrapper.get('[data-row]').text()).toBe('local-2');
    staticTable.wrapper.unmount();
  });

  it('loads once on immediate registration and does not write after unmount', async () => {
    const list = vi.fn(async () => ({ items: [{ id: 'initial' }], total: 1 }));
    const immediate = mountTable(list, { immediate: true });
    await flushPromises();
    expect(list).toHaveBeenCalledOnce();
    immediate.wrapper.unmount();

    const pending = deferred<{ items: Array<{ id: string }>; total: number }>();
    const afterFetch = vi.fn(async (result) => result);
    const lateList = vi.fn(() => pending.promise);
    const late = mountTable(lateList, { afterFetch });
    const load = late.api.reload();
    await flushPromises();
    late.wrapper.unmount();
    pending.resolve({ items: [{ id: 'late' }], total: 1 });
    await load;
    await late.api.reload();
    expect(lateList).toHaveBeenCalledOnce();
    expect(afterFetch).not.toHaveBeenCalled();
  });
});
