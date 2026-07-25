import type { Component, Ref } from 'vue';

import type { MaybePromise } from '@vben-core/typings';

import type { ModalApi } from './modal-api';

export interface ModalProps {
  animationType?: 'scale' | 'slide';
  appendToMain?: boolean;
  bordered?: boolean;
  cancelText?: string;
  centered?: boolean;

  class?: string;

  closable?: boolean;
  closeOnClickModal?: boolean;
  closeOnPressEscape?: boolean;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  confirmText?: string;
  contentClass?: string;
  description?: string;
  destroyOnClose?: boolean;
  draggable?: boolean;
  footer?: boolean;
  footerClass?: string;
  fullscreen?: boolean;
  fullscreenButton?: boolean;
  header?: boolean;
  headerClass?: string;
  loading?: boolean;
  modal?: boolean;
  openAutoFocus?: boolean;
  overlayBlur?: number;
  showCancelButton?: boolean;
  showConfirmButton?: boolean;
  submitting?: boolean;
  title?: string;
  titleTooltip?: string;
  zIndex?: number;
}

export interface ModalState extends ModalProps {
  isOpen?: boolean;
  sharedData?: Record<string, any>;
}

export type ExtendedModalApi = ModalApi & {
  useStore: <T = NoInfer<ModalState>>(
    selector?: (state: NoInfer<ModalState>) => T,
  ) => Readonly<Ref<T>>;
};

export interface ModalApiOptions extends ModalState {
  connectedComponent?: Component;
  onBeforeClose?: () => MaybePromise<boolean | undefined>;
  onCancel?: () => void;
  onClosed?: () => void;
  onConfirm?: () => void;
  onOpenChange?: (isOpen: boolean) => void;
  onOpened?: () => void;
}
