import type { Arrayable } from '@vueuse/core';
import type { FlattenedItem } from 'reka-ui';

import type { Recordable } from '@vben-core/typings';

export interface TreeProps {
  allowClear?: boolean;
  autoCheckParent?: boolean;
  bordered?: boolean;
  checkStrictly?: boolean;
  childrenField?: string;
  defaultExpandedKeys?: Array<number | string>;
  defaultExpandedLevel?: number;
  defaultValue?: Arrayable<number | string>;
  disabled?: boolean;
  disabledField?: string;
  getNodeClass?: (item: FlattenedItem<Recordable<any>>) => string;
  iconField?: string;
  labelField?: string;
  multiple?: boolean;
  showIcon?: boolean;
  transition?: boolean;
  treeData: Recordable<any>[];
  valueField?: string;
}

/**
 * 补齐树组件属性的默认值，保留调用方已显式提供的配置。
 *
 * @returns 补齐默认值后的树组件属性对象。
 */
export function treePropsDefaults() {
  return {
    allowClear: false,
    autoCheckParent: true,
    bordered: false,
    checkStrictly: false,
    defaultExpandedKeys: () => [],
    defaultExpandedLevel: 0,
    disabled: false,
    disabledField: 'disabled',
    iconField: 'icon',
    labelField: 'label',
    multiple: false,
    showIcon: true,
    transition: true,
    valueField: 'value',
    childrenField: 'children',
  };
}
