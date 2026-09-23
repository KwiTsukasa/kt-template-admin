/* eslint-disable vue/one-component-per-file */
/* @vitest-environment happy-dom */

import type { KtTableRegisterApi } from '@test-source/apps/web-antdv-next/src/components/kt-table/types';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import KtTableSettings from '@test-source/apps/web-antdv-next/src/components/kt-table/components/KtTableSettings';
import { useKtTable } from '@test-source/apps/web-antdv-next/src/components/kt-table/hooks/useKtTable';
import KtTable from '@test-source/apps/web-antdv-next/src/components/kt-table/KtTable';
import { mergeFormOptions } from '@test-source/apps/web-antdv-next/src/components/kt-table/utils';
import { useVbenForm } from '@test-source/packages/@core/ui-kit/form-ui/src/use-vben-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/adapter/form', async () => {
  const actual =
    await import('@test-source/packages/@core/ui-kit/form-ui/src/use-vben-form');
  return { useVbenForm: actual.useVbenForm };
});
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('antdv-next', () => {
  const Box = defineComponent({
    setup(_, { slots }) {
      return () => h('div', [slots.default?.(), slots.content?.()]);
    },
  });
  return {
    Alert: Box,
    Button: defineComponent({
      setup(_, { attrs, slots }) {
        return () => h('button', attrs, slots.default?.());
      },
    }),
    Checkbox: Box,
    Divider: Box,
    Modal: { confirm: vi.fn() },
    Pagination: Box,
    Popover: Box,
    Space: Box,
    Table: defineComponent({
      props: { dataSource: { default: () => [], type: Array } },
      setup(props) {
        return () =>
          h(
            'div',
            { 'data-table': '' },
            props.dataSource.map((row: any) => h('span', row.id)),
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
 * 通过真实 register 路径装配搜索表单与可控列表接口。
 * @param list - 本次测试观察的列表请求函数。
 * @returns 已挂载表格、公开 API 和可卸载容器。
 */
function mountRegisteredTable(list: ReturnType<typeof vi.fn>) {
  const [register, api] = useKtTable({
    api: { list },
    columns: [{ dataIndex: 'id', key: 'id', title: '标识' }],
    formOptions: {
      schema: [
        {
          component: 'VbenInput',
          defaultValue: 60,
          fieldName: 'rangeMinutes',
          label: '近N分钟',
        },
        {
          component: 'VbenInput',
          defaultValue: 0,
          fieldName: 'zeroValue',
          label: '零值',
        },
        {
          component: 'VbenCheckbox',
          defaultValue: false,
          fieldName: 'disabledFlag',
          label: '布尔值',
        },
        {
          component: 'VbenInput',
          defaultValue: '',
          fieldName: 'emptyValue',
          label: '空文本',
        },
      ],
    },
    immediate: true,
    showDefaultButtons: false,
    showFooter: false,
    showIndex: false,
    showTableSetting: true,
  });
  let formApiAvailableAtRegister = false;
  const wrapper = mount(KtTable, {
    attachTo: document.body,
    props: {
      onRegister: (value: KtTableRegisterApi) => {
        formApiAvailableAtRegister = !!value.formApi;
        register(value);
      },
    } as any,
  });
  return { api, formApiAvailableAtRegister, wrapper };
}

beforeEach(() => {
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

describe('ktTable real VbenForm lifecycle', () => {
  it('preserves the core form default when configured before creation', async () => {
    const [Form, api] = useVbenForm({
      schema: [
        { component: 'VbenInput', defaultValue: 60, fieldName: 'rangeMinutes' },
      ],
    });
    const wrapper = mount(Form);
    await flushPromises();
    expect(await api.getValues()).toMatchObject({ rangeMinutes: 60 });
    wrapper.unmount();
  });

  it('preserves the same default through KtTable form option merging', async () => {
    const options = mergeFormOptions([
      {
        schema: [
          {
            component: 'VbenInput',
            defaultValue: 60,
            fieldName: 'rangeMinutes',
          },
        ],
      },
    ]);
    const [Form, api] = useVbenForm(options);
    const wrapper = mount(Form);
    await flushPromises();
    expect(await api.getValues()).toMatchObject({ rangeMinutes: 60 });
    wrapper.unmount();
  });

  it('includes schema defaultValue in the first registered request', async () => {
    const list = vi.fn(async (_params: Record<string, unknown>) => ({
      items: [{ id: 'first' }],
      total: 1,
    }));
    const { formApiAvailableAtRegister, wrapper } = mountRegisteredTable(list);
    await flushPromises();
    expect(formApiAvailableAtRegister).toBe(true);
    expect(list).toHaveBeenCalledOnce();
    expect(list.mock.calls[0]?.[0]).toMatchObject({
      disabledFlag: false,
      emptyValue: '',
      rangeMinutes: 60,
      zeroValue: 0,
    });
    wrapper.unmount();
  });

  it('refreshes while search is hidden and keeps the same filter after showing it', async () => {
    const list = vi.fn(async (_params: Record<string, unknown>) => ({
      items: [{ id: 'first' }],
      total: 1,
    }));
    const { api, wrapper } = mountRegisteredTable(list);
    await flushPromises();
    await api.setSearchValues({ rangeMinutes: 30 });
    wrapper
      .findComponent(KtTableSettings)
      .vm.$emit('searchVisibleChange', false);
    await nextTick();
    const search = wrapper.get('.kt-table__search');
    expect(search.attributes('hidden')).toBeDefined();
    expect(
      wrapper
        .get('.kt-table__search-content-motion')
        .element.contains(wrapper.get('.kt-table__search-actions').element),
    ).toBe(false);
    const outcome = await Promise.race([
      api.reload().then(() => 'done'),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve('timeout'), 500),
      ),
    ]);
    expect(outcome).toBe('done');
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[1]?.[0]).toMatchObject({ rangeMinutes: 30 });
    wrapper
      .findComponent(KtTableSettings)
      .vm.$emit('searchVisibleChange', true);
    await nextTick();
    expect(
      wrapper.get('.kt-table__search').attributes('hidden'),
    ).toBeUndefined();
    expect(await api.getSearchValues()).toMatchObject({ rangeMinutes: 30 });
    await api.reset();
    expect(await api.getSearchValues()).toMatchObject({
      disabledFlag: false,
      emptyValue: '',
      rangeMinutes: 60,
      zeroValue: 0,
    });
    expect(list).toHaveBeenCalledTimes(3);
    expect(list.mock.calls[2]?.[0]).toMatchObject({
      disabledFlag: false,
      emptyValue: '',
      rangeMinutes: 60,
      zeroValue: 0,
    });
    wrapper.unmount();
  });

  it('does not overwrite entered values when option props change', async () => {
    const list = vi.fn(async () => ({ items: [{ id: 'first' }], total: 1 }));
    const { api, wrapper } = mountRegisteredTable(list);
    await flushPromises();
    await api.setSearchValues({ rangeMinutes: 30 });
    api.setProps({
      formOptions: {
        schema: [
          {
            component: 'VbenInput',
            componentProps: { placeholder: '更新后的动态选项' },
            defaultValue: 60,
            fieldName: 'rangeMinutes',
            label: '近N分钟',
          },
        ],
      },
    });
    await nextTick();
    expect(await api.getSearchValues()).toMatchObject({ rangeMinutes: 30 });
    wrapper.unmount();
  });
});
