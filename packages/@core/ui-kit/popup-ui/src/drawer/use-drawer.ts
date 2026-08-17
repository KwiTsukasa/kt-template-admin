import type {
  DrawerApiOptions,
  DrawerProps,
  ExtendedDrawerApi,
} from './drawer';

import {
  defineComponent,
  h,
  inject,
  nextTick,
  provide,
  reactive,
  ref,
} from 'vue';

import { useStore } from '@vben-core/shared/store';

import { DrawerApi } from './drawer-api';
import VbenDrawer from './drawer.vue';

const USER_DRAWER_INJECT_KEY = Symbol('VBEN_DRAWER_INJECT');

const DEFAULT_DRAWER_PROPS: Partial<DrawerProps> = {};

/**
 * 把调用方属性合并到全局抽屉默认配置，后续创建的抽屉继承新值。
 *
 * @param props - 要合并进所有后续抽屉实例的默认属性。
 */
export function setDefaultDrawerProps(props: Partial<DrawerProps>) {
  Object.assign(DEFAULT_DRAWER_PROPS, props);
}

/**
 * 创建抽屉 API 与包装组件，并在组件挂载和卸载时绑定或释放实例。
 *
 * @param options - 抽屉初始属性、事件回调及可选外部连接组件；省略时合并全局默认值。
 * @returns 抽屉 API 与负责绑定该 API 的包装组件。
 */
export function useVbenDrawer<
  TParentDrawerProps extends DrawerProps = DrawerProps,
>(options: DrawerApiOptions = {}) {
  // Drawer一般会抽离出来，所以如果有传入 connectedComponent，则表示为外部调用，与内部组件进行连接
  // 外部的Drawer通过provide/inject传递api

  const { connectedComponent } = options;
  if (connectedComponent) {
    const extendedApi = reactive({});
    const isDrawerReady = ref(true);
    const Drawer = defineComponent(
      (props: TParentDrawerProps, { attrs, slots }) => {
        provide(USER_DRAWER_INJECT_KEY, {
          /**
           * 通过共享状态处理器扩展弹窗或抽屉 API，使实例方法操作同一份响应式状态。
           *
           * @param api - 由组件注册得到、用于驱动其状态和方法的 API 实例。
           */
          extendApi(api: ExtendedDrawerApi) {
            // 不能直接给 reactive 赋值，会丢失响应
            // 不能用 Object.assign,会丢失 api 的原型函数
            Object.setPrototypeOf(extendedApi, api);
          },
          options,
          /**
           * 重新创建抽屉 API 与组件绑定，保留调用方配置并替换旧实例。
           */
          async reCreateDrawer() {
            isDrawerReady.value = false;
            await nextTick();
            isDrawerReady.value = true;
          },
        });
        checkProps(extendedApi as ExtendedDrawerApi, {
          ...props,
          ...attrs,
          ...slots,
        });
        return () =>
          h(
            (() => {
              if (isDrawerReady.value) {
                return connectedComponent;
              }
              return 'div';
            })(),
            { ...props, ...attrs },
            slots,
          );
      },
      // eslint-disable-next-line vue/one-component-per-file
      {
        name: 'VbenParentDrawer',
        inheritAttrs: false,
      },
    );

    return [Drawer, extendedApi as ExtendedDrawerApi] as const;
  }

  const injectData = inject<any>(USER_DRAWER_INJECT_KEY, {});

  const mergedOptions = {
    ...DEFAULT_DRAWER_PROPS,
    ...injectData.options,
    ...options,
  } as DrawerApiOptions;

  mergedOptions.onOpenChange = (isOpen: boolean) => {
    options.onOpenChange?.(isOpen);
    injectData.options?.onOpenChange?.(isOpen);
  };

  const onClosed = mergedOptions.onClosed;
  mergedOptions.onClosed = () => {
    onClosed?.();
    if (mergedOptions.destroyOnClose) {
      injectData.reCreateDrawer?.();
    }
  };
  const api = new DrawerApi(mergedOptions);

  const extendedApi: ExtendedDrawerApi = api as never;

  extendedApi.useStore = (selector) => {
    return useStore(api.store, selector);
  };

  const Drawer = defineComponent(
    (props: DrawerProps, { attrs, slots }) => {
      return () =>
        h(VbenDrawer, { ...props, ...attrs, drawerApi: extendedApi }, slots);
    },
    // eslint-disable-next-line vue/one-component-per-file
    {
      name: 'VbenDrawer',
      inheritAttrs: false,
    },
  );
  injectData.extendApi?.(extendedApi);
  return [Drawer, extendedApi] as const;
}

/**
 * 连接抽屉组件时检查透传属性，若属性与 API 状态字段冲突则输出使用 API 修改的警告。
 *
 * @param api - 由组件注册得到、用于驱动其状态和方法的 API 实例。
 * @param attrs - 需要合并或转发到目标组件的属性对象。
 */
async function checkProps(api: ExtendedDrawerApi, attrs: Record<string, any>) {
  if (!attrs || Object.keys(attrs).length === 0) {
    return;
  }
  await nextTick();

  const state = api?.store?.state;

  if (!state) {
    return;
  }

  const stateKeys = new Set(Object.keys(state));

  for (const attr of Object.keys(attrs)) {
    if (stateKeys.has(attr) && !['class'].includes(attr)) {
      // connectedComponent存在时，不要传入Drawer的props，会造成复杂度提升，如果你需要修改Drawer的props，请使用 useVbenDrawer 或者api
      console.warn(
        `[Vben Drawer]: When 'connectedComponent' exists, do not set props or slots '${attr}', which will increase complexity. If you need to modify the props of Drawer, please use useVbenDrawer or api.`,
      );
    }
  }
}
