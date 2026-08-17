/**
 * 把实例原型上的普通方法绑定到当前实例，并跳过构造器与访问器。
 *
 * @param instance - 需要把原型普通方法绑定到自身 this 的类实例；访问器和构造器会跳过。
 */
export function bindMethods<T extends object>(instance: T): void {
  const prototype = Object.getPrototypeOf(instance);
  const propertyNames = Object.getOwnPropertyNames(prototype);

  propertyNames.forEach((propertyName) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
    const propertyValue = instance[propertyName as keyof T];

    if (
      typeof propertyValue === 'function' &&
      propertyName !== 'constructor' &&
      descriptor &&
      !descriptor.get &&
      !descriptor.set
    ) {
      instance[propertyName as keyof T] = propertyValue.bind(instance);
    }
  });
}

/**
 * 沿点分隔字段路径读取嵌套值；任一层缺失时返回 undefined。
 *
 * @param obj - 需要沿字段路径逐级读取的对象。
 * @param path - 以点分隔、要从对象逐级读取的非空字段路径。
 * @returns 字段路径指向的嵌套值；任一层缺失时为 undefined。
 * @throws path 不是非空字符串时抛出。
 */
export function getNestedValue<T>(obj: T, path: string): any {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('Path must be a non-empty string');
  }
  // 把路径字符串按 "." 分割成数组
  const keys = path.split('.') as (number | string)[];

  let current: any = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key as keyof typeof current];
  }

  return current;
}
