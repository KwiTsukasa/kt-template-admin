type StorageType = 'localStorage' | 'sessionStorage';

interface StorageManagerOptions {
  prefix?: string;
  storageType?: StorageType;
}

interface StorageItem<T> {
  expiry?: number;
  value: T;
}

class StorageManager {
  private prefix: string;
  private storage: Storage;

  constructor({
    prefix = '',
    storageType = 'localStorage',
  }: StorageManagerOptions = {}) {
    this.prefix = prefix;
    if (storageType === 'localStorage') {
      this.storage = window.localStorage;
    } else {
      this.storage = window.sessionStorage;
    }
  }

  /**
   * 从底层存储中删除当前命名空间前缀下的全部缓存项。
   */
  clear(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => this.storage.removeItem(key));
  }

  /**
   * 遍历当前命名空间缓存，并删除超过有效期的条目。
   */
  clearExpiredItems(): void {
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        const shortKey = key.replace(this.prefix, '');
        this.getItem(shortKey); // 调用 getItem 方法检查并移除过期项
      }
    }
  }

  /**
   * 按完整缓存键读取值；条目缺失、过期或解析失败时返回默认值。
   *
   * @param key - 不含命名空间前缀的业务存储键。
   * @param defaultValue - 缓存不存在或已过期时返回的默认值；未传入时使用 `null`。
   * @returns 反序列化后的缓存值；缺失、过期或读取失败时返回 defaultValue。
   */
  getItem<T>(key: string, defaultValue: null | T = null): null | T {
    const fullKey = this.getFullKey(key);
    const itemStr = this.storage.getItem(fullKey);
    if (!itemStr) {
      return defaultValue;
    }

    try {
      const item: StorageItem<T> = JSON.parse(itemStr);
      if (item.expiry && Date.now() > item.expiry) {
        this.storage.removeItem(fullKey);
        return defaultValue;
      }
      return item.value;
    } catch (error) {
      console.error(`Error parsing item with key "${fullKey}":`, error);
      this.storage.removeItem(fullKey); // 如果解析失败，删除该项
      return defaultValue;
    }
  }

  /**
   * 将指定业务键对应的缓存项从底层存储删除。
   *
   * @param key - 不含命名空间前缀的业务存储键。
   */
  removeItem(key: string): void {
    const fullKey = this.getFullKey(key);
    this.storage.removeItem(fullKey);
  }

  /**
   * 将值与写入时间、可选有效期序列化到当前命名空间缓存。
   *
   * @param key - 不含命名空间前缀的业务存储键。
   * @param value - 优先级组合式逻辑的外部值。
   * @param ttl - 缓存项有效期毫秒数；省略时使用管理器默认有效期。
   */
  setItem<T>(key: string, value: T, ttl?: number): void {
    const fullKey = this.getFullKey(key);
    const expiry = (() => {
      if (ttl) {
        return Date.now() + ttl;
      }
      return undefined;
    })();
    const item: StorageItem<T> = { expiry, value };
    try {
      this.storage.setItem(fullKey, JSON.stringify(item));
    } catch (error) {
      console.error(`Error setting item with key "${fullKey}":`, error);
    }
  }

  /**
   * 将命名空间前缀与业务键组合成底层存储键。
   *
   * @param key - 不含命名空间前缀的业务存储键。
   * @returns 命名空间前缀与业务键拼接后的底层存储键。
   */
  private getFullKey(key: string): string {
    return `${this.prefix}-${key}`;
  }
}

export { StorageManager };
