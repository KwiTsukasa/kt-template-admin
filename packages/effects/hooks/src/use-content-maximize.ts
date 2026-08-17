import { updatePreferences, usePreferences } from '@vben/preferences';
/**
 * 通过共享状态切换内容区最大化，并在卸载时恢复普通布局。
 *
 * @returns 最大化状态、切换方法和退出最大化方法。
 */
export function useContentMaximize() {
  const { contentIsMaximize } = usePreferences();

  /**
   * 通过同步切换头部与侧栏隐藏状态，实现内容区最大化或恢复布局。
   */
  function toggleMaximize() {
    const isMaximize = contentIsMaximize.value;

    updatePreferences({
      header: {
        hidden: !isMaximize,
      },
      sidebar: {
        hidden: !isMaximize,
      },
    });
  }
  return {
    contentIsMaximize,
    toggleMaximize,
  };
}
