import type { App, Directive, DirectiveBinding } from 'vue';

import { useAccess } from './use-access';

/**
 * 按访问模式、角色与权限码判断指令绑定元素是否应向当前用户开放。
 *
 * @param el - 指令当前绑定的 DOM 元素。
 * @param binding - 携带权限码、角色或访问模式要求的指令绑定值。
 */
function isAccessible(
  el: Element,
  binding: DirectiveBinding<string | string[]>,
) {
  const { accessMode, hasAccessByCodes, hasAccessByRoles } = useAccess();

  const value = binding.value;

  if (!value) return;
  const authMethod = (() => {
    if (accessMode.value === 'frontend' && binding.arg === 'role') {
      return hasAccessByRoles;
    }
    return hasAccessByCodes;
  })();

  const values = (() => {
    if (Array.isArray(value)) {
      return value;
    }
    return [value];
  })();

  if (!authMethod(values)) {
    el?.remove();
  }
}

const mounted = (el: Element, binding: DirectiveBinding<string | string[]>) => {
  isAccessible(el, binding);
};

const authDirective: Directive = {
  mounted,
};

/**
 * 把权限判定实现注册为 Vue `v-access` 指令。
 *
 * @param app - 要注册 v-access 指令的 Vue 应用实例。
 */
export function registerAccessDirective(app: App) {
  app.directive('access', authDirective);
}
