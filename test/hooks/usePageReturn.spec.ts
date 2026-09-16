import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePageReturn } from '#/hooks/usePageReturn';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  push: vi.fn(),
  route: {
    value: {
      path: '/detail/1',
      fullPath: '/detail/1',
      query: {} as Record<string, unknown>,
    },
  },
  history: { back: null as null | string },
  tabs: { tabs: [] as { fullPath: string }[], $subscribe: vi.fn() },
}));
vi.mock('@test-source/packages/stores/src/index.ts', () => ({
  getTabKey: (tab: { fullPath: string }) => tab.fullPath,
  useTabbarStore: () => mocks.tabs,
}));
vi.mock('@test-source/packages/effects/hooks/src/index.ts', () => ({
  useTabs: () => ({ closeCurrentTab: mocks.close }),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: mocks.route,
    options: { history: { state: mocks.history } },
    push: mocks.push,
    resolve: (target: string) => ({
      path: target.split('?')[0],
      matched: [{}],
    }),
  }),
}));

describe('二级页返回和页签关闭', () => {
  beforeEach(() => {
    mocks.tabs = { tabs: [{ fullPath: '/detail/1' }], $subscribe: vi.fn() };
    mocks.close.mockReset();
    mocks.push.mockReset().mockImplementation(async (target: string) => {
      mocks.route.value = {
        path: target.split('?')[0] || '/',
        fullPath: target,
        query: {},
      };
      return undefined;
    });
    mocks.route.value = { path: '/detail/1', fullPath: '/detail/1', query: {} };
    mocks.history.back = null;
  });
  it('回到来源页面并关闭原详情页，不关闭导航后的列表', async () => {
    mocks.route.value.query.returnTo = '/list';
    const original = { ...mocks.route.value };
    await usePageReturn('/list')();
    expect(mocks.push).toHaveBeenCalledWith('/list');
    expect(mocks.close).toHaveBeenCalledWith(original);
    expect(mocks.close.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.push.mock.invocationCallOrder[0] || 0,
    );
  });
  it('来源更新后返回本次来源页面', async () => {
    mocks.route.value.query.returnTo = '/list';
    const back = usePageReturn('/list');
    mocks.route.value.query.returnTo = '/executions';
    await back();
    expect(mocks.push).toHaveBeenCalledWith('/executions');
  });
  it('没有显式来源时保留进入时的内部来源', async () => {
    mocks.history.back = '/executions';
    const back = usePageReturn('/list');
    mocks.history.back = '/detail/1?tab=output';
    await back();
    expect(mocks.push).toHaveBeenCalledWith('/executions');
  });
  it('子页返回导致父页重建后仍返回父页最初来源', async () => {
    mocks.history.back = '/list';
    usePageReturn('/fallback');
    mocks.history.back = '/child/1';
    await usePageReturn('/fallback')();
    expect(mocks.push).toHaveBeenCalledWith('/list');
  });
  it('关闭页签后重新进入会使用新的来源', async () => {
    mocks.history.back = '/list';
    usePageReturn('/fallback');
    const onChange = mocks.tabs.$subscribe.mock.calls[0]?.[0];
    onChange({}, { tabs: [] });
    mocks.history.back = '/executions';
    await usePageReturn('/fallback')();
    expect(mocks.push).toHaveBeenCalledWith('/executions');
  });
  it.each(['//external.example', '/auth/login', '/detail/1?tab=output'])(
    '无可用来源 %s 时返回模块入口',
    async (source) => {
      mocks.route.value.query.returnTo = source;
      await usePageReturn('/list')();
      expect(mocks.push).toHaveBeenCalledWith('/list');
    },
  );
  it('未保存离开守卫拒绝导航时保留详情页签', async () => {
    mocks.push.mockResolvedValue({ type: 4 });
    await usePageReturn('/list')();
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it('导航被重定向时保留原页签', async () => {
    mocks.push.mockImplementation(async () => {
      mocks.route.value = {
        path: '/auth/login',
        fullPath: '/auth/login',
        query: {},
      };
    });
    await usePageReturn('/list')();
    expect(mocks.close).not.toHaveBeenCalled();
  });
});
