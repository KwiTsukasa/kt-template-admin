import type { MenuRecordRaw } from '@vben-core/typings';

/**
 * 递归遍历菜单树并匹配标准化路径，找不到时返回 null。
 *
 * @param list - 需要递归搜索的菜单树。
 * @param path - 要与菜单 path 精确比较的标准化路径；省略时不会匹配节点。
 * @returns 菜单树中与标准化路径匹配的节点；没有匹配项时返回 null。
 */
function findMenuByPath(
  list: MenuRecordRaw[],
  path?: string,
): MenuRecordRaw | null {
  for (const menu of list) {
    if (menu.path === path) {
      return menu;
    }
    const findMenu = menu.children && findMenuByPath(menu.children, path);
    if (findMenu) {
      return findMenu;
    }
  }
  return null;
}

/**
 * 根据标准化路径递归查找匹配菜单，并返回其根级菜单。
 *
 * @param menus - 需要按路径查找根菜单的菜单树。
 * @param path - 要在菜单树中定位节点及其根级父项的标准化路径。
 * @param level - 递归查找菜单时目标节点相对根集合的层级；未传入时使用 `0`。
 * @returns 包含目标路径的根级菜单；未匹配时返回 undefined。
 */
function findRootMenuByPath(menus: MenuRecordRaw[], path?: string, level = 0) {
  const findMenu = findMenuByPath(menus, path);
  const rootMenuPath = findMenu?.parents?.[level];
  const rootMenu = (() => {
    if (rootMenuPath) {
      return menus.find((item) => item.path === rootMenuPath);
    }
    return undefined;
  })();
  return {
    findMenu,
    rootMenu,
    rootMenuPath,
  };
}

export { findMenuByPath, findRootMenuByPath };
