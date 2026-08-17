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
 * 通过合并静态、模块与运行时 hook 建立统一生命周期调用入口。
 *
 * @param props - 静态 hook 与可插拔模块集合。
 * @returns 运行时 hook 的注册、注销和按生命周期执行方法。
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
   * 将运行时 hook 按名称写入注册表；同名项会被最新实例替换。
   *
   * @param hook - 要按名称注册或替换的运行时 KtTable hook。
   * @returns 注销本次 hook 的函数。
   */
  function registerHook(hook: KtTableHook) {
    runtimeHooks.value = [
      ...runtimeHooks.value.filter((item) => item.name !== hook.name),
      hook,
    ];

    return () => unregisterHook(hook.name);
  }

  /**
   * 根据 hook 名称移除运行时 hook。
   *
   * @param name - 要从运行时注册表移除的 hook 名称。
   */
  function unregisterHook(name: string) {
    runtimeHooks.value = runtimeHooks.value.filter(
      (item) => item.name !== name,
    );
  }

  /**
   * 按注册顺序调用所有实现了目标生命周期的 hook，并等待异步结果。
   *
   * @param handler - 准备在所有 KtTable hook 上依次调用的生命周期字段名。
   * @param params - 传给 KtTable 生命周期 hook 的位置参数。
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
