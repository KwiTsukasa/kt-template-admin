/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import type { KtTableRegisterFn } from '@test-source/apps/web-antdv-next/src/components/kt-table/types';

import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';

import { useKtTable } from '@test-source/apps/web-antdv-next/src/components/kt-table/hooks/useKtTable';
import KtTable from '@test-source/apps/web-antdv-next/src/components/kt-table/KtTable';
import Tabs from 'antdv-next/dist/tabs/index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bodyWidth: 800,
  nestedBodyWidth: 100,
  renderNativeBody: false,
  renderNestedBody: false,
  resizeCallback: undefined as (() => void) | undefined,
  tableProps: undefined as any,
  tableScrollTo: undefined as ReturnType<typeof vi.fn> | undefined,
  tableSlots: undefined as any,
  wrapperWidth: 800,
}));

vi.mock('#/adapter/form', () => ({
  useVbenForm: () => [
    defineComponent({
      name: 'MockSearchForm',
      setup() {
        return () => h('form');
      },
    }),
    {
      getValues: vi.fn(async () => ({})),
      resetForm: vi.fn(async () => undefined),
      setState: vi.fn(),
      setValues: vi.fn(async () => undefined),
    },
  ],
}));

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));

vi.mock('antdv-next', () => {
  const SlotStub = defineComponent({
    name: 'SlotStub',
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  });
  const TableStub = defineComponent({
    name: 'MockAntTable',
    inheritAttrs: false,
    props: {
      columns: { default: () => [], type: Array },
      components: { default: () => ({}), type: Object },
      dataSource: { default: () => [], type: Array },
      loading: Boolean,
      onChange: Function,
      onRow: Function,
      pagination: { type: [Boolean, Object] },
      rowKey: { type: [Function, String] },
      rowSelection: { type: Object },
      scroll: { default: () => ({}), type: Object },
      size: String,
      virtual: Boolean,
    },
    setup(props, { attrs, expose, slots }) {
      const scrollTo = vi.fn();
      mocks.tableScrollTo = scrollTo;
      expose({ scrollTo });
      return () => {
        mocks.tableProps = { ...props };
        mocks.tableSlots = slots;
        return h(
          'div',
          {
            class: ['ant-table-wrapper', attrs.class],
            'data-testid': 'native-table',
          },
          [
            mocks.renderNestedBody &&
              h('div', { class: 'ant-table-wrapper' }, [
                h('div', { class: 'ant-table-container' }, [
                  h('div', { class: 'ant-table-body' }),
                ]),
              ]),
            mocks.renderNativeBody &&
              h('div', { class: 'ant-table-container' }, [
                h('div', { class: 'ant-table-body' }),
              ]),
          ],
        );
      };
    },
  });

  return {
    Alert: SlotStub,
    Button: SlotStub,
    Checkbox: SlotStub,
    Divider: SlotStub,
    Modal: { confirm: vi.fn() },
    Pagination: SlotStub,
    Popover: SlotStub,
    Space: SlotStub,
    Table: TableStub,
    TableSummary: SlotStub,
    TableSummaryCell: SlotStub,
    TableSummaryRow: SlotStub,
    Tooltip: SlotStub,
  };
});

const mountTable = (
  virtual?: boolean,
  onRegister?: KtTableRegisterFn,
  columns?: Array<Record<string, unknown>>,
  selection?: boolean,
) => {
  const props = {
    columns: columns || [
      {
        dataIndex: 'name',
        fixed: 'left',
        key: 'name',
        title: '名称',
        width: 240,
      },
    ],
    dataSource: [{ id: 'row-1', name: '第一行' }],
    immediate: false,
    onRegister,
    rowKey: 'id',
    showDefaultButtons: false,
    showFooter: false,
    showHeader: false,
    showIndex: false,
    showSelection: true,
    showTableSetting: false,
  } as any;
  if (virtual !== undefined) props.virtual = virtual;
  if (selection !== undefined) props.showSelection = selection;

  return mount(KtTable, {
    props,
    slots: {
      bodyCell: ({ record }: any) => h('span', record.name),
    },
  });
};

