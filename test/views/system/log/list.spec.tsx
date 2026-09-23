/* eslint-disable vue/multi-word-component-names, vue/one-component-per-file, vue/require-default-prop */
/* @vitest-environment happy-dom */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import KtTable from '@test-source/apps/web-antdv-next/src/components/kt-table/KtTable';
import LogPage from '@test-source/apps/web-antdv-next/src/views/system/log/list';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  formValues: { rangeMinutes: 60 } as Record<string, unknown>,
  levels: vi.fn(),
  list: vi.fn(),
  status: vi.fn(),
  summary: vi.fn(),
}));

vi.mock('#/api/system/log', () => ({
  getSystemLogLevels: mocks.levels,
  getSystemLogList: mocks.list,
  getSystemLogStatus: mocks.status,
  getSystemLogSummary: mocks.summary,
}));
vi.mock('#/adapter/form', () => ({
  useVbenForm: () => [
    defineComponent({ setup: () => () => h('form') }),
    {
      getValues: vi.fn(async () => ({ ...mocks.formValues })),
      resetForm: vi.fn(async () => undefined),
      setState: vi.fn(),
      setValues: vi.fn(async (values) =>
        Object.assign(mocks.formValues, values),
      ),
      validate: vi.fn(async () => ({ valid: true })),
    },
  ],
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
}));
vi.mock('antdv-next', async () => {
  const { default: Popover } = await import('antdv-next/dist/popover/index');
  const Box = defineComponent({
    setup(_, { slots }) {
      return () => h('div', [slots.default?.(), slots.content?.()]);
    },
  });
  return {
    Alert: defineComponent({
      props: { title: String },
      setup(props) {
        return () => h('div', { role: 'alert' }, props.title);
      },
    }),
    Button: defineComponent({
      setup(_, { attrs, slots }) {
        return () => h('button', attrs, slots.default?.());
      },
    }),
    Checkbox: Box,
    Divider: Box,
    Drawer: Box,
    Modal: { confirm: vi.fn() },
    Pagination: Box,
    Popover,
    Space: Box,
    Table: defineComponent({
      props: { dataSource: { default: () => [], type: Array } },
      setup(props) {
        return () =>
          h(
            'div',
            { 'data-rows': '' },
            props.dataSource.map((row: any) => h('span', row.id)),
          );
      },
    }),
    TableSummary: Box,
    TableSummaryCell: Box,
    TableSummaryRow: Box,
    Tag: Box,
    Tooltip: Box,
  };
});

/**
 * 控制日志接口响应顺序，验证同轮摘要不会越过较新请求。
 * @returns 可手动兑现或拒绝的 Promise。
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
 * 从真实 KtTable 暴露对象调用公开刷新命令。
 * @param wrapper - 已挂载的日志页面容器。
 * @returns 表格实例的公开刷新方法。
 */
