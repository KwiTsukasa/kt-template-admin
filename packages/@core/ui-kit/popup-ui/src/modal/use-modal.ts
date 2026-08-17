import type { ExtendedModalApi, ModalApiOptions, ModalProps } from './modal';

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

import { ModalApi } from './modal-api';
import VbenModal from './modal.vue';

const USER_MODAL_INJECT_KEY = Symbol('VBEN_MODAL_INJECT');

const DEFAULT_MODAL_PROPS: Partial<ModalProps> = {};

/**
 * 把调用方属性合并到全局弹窗默认配置，后续创建的弹窗继承新值。
 *
 * @param props - 要合并进所有后续弹窗实例的默认属性。
 */
export function setDefaultModalProps(props: Partial<ModalProps>) {
  Object.assign(DEFAULT_MODAL_PROPS, props);
}

/**
 * 创建弹窗 API 与包装组件，并在组件挂载和卸载时绑定或释放实例。
 *
 * @param options - 弹窗初始属性、事件回调及可选外部连接组件；省略时合并全局默认值。
 * @returns 弹窗 API 与负责绑定该 API 的包装组件。
 */
export function useVbenModal<TParentModalProps extends ModalProps = ModalProps>(
  options: ModalApiOptions = {},
) {
  // Modal一般会抽离出来，所以如果有传入 connectedComponent，则表示为外部调用，与内部组件进行连接
  // 外部的Modal通过provide/inject传递api

  const { connectedComponent } = options;
  if (connectedComponent) {
    const extendedApi = reactive({});
    const isModalReady = ref(true);
    const Modal = defineComponent(
      (props: TParentModalProps, { attrs, slots }) => {
        provide(USER_MODAL_INJECT_KEY, {
          /**
           * 通过共享状态处理器扩展弹窗或抽屉 API，使实例方法操作同一份响应式状态。
           *
           * @param api - 由组件注册得到、用于驱动其状态和方法的 API 实例。
           */
          extendApi(api: ExtendedModalApi) {
            // 不能直接给 reactive 赋值，会丢失响应
            // 不能用 Object.assign,会丢失 api 的原型函数
            Object.setPrototypeOf(extendedApi, api);
          },
          consumed: false,
          options,
          /**
           * 重新创建弹窗 API 与组件绑定，保留调用方配置并替换旧实例。
           */
          async reCreateModal() {
            isModalReady.value = false;
            await nextTick();
            isModalReady.value = true;
          },
        });
        checkProps(extendedApi as ExtendedModalApi, {
          ...props,
          ...attrs,
          ...slots,
        });
        return () =>
          h(
            (() => {
              if (isModalReady.value) {
                return connectedComponent;
              }
              return 'div';
            })(),
            {
              ...props,
              ...attrs,
            },
            slots,
          );
      },
      // eslint-disable-next-line vue/one-component-per-file
      {
        name: 'VbenParentModal',
        inheritAttrs: false,
      },
    );

    return [Modal, extendedApi as ExtendedModalApi] as const;
  }

  let injectData = inject<any>(USER_MODAL_INJECT_KEY, {});
  // 这个数据已经被使用了，说明这个弹窗是嵌套的弹窗，不应该merge上层的配置
  if (injectData.consumed) {
    injectData = {};
  } else {
    injectData.consumed = true;
  }

  const mergedOptions = {
    ...DEFAULT_MODAL_PROPS,
    ...injectData.options,
    ...options,
  } as ModalApiOptions;

  mergedOptions.onOpenChange = (isOpen: boolean) => {
    options.onOpenChange?.(isOpen);
    injectData.options?.onOpenChange?.(isOpen);
  };

  const onClosed = mergedOptions.onClosed;
  mergedOptions.onClosed = () => {
    onClosed?.();
    if (mergedOptions.destroyOnClose) {
      injectData.consumed = false;
      injectData.reCreateModal?.();
    }
  };

  const api = new ModalApi(mergedOptions);

  const extendedApi: ExtendedModalApi = api as never;

  extendedApi.useStore = (selector) => {
    return useStore(api.store, selector);
  };

  const Modal = defineComponent(
    (props: ModalProps, { attrs, slots }) => {
      return () =>
        h(
          VbenModal,
          {
            ...props,
            ...attrs,
            modalApi: extendedApi,
          },
          slots,
        );
    },
    // eslint-disable-next-line vue/one-component-per-file
    {
      name: 'VbenModal',
      inheritAttrs: false,
    },
  );
  injectData.extendApi?.(extendedApi);

  return [Modal, extendedApi] as const;
}

/**
 * 连接弹窗组件时检查透传属性，若属性与 API 状态字段冲突则输出使用 API 修改的警告。
 *
 * @param api - 由组件注册得到、用于驱动其状态和方法的 API 实例。
 * @param attrs - 需要合并或转发到目标组件的属性对象。
 */
async function checkProps(api: ExtendedModalApi, attrs: Record<string, any>) {
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
      // connectedComponent存在时，不要传入Modal的props，会造成复杂度提升，如果你需要修改Modal的props，请使用 useModal 或者api
      console.warn(
        `[Vben Modal]: When 'connectedComponent' exists, do not set props or slots '${attr}', which will increase complexity. If you need to modify the props of Modal, please use useVbenModal or api.`,
      );
    }
  }
}