beforeEach(() => {
  mocks.bodyWidth = 800;
  mocks.nestedBodyWidth = 100;
  mocks.renderNativeBody = false;
  mocks.renderNestedBody = false;
  mocks.resizeCallback = undefined;
  mocks.tableProps = undefined;
  mocks.tableScrollTo = undefined;
  mocks.tableSlots = undefined;
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(560);
  mocks.wrapperWidth = 800;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      if (this.classList.contains('kt-table__body')) return mocks.wrapperWidth;
      if (this.classList.contains('ant-table-body')) {
        if (
          this.closest('.ant-table-wrapper')?.classList.contains(
            'kt-table__ant',
          )
        )
          return mocks.bodyWidth;
        return mocks.nestedBodyWidth;
      }
      return 800;
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn((callback: ResizeObserverCallback) => {
      mocks.resizeCallback = () => callback([], {} as ResizeObserver);
      return {
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
      };
    }),
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

describe('ktTable native virtual mode', () => {
  it('allocates flexible columns within the native body client width', async () => {
    mocks.wrapperWidth = 286;
    mocks.bodyWidth = 271;
    mocks.renderNativeBody = true;
    mocks.renderNestedBody = true;
    const wrapper = mountTable(
      false,
      undefined,
      [
        { dataIndex: 'dictCode', key: 'dictCode', minWidth: 160 },
        { dataIndex: 'count', key: 'count', width: 96 },
      ],
      false,
    );
    await nextTick();
    await nextTick();
    expect(mocks.tableProps.columns.map((column: any) => column.width)).toEqual(
      [175, 96],
    );
    expect(mocks.tableProps.scroll.x).toBeUndefined();
    mocks.resizeCallback?.();
    await nextTick();
    await nextTick();
    expect(mocks.tableProps.columns.map((column: any) => column.width)).toEqual(
      [175, 96],
    );
    wrapper.unmount();
  });

  it('uses the outer container when its native body is absent, zero-width, or only nested', async () => {
    mocks.wrapperWidth = 286;
    const cases = [
      { bodyWidth: 271, native: false, nested: false },
      { bodyWidth: 0, native: true, nested: false },
      { bodyWidth: 271, native: false, nested: true },
    ];
    for (const item of cases) {
      mocks.bodyWidth = item.bodyWidth;
      mocks.renderNativeBody = item.native;
      mocks.renderNestedBody = item.nested;
      const wrapper = mountTable(
        false,
        undefined,
        [
          { dataIndex: 'dictCode', key: 'dictCode', minWidth: 160 },
          { dataIndex: 'count', key: 'count', width: 96 },
        ],
        false,
      );
      await nextTick();
      await nextTick();
      expect(
        mocks.tableProps.columns.map((column: any) => column.width),
      ).toEqual([190, 96]);
      wrapper.unmount();
    }
  });

  it('keeps overlay-scrollbar and virtual scroll widths numeric and stable', async () => {
    mocks.wrapperWidth = 286;
    mocks.bodyWidth = 286;
    mocks.renderNativeBody = true;
    const overlay = mountTable(
      false,
      undefined,
      [
        { dataIndex: 'dictCode', key: 'dictCode', minWidth: 160 },
        { dataIndex: 'count', key: 'count', width: 96 },
      ],
      false,
    );
    await nextTick();
    await nextTick();
    expect(mocks.tableProps.columns.map((column: any) => column.width)).toEqual(
      [190, 96],
    );
    overlay.unmount();

    mocks.bodyWidth = 271;
    const virtual = mountTable(
      true,
      undefined,
      [
        { dataIndex: 'dictCode', key: 'dictCode', minWidth: 160 },
        { dataIndex: 'count', key: 'count', width: 96 },
      ],
      false,
    );
    await nextTick();
    await nextTick();
    expect(mocks.tableProps.scroll.x).toBe(271);
    expect(mocks.tableProps.scroll.y).toEqual(expect.any(Number));
    virtual.unmount();
  });

  it('remeasures native body width when virtual mode changes without an outer resize', async () => {
    mocks.wrapperWidth = 286;
    mocks.bodyWidth = 271;
    mocks.renderNativeBody = true;
    const wrapper = mountTable(
      false,
      undefined,
      [
        { dataIndex: 'dictCode', key: 'dictCode', minWidth: 160 },
        { dataIndex: 'count', key: 'count', width: 96 },
      ],
      false,
    );
    await nextTick();
    await nextTick();
    expect(mocks.tableProps.columns.map((column: any) => column.width)).toEqual(
      [175, 96],
    );

    mocks.bodyWidth = 286;
    await wrapper.setProps({ virtual: true });
    await nextTick();
    await nextTick();
    expect(mocks.tableProps.columns.map((column: any) => column.width)).toEqual(
      [190, 96],
    );
    expect(mocks.tableProps.scroll.x).toBe(286);

    mocks.bodyWidth = 271;
    await wrapper.setProps({ virtual: false });
    await nextTick();
    await nextTick();
    expect(mocks.tableProps.columns.map((column: any) => column.width)).toEqual(
      [175, 96],
    );
    wrapper.unmount();
  });

  it('forwards explicit key, index and top scroll commands and ignores calls before registration', () => {
    const [register, api] = useKtTable();
    expect(() => api.scrollTo({ key: 'row-1' })).not.toThrow();

    const wrapper = mountTable(false, register);
    api.scrollTo({ key: 'row-1', align: 'start' });
    api.scrollTo({ index: 0 });
    api.scrollTo({ top: 0 });
    expect(mocks.tableScrollTo?.mock.calls).toEqual([
      [{ key: 'row-1', align: 'start' }],
      [{ index: 0 }],
      [{ top: 0 }],
    ]);
    wrapper.unmount();
  });
  it('updates rows inside real Antdv tabs after the first snapshot', async () => {
    const rows = ref<any[]>([]);
    const Host = defineComponent({
      setup() {
        return () =>
          h(Tabs, {
            items: [
              {
                key: 'services',
                label: '服务',
                content: () =>
                  h(KtTable, {
                    dataSource: rows.value,
                    showHeader: false,
                    showPagination: false,
                  }),
              },
            ],
          });
      },
    });
    const wrapper = mount(Host);
    rows.value = [{ id: 'service-1', name: '服务一' }];
    await nextTick();
    await nextTick();
    expect(mocks.tableProps.dataSource).toEqual([
      { id: 'service-1', name: '服务一' },
    ]);
    wrapper.unmount();
  });
  it('updates static rows after asynchronous snapshot arrival and site changes', async () => {
    const wrapper = mountTable();
    await wrapper.setProps({ dataSource: [] });
    await wrapper.setProps({
      dataSource: [{ id: 'service-1', name: '服务一' }],
    });
    await nextTick();
    expect(mocks.tableProps.dataSource).toEqual([
      { id: 'service-1', name: '服务一' },
    ]);
    await wrapper.setProps({
      dataSource: [{ id: 'service-2', name: '服务二' }],
    });
    expect(mocks.tableProps.dataSource).toEqual([
      { id: 'service-2', name: '服务二' },
    ]);
    wrapper.unmount();
  });
  it('passes numeric scroll axes while preserving native table contracts', async () => {
    const wrapper = mountTable(true);
    await nextTick();
    await nextTick();

    expect(mocks.tableProps.virtual).toBe(true);
    expect(mocks.tableProps.scroll).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(Number.isFinite(mocks.tableProps.scroll.x)).toBe(true);
    expect(Number.isFinite(mocks.tableProps.scroll.y)).toBe(true);
    expect(mocks.tableProps.scroll.x).toBe(800);
    expect(mocks.tableProps.columns[0].fixed).toBe('left');
    expect(mocks.tableProps.components.header.cell).toBeDefined();
    expect(mocks.tableProps.rowSelection).toEqual(
      expect.objectContaining({
        onChange: expect.any(Function),
        selectedRowKeys: [],
      }),
    );
    expect(mocks.tableProps.pagination).toBe(false);

    const cell = mocks.tableSlots.bodyCell({
      column: mocks.tableProps.columns[0],
      index: 0,
      record: { id: 'row-1', name: '第一行' },
    });
    expect(cell).toHaveLength(1);
    expect(cell[0].children).toBe('第一行');
    wrapper.unmount();
  });

  it('keeps virtual rendering disabled and scroll.x optional by default', async () => {
    const wrapper = mountTable();
    await nextTick();
    await nextTick();

    expect(mocks.tableProps.virtual).toBe(false);
    expect(mocks.tableProps.scroll.x).toBeUndefined();
    expect(mocks.tableProps.scroll.y).toEqual(expect.any(Number));
    wrapper.unmount();
  });
});
