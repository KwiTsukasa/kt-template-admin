import type { Component, Ref } from 'vue';

import type { MenuRecordBadgeRaw, ThemeModeType } from '@vben-core/typings';

interface MenuProps {
  accordion?: boolean;
  collapse?: boolean;

  collapseShowTitle?: boolean;

  defaultActive?: string;

  defaultOpeneds?: string[];

  mode?: 'horizontal' | 'vertical';

  rounded?: boolean;

  scrollToActive?: boolean;

  theme?: ThemeModeType;
}

interface SubMenuProps extends MenuRecordBadgeRaw {
  activeIcon?: string;
  disabled?: boolean;
  icon?: Component | string;
  path: string;
}

interface MenuItemProps extends MenuRecordBadgeRaw {
  activeIcon?: string;
  disabled?: boolean;
  icon?: Component | string;
  path: string;
}

interface MenuItemRegistered {
  active: boolean;
  parentPaths: string[];
  path: string;
}

interface MenuItemClicked {
  parentPaths: string[];
  path: string;
}

interface MenuProvider {
  activePath?: string;
  addMenuItem: (item: MenuItemRegistered) => void;

  addSubMenu: (item: MenuItemRegistered) => void;
  closeMenu: (path: string, parentLinks: string[]) => void;
  handleMenuItemClick: (item: MenuItemClicked) => void;
  handleSubMenuClick: (subMenu: MenuItemRegistered) => void;
  isMenuPopup: boolean;
  items: Record<string, MenuItemRegistered>;

  openedMenus: string[];
  openMenu: (path: string, parentLinks: string[]) => void;
  props: MenuProps;
  removeMenuItem: (item: MenuItemRegistered) => void;

  removeSubMenu: (item: MenuItemRegistered) => void;

  subMenus: Record<string, MenuItemRegistered>;
  theme: string;
}

interface SubMenuProvider {
  addSubMenu: (item: MenuItemRegistered) => void;
  handleMouseleave?: (deepDispatch: boolean) => void;
  level: number;
  mouseInChild: Ref<boolean>;
  removeSubMenu: (item: MenuItemRegistered) => void;
}

export type {
  MenuItemClicked,
  MenuItemProps,
  MenuItemRegistered,
  MenuProps,
  MenuProvider,
  SubMenuProps,
  SubMenuProvider,
};
