import { defineComponent, h } from 'vue';

import { Icon } from '@iconify/vue';

/**
 * 创建封装指定 Iconify 图标、并透传组件属性和 HTML 属性的 Vue 组件。
 *
 * @param icon - 新组件每次渲染时传给 Iconify 的图标标识。
 * @returns 渲染指定 Iconify 图标并透传属性的 Vue 组件定义。
 */
function createIconifyIcon(icon: string) {
  return defineComponent({
    name: `Icon-${icon}`,
    setup(props, { attrs }) {
      return () => h(Icon, { icon, ...props, ...attrs });
    },
  });
}

export { createIconifyIcon };
