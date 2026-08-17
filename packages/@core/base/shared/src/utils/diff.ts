// type Diff<T = any> = T;

// 比较两个数组是否相等

/**
 * 通过元素计数比较两个数组是否包含相同多重集合，不要求元素顺序一致。
 *
 * @param a - 作为计数基准的第一个数组。
 * @param b - 与基准比较元素数量的第二个数组。
 * @returns 两个数组长度相同且每种元素出现次数一致时返回 true，否则返回 false。
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const counter = new Map<T, number>();
  for (const value of a) {
    counter.set(value, (counter.get(value) || 0) + 1);
  }
  for (const value of b) {
    const count = counter.get(value);
    if (count === undefined || count === 0) {
      return false;
    }
    counter.set(value, count - 1);
  }
  return true;
}

// 深度对比两个值
// function deepEqual<T>(oldVal: T, newVal: T): boolean {
//   if (
//     typeof oldVal === 'object' &&
//     oldVal !== null &&
//     typeof newVal === 'object' &&
//     newVal !== null
//   ) {
//     return Array.isArray(oldVal) && Array.isArray(newVal)
//       ? arraysEqual(oldVal, newVal)
//       : diff(oldVal as any, newVal as any) === null;
//   } else {
//     return oldVal === newVal;
//   }
// }

// // diff 函数
// function diff<T extends object>(
//   oldObj: T,
//   newObj: T,
//   ignoreFields: (keyof T)[] = [],
// ): { [K in keyof T]?: Diff<T[K]> } | null {
//   const difference: { [K in keyof T]?: Diff<T[K]> } = {};

//   for (const key in oldObj) {
//     if (ignoreFields.includes(key)) continue;
//     const oldValue = oldObj[key];
//     const newValue = newObj[key];

//     if (!deepEqual(oldValue, newValue)) {
//       difference[key] = newValue;
//     }
//   }

//   return Object.keys(difference).length === 0 ? null : difference;
// }

type DiffResult<T> = Partial<{
  [K in keyof T]: T[K] extends object ? DiffResult<T[K]> : T[K];
}>;

/**
 * 通过递归比较两个值的键和值，返回只包含变化路径的差异对象。
 *
 * @param obj1 - 参与差异比较的第一个对象。
 * @param obj2 - 参与差异比较的第二个对象。
 * @returns 只包含变化字段的差异对象；没有差异时返回空对象。
 */
function diff<T extends Record<string, any>>(obj1: T, obj2: T): DiffResult<T> {
  /**
   * 递归比较两个对象并收集值不同的路径，不记录两侧都缺失的字段。
   *
   * @param o1 - 参与差异比较的第一个对象。
   * @param o2 - 参与差异比较的第二个对象。
   * @returns 当前路径下首个差异说明；两侧值完全一致时返回 undefined。
   */
  function findDifferences(o1: any, o2: any): any {
    if (Array.isArray(o1) && Array.isArray(o2)) {
      if (!arraysEqual(o1, o2)) {
        return o2;
      }
      return undefined;
    }

    if (
      typeof o1 === 'object' &&
      typeof o2 === 'object' &&
      o1 !== null &&
      o2 !== null
    ) {
      const diffResult: any = {};

      const keys = new Set([...Object.keys(o1), ...Object.keys(o2)]);
      keys.forEach((key) => {
        const valueDiff = findDifferences(o1[key], o2[key]);
        if (valueDiff !== undefined) {
          diffResult[key] = valueDiff;
        }
      });

      if (Object.keys(diffResult).length > 0) {
        return diffResult;
      }
      return undefined;
    }

    if (o1 === o2) {
      return undefined;
    }
    return o2;
  }

  return findDifferences(obj1, obj2);
}

export { arraysEqual, diff };
