import type { Pinia } from 'pinia';

import type { App } from 'vue';

import { createPinia } from 'pinia';
import SecureLS from 'secure-ls';

let pinia: Pinia;

export interface InitStoreOptions {
  namespace: string;
}

/**
 * 为 Vue 应用创建并安装 Pinia，再按选项初始化持久化扩展。
 *
 * @param app - 要安装新建 Pinia 实例的 Vue 应用。
 * @param options - Pinia 初始化后可选执行的持久化等扩展配置。
 * @returns 安装到 Vue 应用的 Pinia 实例。
 */
export async function initStores(app: App, options: InitStoreOptions) {
  const { createPersistedState } = await import('pinia-plugin-persistedstate');
  pinia = createPinia();
  const { namespace } = options;
  const ls = new SecureLS({
    encodingType: 'aes',
    encryptionSecret: import.meta.env.VITE_APP_STORE_SECURE_KEY,
    isCompression: true,
    // @ts-ignore secure-ls does not have a type definition for this
    metaKey: `${namespace}-secure-meta`,
  });
  pinia.use(
    createPersistedState({
      // key $appName-$store.id
      key: (storeKey) => `${namespace}-${storeKey}`,
      storage: (() => {
        if (import.meta.env.DEV) {
          return localStorage;
        }
        return {
          /**
           * 根据命名空间键读取持久化 store 项，数据不存在时返回 undefined。
           *
           * @param key - 不含应用命名空间前缀的持久化 store 键。
           * @returns 命名空间键对应的持久化值；不存在时返回 undefined。
           */
          getItem(key) {
            return ls.get(key);
          },
          /**
           * 按命名空间键把值写入持久化本地存储。
           *
           * @param key - 不含应用命名空间前缀的持久化 store 键。
           * @param value - 需要经 secure-ls 加密并持久化的 store 内容。
           */
          setItem(key, value) {
            ls.set(key, value);
          },
        };
      })(),
    }),
  );
  app.use(pinia);
  return pinia;
}

/**
 * 遍历已注册 Pinia store 并调用各自 `$reset`；Pinia 未安装时只记录错误。
 */
export function resetAllStores() {
  if (!pinia) {
    console.error('Pinia is not installed');
    return;
  }
  const allStores = (pinia as any)._s;
  for (const [_key, store] of allStores) {
    store.$reset();
  }
}
