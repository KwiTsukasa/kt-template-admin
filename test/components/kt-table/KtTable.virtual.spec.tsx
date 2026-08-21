/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import KtTable from '@test-source/apps/web-antdv-next/src/components/kt-table/KtTable';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tableProps: undefined as any,
  tableSlots: undefined as any,
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
    setup(props, { slots }) {
      return () => {
        mocks.tableProps = { ...props };
        mocks.tableSlots = slots;
        return h('div', { 'data-testid': 'native-table' });
      };
    },
  });

  return {
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

const mountTable = (virtual?: boolean) => {
  const props = {
    columns: [
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
    rowKey: 'id',
    showDefaultButtons: false,
    showFooter: false,
    showHeader: false,
    showIndex: false,
    showSelection: true,
    showTableSetting: false,
  } as any;
  if (virtual !== undefined) props.virtual = virtual;

  return mount(KtTable, {
    props,
    slots: {
      bodyCell: ({ record }: any) => h('span', record.name),
    },
  });
};

beforeEach(() => {
  mocks.tableProps = undefined;
  mocks.tableSlots = undefined;
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

describe('ktTable native virtual mode', () => {
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
