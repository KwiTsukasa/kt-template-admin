import type {
  ComponentInternalInstance,
  VNode,
  VNodeChild,
  VNodeNormalizedChildren,
} from 'vue';

import { isVNode } from 'vue';

type VNodeChildAtom = Exclude<VNodeChild, Array<any>>;
type RawSlots = Exclude<VNodeNormalizedChildren, Array<any> | null | string>;

type FlattenVNodes = Array<RawSlots | VNodeChildAtom>;

/**
 * 从目标节点沿 Vue 组件父链查找首个名称匹配的组件实例，遍历到根节点仍未命中时返回 undefined。
 *
 * @param instance - 开始向父链查找的当前 Vue 组件实例。
 * @param parentNames - 向上查找组件时允许匹配的父组件名称集合。
 * @returns 父链中首个组件名匹配的实例；遍历到根节点仍未命中时返回 undefined。
 */
function findComponentUpward(
  instance: ComponentInternalInstance,
  parentNames: string[],
) {
  let parent = instance.parent;
  while (parent && !parentNames.includes(parent?.type?.name ?? '')) {
    parent = parent.parent;
  }
  return parent;
}

const flattedChildren = (
  children: FlattenVNodes | VNode | VNodeNormalizedChildren,
): FlattenVNodes => {
  const vNodes = (() => {
    if (Array.isArray(children)) {
      return children;
    }
    return [children];
  })();
  const result: FlattenVNodes = [];

  vNodes.forEach((child) => {
    if (Array.isArray(child)) {
      result.push(...flattedChildren(child));
    } else if (isVNode(child) && Array.isArray(child.children)) {
      result.push(...flattedChildren(child.children));
    } else {
      result.push(child);
      if (isVNode(child) && child.component?.subTree) {
        result.push(...flattedChildren(child.component.subTree));
      }
    }
  });
  return result;
};

export { findComponentUpward, flattedChildren };
