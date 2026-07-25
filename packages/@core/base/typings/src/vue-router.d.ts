import type { Component } from 'vue';
import type { Router, RouteRecordRaw } from 'vue-router';

interface RouteMeta {
  activeIcon?: string;
  activePath?: string;
  affixTab?: boolean;
  affixTabOrder?: number;
  authority?: string[];
  badge?: string;
  badgeType?: 'dot' | 'normal';
  badgeVariants?:
    | 'default'
    | 'destructive'
    | 'primary'
    | 'success'
    | 'warning'
    | string;
  fullPathKey?: boolean;
  hideChildrenInMenu?: boolean;
  hideInBreadcrumb?: boolean;
  hideInMenu?: boolean;
  hideInTab?: boolean;
  icon?: Component | string;
  iframeSrc?: string;
  ignoreAccess?: boolean;
  keepAlive?: boolean;
  link?: string;
  loaded?: boolean;
  maxNumOfOpenTab?: number;
  menuVisibleWithForbidden?: boolean;
  noBasicLayout?: boolean;
  openInNewWindow?: boolean;
  order?: number;
  query?: Recordable;
  title: string;
}

// 定义递归类型以将 RouteRecordRaw 的 component 属性更改为 string
type RouteRecordStringComponent<T = string> = Omit<
  RouteRecordRaw,
  'children' | 'component'
> & {
  children?: RouteRecordStringComponent<T>[];
  component: T;
  sort?: number;
};

type ComponentRecordType = Record<string, () => Promise<Component>>;

interface GenerateMenuAndRoutesOptions {
  fetchMenuListAsync?: () => Promise<RouteRecordStringComponent[]>;
  forbiddenComponent?: RouteRecordRaw['component'];
  layoutMap?: ComponentRecordType;
  pageMap?: ComponentRecordType;
  roles?: string[];
  router: Router;
  routes: RouteRecordRaw[];
}

export type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
  RouteMeta,
  RouteRecordRaw,
  RouteRecordStringComponent,
};
