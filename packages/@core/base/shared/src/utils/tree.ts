interface TreeConfigOptions {
  // 子属性的名称，默认为'children'
  childProps: string;
}

/**
 * 按深度优先顺序遍历树，并把取值函数结果收集为扁平数组。
 *
 * @param tree - 要按深度优先顺序遍历并提取值的树节点集合。
 * @param getValue - 从树节点提取目标值的函数。
 * @param options - 树结构子节点字段名及遍历行为配置。
 * @returns 按深度优先顺序收集的节点值数组。
 */
function traverseTreeValues<T, V>(
  tree: T[],
  getValue: (node: T) => V,
  options?: TreeConfigOptions,
): V[] {
  const result: V[] = [];
  const { childProps } = options || {
    childProps: 'children',
  };

  const dfs = (treeNode: T) => {
    const value = getValue(treeNode);
    result.push(value);
    const children = (treeNode as Record<string, any>)?.[childProps];
    if (!children) {
      return;
    }
    if (children.length > 0) {
      for (const child of children) {
        dfs(child);
      }
    }
  };

  for (const treeNode of tree) {
    dfs(treeNode);
  }
  return result.filter(Boolean);
}

/**
 * 根据谓词递归筛选树节点，并保留通向匹配后代的父节点结构。
 *
 * @param tree - 要递归应用谓词并保留匹配节点的树结构。
 * @param filter - 决定树节点是否进入扁平结果的谓词函数。
 * @param options - 树结构子节点字段名及遍历行为配置。
 * @returns 保留匹配节点及其祖先路径的新树；无匹配时为空数组。
 */
function filterTree<T extends Record<string, any>>(
  tree: T[],
  filter: (node: T) => boolean,
  options?: TreeConfigOptions,
): T[] {
  const { childProps } = options || {
    childProps: 'children',
  };

  const _filterTree = (nodes: T[]): T[] => {
    return nodes.filter((node: Record<string, any>) => {
      if (filter(node as T)) {
        if (node[childProps]) {
          node[childProps] = _filterTree(node[childProps]);
        }
        return true;
      }
      return false;
    });
  };

  return _filterTree(tree);
}

/**
 * 根据映射函数递归转换每个树节点，同时保持原有层级关系。
 *
 * @param tree - 要逐节点转换且保留层级关系的树结构。
 * @param mapper - 把每个树节点转换成新节点值的映射函数。
 * @param options - 树结构子节点字段名及遍历行为配置。
 * @returns 保持层级关系、每个节点均经 mapper 转换的新树。
 */
function mapTree<T, V extends Record<string, any>>(
  tree: T[],
  mapper: (node: T) => V,
  options?: TreeConfigOptions,
): V[] {
  const { childProps } = options || {
    childProps: 'children',
  };
  return tree.map((node) => {
    const mapperNode: Record<string, any> = mapper(node);
    if (mapperNode[childProps]) {
      mapperNode[childProps] = mapTree(mapperNode[childProps], mapper, options);
    }
    return mapperNode as V;
  });
}

/**
 * 根据比较函数递归排序树的每一层，并返回同一树引用。
 *
 * @param treeData - 需要在每一层按比较函数排序的树节点集合。
 * @param sortFunction - 比较同级树节点先后顺序的函数。
 * @param options - 树结构子节点字段名及遍历行为配置。
 * @returns 每层均完成排序的原树引用。
 */
function sortTree<T extends Record<string, any>>(
  treeData: T[],
  sortFunction: (a: T, b: T) => number,
  options?: TreeConfigOptions,
): T[] {
  const { childProps } = options || {
    childProps: 'children',
  };

  return treeData.toSorted(sortFunction).map((item) => {
    const children = item[childProps];
    if (children && Array.isArray(children) && children.length > 0) {
      return {
        ...item,
        [childProps]: sortTree(children, sortFunction, options),
      };
    }
    return item;
  });
}

export { filterTree, mapTree, sortTree, traverseTreeValues };
