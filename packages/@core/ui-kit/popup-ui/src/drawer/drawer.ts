import type { Component, Ref } from 'vue';

import type { ClassType, MaybePromise } from '@vben-core/typings';

import type { DrawerApi } from './drawer-api';

export type DrawerPlacement = 'bottom' | 'left' | 'right' | 'top';

export type CloseIconPlacement = 'left' | 'right';

export interface DrawerProps {
  appendToMain?: boolean;
  cancelText?: string;
  class?: ClassType;
  closable?: boolean;
  closeIconPlacement?: CloseIconPlacement;
  closeOnClickModal?: boolean;
  closeOnPressEscape?: boolean;
  confirmLoading?: boolean;
  confirmText?: string;
  contentClass?: string;
  description?: string;
  destroyOnClose?: boolean;
  footer?: boolean;
  footerClass?: ClassType;
  header?: boolean;
  headerClass?: ClassType;
  loading?: boolean;
  modal?: boolean;

  openAutoFocus?: boolean;
  overlayBlur?: number;
  placement?: DrawerPlacement;

  showCancelButton?: boolean;
  showConfirmButton?: boolean;
  submitting?: boolean;
  title?: string;
  titleTooltip?: string;
  zIndex?: number;
}

export interface DrawerState extends DrawerProps {
  isOpen?: boolean;
  sharedData?: Record<string, any>;
}

export type ExtendedDrawerApi = DrawerApi & {
  useStore: <T = NoInfer<DrawerState>>(
    selector?: (state: NoInfer<DrawerState>) => T,
  ) => Readonly<Ref<T>>;
};

export interface DrawerApiOptions extends DrawerState {
  connectedComponent?: Component;
  onBeforeClose?: () => MaybePromise<boolean | undefined>;
  onCancel?: () => void;
  onClosed?: () => void;
  onConfirm?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
  onOpened?: () => void;
}
