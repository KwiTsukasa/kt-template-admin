export class Stack<T> {
  /**
   * 从内部数组读取当前栈元素数量。
   *
   * @returns 当前栈内元素数量。
   */
  get size() {
    return this.items.length;
  }
  private readonly dedup: boolean;
  private items: T[] = [];

  private readonly maxSize?: number;

  constructor(dedup = true, maxSize?: number) {
    this.maxSize = maxSize;
    this.dedup = dedup;
  }

  /**
   * 将栈内全部元素清空，使栈大小恢复为零。
   */
  clear() {
    this.items.length = 0;
  }

  /**
   * 从内部数组读取栈顶元素但不移除；空栈返回 undefined。
   *
   * @returns 当前栈顶元素；空栈时为 undefined。
   */
  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  /**
   * 移除并返回栈顶元素；空栈返回 undefined。
   *
   * @returns 被移除的栈顶元素；空栈时为 undefined。
   */
  pop(): T | undefined {
    return this.items.pop();
  }

  /**
   * 将一个或多个元素按顺序压入栈顶，并返回更新后的长度。
   *
   * @param items - 要按传入顺序压入栈顶的元素。
   */
  push(...items: T[]) {
    items.forEach((item) => {
      // 去重
      if (this.dedup) {
        const index = this.items.indexOf(item);
        if (index !== -1) {
          this.items.splice(index, 1);
        }
      }
      this.items.push(item);
      if (this.maxSize && this.items.length > this.maxSize) {
        this.items.splice(0, this.items.length - this.maxSize);
      }
    });
  }
  /**
   * 从栈中移除所有与给定元素列表相等的项。
   *
   * @param itemList - 需要从栈中移除的元素集合。
   */
  remove(...itemList: T[]) {
    this.items = this.items.filter((i) => !itemList.includes(i));
  }
  /**
   * 仅保留同时存在于给定集合中的栈元素。
   *
   * @param itemList - 允许继续保留在栈中的元素集合。
   */
  retain(itemList: T[]) {
    this.items = this.items.filter((i) => itemList.includes(i));
  }

  /**
   * 返回内部栈数组的浅拷贝，避免调用方直接修改存储。
   *
   * @returns 按栈内顺序复制的新数组。
   */
  toArray(): T[] {
    return [...this.items];
  }
}

export const createStack = <T>(dedup = true, maxSize?: number) =>
  new Stack<T>(dedup, maxSize);
