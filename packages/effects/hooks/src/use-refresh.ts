import { useRouter } from 'vue-router';

import { useTabbarStore } from '@vben/stores';

/**
 * 封装基于当前路由刷新标签页内容的方法，供业务组件直接调用。
 *
 * @returns 包含 `refresh` 方法的对象，用于刷新当前路由页签。
 */
export function useRefresh() {
  const router = useRouter();
  const tabbarStore = useTabbarStore();

  /**
   * 通过标签 store 重新挂载当前路由对应的页面。
   */
  async function refresh() {
    await tabbarStore.refresh(router);
  }

  return {
    refresh,
  };
}
