import type {
  KtTableHook,
  KtTableModule,
  KtTableProps,
  KtTableRecord,
} from '../types';

import { computed, shallowRef } from 'vue';

type KtTableHookHandler = Exclude<keyof KtTableHook, 'name'>;

type KtTableHookProps = Readonly<
  Pick<KtTableProps<KtTableRecord>, 'hooks' | 'modules'>
>;

/**
 * 管理 KtTable 的静态 hook、模块 hook 和运行时注册 hook。
 *
 * @param props 表格 hook 相关配置，包含主 hook 列表和模块列表。
 */
export function useKtTableRuntimeHooks(props: KtTableHookProps) {
  const runtimeHooks = shallowRef<KtTableHook[]>([]);

  const hooks = computed(() => [
    ...(props.hooks || []),
    ...(props.modules || []).flatMap(
      (module: KtTableModule) => module.hooks || [],
    ),
    ...runtimeHooks.value,
  ]);

  /**
   * 注册一个运行时 hook，同名 hook 会被替换。
   *
   * @param hook 需要注册的 hook 配置。
   */
  function registerHook(hook: KtTableHook) {
    runtimeHooks.value = [
      ...runtimeHooks.value.filter((item) => item.name !== hook.name),
      hook,
    ];

    return () => unregisterHook(hook.name);
  }

  /**
   * 按 hook 名称移除运行时 hook。
   *
   * @param name 需要移除的 hook 名称。
   */
  function unregisterHook(name: string) {
    runtimeHooks.value = runtimeHooks.value.filter(
      (item) => item.name !== name,
    );
  }

  /**
   * 依次执行所有可用 hook 上的指定生命周期函数。
   *
   * @param handler 需要触发的 hook 生命周期名称。
   * @param params 透传给 hook 生命周期函数的参数列表。
   */
  async function runHook(handler: KtTableHookHandler, ...params: unknown[]) {
    for (const hook of hooks.value) {
      const callback = hook[handler] as
        | ((...args: unknown[]) => Promise<void> | void)
        | undefined;

      if (callback) {
        await callback(...params);
      }
    }
  }

  return {
    hooks,
    registerHook,
    runHook,
    unregisterHook,
  };
}
