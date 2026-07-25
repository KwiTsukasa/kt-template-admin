import type { Component, VNode, VNodeArrayChildren } from 'vue';

import type { Recordable } from '@vben-core/typings';

import { createContext } from '@vben-core/shadcn-ui';

export type IconType = 'error' | 'info' | 'question' | 'success' | 'warning';

export type BeforeCloseScope = {
  isConfirm: boolean;
};

export type AlertProps = {
  beforeClose?: (
    scope: BeforeCloseScope,
  ) => boolean | Promise<boolean | undefined> | undefined;
  bordered?: boolean;
  buttonAlign?: 'center' | 'end' | 'start';
  cancelText?: string;
  centered?: boolean;
  confirmText?: string;
  containerClass?: string;
  content: Component | string;
  contentClass?: string;
  contentMasking?: boolean;
  footer?: Component | string;
  icon?: Component | IconType;
  overlayBlur?: number;
  showCancel?: boolean;
  title?: string;
};

export type PromptProps<T = any> = {
  beforeClose?: (scope: {
    isConfirm: boolean;
    value: T | undefined;
  }) => boolean | Promise<boolean | undefined> | undefined;
  component?: Component;
  componentProps?: Recordable<any>;
  componentSlots?:
    | (() => any)
    | Recordable<unknown>
    | VNode
    | VNodeArrayChildren;
  defaultValue?: T;
  modelPropName?: string;
} & Omit<AlertProps, 'beforeClose'>;

export type AlertContext = {
  doCancel: () => void;
  doConfirm: () => void;
};

export const [injectAlertContext, provideAlertContext] =
  createContext<AlertContext>('VbenAlertContext');

/**
 * 获取Alert上下文
 * @returns AlertContext
 */
export function useAlertContext() {
  const context = injectAlertContext();
  if (!context) {
    throw new Error('useAlertContext must be used within an AlertProvider');
  }
  return context;
}