function tableApi(wrapper: ReturnType<typeof mount>) {
  return (wrapper.findComponent(KtTable).vm as any).$?.exposed as {
    reload: () => Promise<void>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.formValues = { rangeMinutes: 60 };
  mocks.list.mockResolvedValue({ items: [{ id: 'first' }], total: 1 });
  mocks.summary.mockResolvedValue([{ count: 1, level: 'info' }]);
  mocks.status.mockResolvedValue({
    app: 'admin',
    configured: true,
    env: 'test',
    host: 'host-a',
    selector: 'source-a',
  });
  mocks.levels.mockResolvedValue([{ label: 'info', value: 'info' }]);
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

describe('system log request snapshot', () => {
  it('keeps total, first matching level, and known-empty count semantics', async () => {
    mocks.summary.mockResolvedValueOnce([
      { count: 2, level: 'info' },
      { count: 3, level: 'info' },
    ]);
    const wrapper = mount(LogPage, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.text()).toContain('system.log.total 5');
    expect(wrapper.text()).not.toContain('info2');
    expect(document.body.textContent).not.toContain('info2');
    const detailButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '级别与来源');
    await detailButton?.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('info2');
    expect(document.body.textContent).toContain('host-a');
    mocks.summary.mockResolvedValueOnce([]);
    await tableApi(wrapper).reload();
    expect(wrapper.text()).toContain('system.log.total 0');
    expect(document.body.textContent).toContain('info0');
    wrapper.unmount();
  });

  it('loads one summary with the first list filters but without pagination or sorting', async () => {
    const wrapper = mount(LogPage);
    await flushPromises();
    expect(mocks.list).toHaveBeenCalledOnce();
    expect(mocks.summary).toHaveBeenCalledOnce();
    expect(mocks.list.mock.calls[0]?.[0]).toMatchObject({
      pageNo: 1,
      rangeMinutes: 60,
    });
    expect(mocks.summary.mock.calls[0]?.[0]).toMatchObject({
      rangeMinutes: 60,
    });
    expect(mocks.summary.mock.calls[0]?.[0]).not.toHaveProperty('pageNo');
    expect(mocks.summary.mock.calls[0]?.[0]).not.toHaveProperty('sortField');
    expect(wrapper.text()).toContain('system.log.total 1');
    wrapper.unmount();
  });

  it('commits only the newer list and same-filter summary after A finishes late', async () => {
    const aPage = deferred<{ items: Array<{ id: string }>; total: number }>();
    const aSummary = deferred<Array<{ count: number; level: string }>>();
    const bPage = deferred<{ items: Array<{ id: string }>; total: number }>();
    const bSummary = deferred<Array<{ count: number; level: string }>>();
    mocks.list.mockImplementationOnce(() => aPage.promise);
    mocks.summary.mockImplementationOnce(() => aSummary.promise);
    const wrapper = mount(LogPage);
    await flushPromises();
    mocks.formValues.keyword = 'B';
    mocks.list.mockImplementationOnce(() => bPage.promise);
    mocks.summary.mockImplementationOnce(() => bSummary.promise);
    const bLoad = tableApi(wrapper).reload();
    await flushPromises();
    expect(mocks.summary.mock.calls[1]?.[0]).toMatchObject({ keyword: 'B' });
    mocks.formValues.keyword = 'unsubmitted-C';
    bPage.resolve({ items: [{ id: 'B' }], total: 1 });
    bSummary.resolve([{ count: 2, level: 'info' }]);
    await bLoad;
    expect(wrapper.text()).toContain('system.log.total 2');
    aPage.resolve({ items: [{ id: 'A' }], total: 1 });
    aSummary.resolve([{ count: 9, level: 'info' }]);
    await flushPromises();
    expect(wrapper.get('[data-rows]').text()).toContain('B');
    expect(wrapper.text()).toContain('system.log.total 2');
    expect(wrapper.text()).not.toContain('system.log.total 9');
    wrapper.unmount();
  });

  it('keeps usable rows with unknown summary on summary failure and keeps old snapshot on list failure', async () => {
    const wrapper = mount(LogPage);
    await flushPromises();
    mocks.list.mockResolvedValueOnce({ items: [{ id: 'second' }], total: 1 });
    mocks.summary.mockRejectedValueOnce(new Error('summary offline'));
    await tableApi(wrapper).reload();
    expect(wrapper.get('[data-rows]').text()).toContain('second');
    expect(wrapper.text()).toContain('system.log.total —');
    expect(wrapper.text()).toContain('统计暂不可用');
    const pendingSummary = deferred<Array<{ count: number; level: string }>>();
    mocks.list.mockRejectedValueOnce(new Error('list offline'));
    mocks.summary.mockImplementationOnce(() => pendingSummary.promise);
    const outcome = await Promise.race([
      tableApi(wrapper)
        .reload()
        .then(
          () => 'loaded',
          () => 'list-failed',
        ),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve('timeout'), 500),
      ),
    ]);
    expect(outcome).toBe('list-failed');
    pendingSummary.resolve([{ count: 100, level: 'info' }]);
    await flushPromises();
    expect(wrapper.get('[data-rows]').text()).toContain('second');
    expect(wrapper.text()).toContain('system.log.total —');
    wrapper.unmount();
  });

  it('does not label unknown source status as unconfigured and can retry a failed status read', async () => {
    const firstStatus = deferred<{
      app: string;
      configured: boolean;
      env: string;
      selector: string;
    }>();
    mocks.status.mockImplementationOnce(() => firstStatus.promise);
    const wrapper = mount(LogPage);
    await flushPromises();
    expect(wrapper.text()).toContain('状态读取中');
    expect(wrapper.text()).not.toContain('system.log.unconfigured');
    firstStatus.reject(new Error('offline'));
    await flushPromises();
    expect(wrapper.text()).toContain('状态读取失败');
    expect(wrapper.get('[role="status"]').attributes('title')).toContain(
      '日志源状态读取失败',
    );
    expect(wrapper.text()).not.toContain('system.log.unconfigured');
    mocks.status.mockResolvedValueOnce({
      app: 'admin',
      configured: false,
      env: 'test',
      selector: 'source-a',
    });
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === '重试');
    await retry?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('system.log.unconfigured');
    wrapper.unmount();
  });

  it('uses built-in levels when the directory cannot be read', async () => {
    mocks.levels.mockRejectedValueOnce(new Error('levels offline'));
    const wrapper = mount(LogPage, { attachTo: document.body });
    await flushPromises();
    const detailButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '级别与来源');
    await detailButton?.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('debug');
    expect(document.body.textContent).toContain('critical');
    wrapper.unmount();
  });
});
