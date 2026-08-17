import { computed } from 'vue';

import { preferences, updatePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

/**
 * 结合当前用户角色、访问码与访问模式提供权限判定，并暴露可访问组件包装器。
 *
 * @returns 权限判定方法、访问码状态与可访问组件包装器。
 */
function useAccess() {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const accessMode = computed(() => {
    return preferences.app.accessMode;
  });

  /**
   * 仅当当前用户至少拥有一个目标角色时允许角色访问。
   *
   * @param roles - 用于构建角色选择项或权限判断的角色集合。
   * @returns 至少一个目标角色属于当前用户时返回 true；空集合返回 false。
   */
  function hasAccessByRoles(roles: string[]) {
    const userRoleSet = new Set(userStore.userRoles);
    const intersection = roles.filter((item) => userRoleSet.has(item));
    return intersection.length > 0;
  }

  /**
   * 仅当当前用户至少拥有一个目标访问码时允许编码访问。
   *
   * @param codes - 用于权限判断的访问码集合。
   * @returns 至少一个目标访问码属于当前用户时返回 true；空集合返回 false。
   */
  function hasAccessByCodes(codes: string[]) {
    const userCodesSet = new Set(accessStore.accessCodes);

    const intersection = codes.filter((item) => userCodesSet.has(item));
    return intersection.length > 0;
  }

  /**
   * 根据当前权限模式在前端与后端权限之间切换应用偏好。
   */
  async function toggleAccessMode() {
    updatePreferences({
      app: {
        accessMode: (() => {
          if (preferences.app.accessMode === 'frontend') {
            return 'backend';
          }
          return 'frontend';
        })(),
      },
    });
  }

  return {
    accessMode,
    hasAccessByCodes,
    hasAccessByRoles,
    toggleAccessMode,
  };
}

export { useAccess };
