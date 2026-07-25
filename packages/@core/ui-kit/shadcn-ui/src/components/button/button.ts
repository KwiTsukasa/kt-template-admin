import type { AsTag } from 'reka-ui';

import type { Component } from 'vue';

import type { ButtonVariants, ButtonVariantSize } from '../../ui';

export interface VbenButtonProps {
  as?: AsTag | Component;
  asChild?: boolean;
  class?: any;
  disabled?: boolean;
  loading?: boolean;
  size?: ButtonVariantSize;
  variant?: ButtonVariants;
}

export type CustomRenderType = (() => Component | string) | string;

export type ValueType = boolean | number | string;

export interface VbenButtonGroupProps extends Pick<
  VbenButtonProps,
  'disabled'
> {
  allowClear?: boolean;
  beforeChange?: (
    value: ValueType,
    isChecked: boolean,
  ) => boolean | PromiseLike<boolean | undefined> | undefined;
  btnClass?: any;
  gap?: number;
  maxCount?: number;
  multiple?: boolean;
  options?: { [key: string]: any; label: CustomRenderType; value: ValueType }[];
  showIcon?: boolean;
  size?: 'large' | 'middle' | 'small';
}
