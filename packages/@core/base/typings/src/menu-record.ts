import type { Component } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

type ExRouteRecordRaw = RouteRecordRaw & {
  parent?: string;
  parents?: string[];
  path?: any;
};

interface MenuRecordBadgeRaw {
  badge?: string;
  badgeType?: 'dot' | 'normal';
  badgeVariants?: 'destructive' | 'primary' | string;
}

interface MenuRecordRaw extends MenuRecordBadgeRaw {
  activeIcon?: string;
  children?: MenuRecordRaw[];
  disabled?: boolean;
  icon?: Component | string;
  name: string;
  order?: number;
  parent?: string;
  parents?: string[];
  path: string;
  show?: boolean;
}

export type { ExRouteRecordRaw, MenuRecordBadgeRaw, MenuRecordRaw };
