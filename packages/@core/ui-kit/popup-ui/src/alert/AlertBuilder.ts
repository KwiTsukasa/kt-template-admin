import type { Component, VNode } from 'vue';

import type { Recordable } from '@vben-core/typings';

import type { AlertProps, BeforeCloseScope, PromptProps } from './alert';

import { h, nextTick, ref, render } from 'vue';

import { useSimpleLocale } from '@vben-core/composables';
import { Input, VbenRenderContent } from '@vben-core/shadcn-ui';
import { isFunction, isString } from '@vben-core/shared/utils';

import Alert from './alert.vue';

const alerts = ref<Array<{ container: HTMLElement; instance: Component }>>([]);

const { $t } = useSimpleLocale();

export function vbenAlert(options: AlertProps): Promise<void>;
export function vbenAlert(
  message: string,
  options?: Partial<AlertProps>,
): Promise<void>;
export function vbenAlert(
  message: string,
  title?: string,
  options?: Partial<AlertProps>,
): Promise<void>;

/**
 * 以统一 Vben 样式打开提示对话框，并转发标题、内容与确认回调。
 *
 * @param arg0 - 转交给被代理函数的第一个位置参数。
 * @param arg1 - 转交给被代理函数的第二个位置参数。
 * @param arg2 - 转交给被代理函数的第三个位置参数。
 * @returns 对话框实例或底层组件返回的控制句柄。
 */
export function vbenAlert(
  arg0: AlertProps | string,
  arg1?: Partial<AlertProps> | string,
  arg2?: Partial<AlertProps>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const options: AlertProps = (() => {
      if (isString(arg0)) {
        return {
          content: arg0,
        };
      }
      return { ...arg0 };
    })();
    if (arg1) {
      if (isString(arg1)) {
        options.title = arg1;
      } else if (!isString(arg1)) {
        // 如果第二个参数是对象，则合并到选项中
        Object.assign(options, arg1);
      }
    }

    if (arg2 && !isString(arg2)) {
      Object.assign(options, arg2);
    }
    // 创建容器元素
    const container = document.createElement('div');
    document.body.append(container);

    // 创建一个引用，用于在回调中访问实例
    const alertRef = { container, instance: null as any };

    const props: AlertProps & Recordable<any> = {
      onClosed: (isConfirm: boolean) => {
        // 移除组件实例以及创建的所有dom（恢复页面到打开前的状态）
        // 从alerts数组中移除该实例
        alerts.value = alerts.value.filter((item) => item !== alertRef);

        // 从DOM中移除容器
        render(null, container);
        if (container.parentNode) {
          container.remove();
        }

        // 解析 Promise，传递用户操作结果
        if (isConfirm) {
          resolve();
        } else {
          reject(new Error('dialog cancelled'));
        }
      },
      ...options,
      open: true,
      title: options.title ?? $t.value('prompt'),
    };

    // 创建Alert组件的VNode
    const vnode = h(Alert, props);

    // 渲染组件到容器
    render(vnode, container);

    // 保存组件实例引用
    alertRef.instance = vnode.component?.proxy as Component;

    // 将实例和容器添加到alerts数组中
    alerts.value.push(alertRef);
  });
}

export function vbenConfirm(options: AlertProps): Promise<void>;
export function vbenConfirm(
  message: string,
  options?: Partial<AlertProps>,
): Promise<void>;
export function vbenConfirm(
  message: string,
  title?: string,
  options?: Partial<AlertProps>,
): Promise<void>;

/**
 * 以统一 Vben 样式打开确认对话框，并返回用户确认结果。
 *
 * @param arg0 - 转交给被代理函数的第一个位置参数。
 * @param arg1 - 转交给被代理函数的第二个位置参数。
 * @param arg2 - 转交给被代理函数的第三个位置参数。
 * @returns 用户确认时为 true，取消时为 false 的 Promise 结果。
 */
export function vbenConfirm(
  arg0: AlertProps | string,
  arg1?: Partial<AlertProps> | string,
  arg2?: Partial<AlertProps>,
): Promise<void> {
  const defaultProps: Partial<AlertProps> = {
    showCancel: true,
  };
  if (!arg1) {
    if (isString(arg0)) {
      return vbenAlert(arg0, defaultProps);
    }
    return vbenAlert({ ...defaultProps, ...arg0 });
  } else if (!arg2) {
    if (isString(arg1)) {
      return vbenAlert(arg0 as string, arg1, defaultProps);
    }
    return vbenAlert(arg0 as string, { ...defaultProps, ...arg1 });
  }
  return vbenAlert(arg0 as string, arg1 as string, {
    ...defaultProps,
    ...arg2,
  });
}

/**
 * 打开带输入框的 Vben 提示对话框，并返回用户输入或取消结果。
 *
 * @param options - 提示框标题、默认输入、校验和按钮等配置。
 * @returns 用户确认后的输入值；取消对话框时返回 undefined。
 */
export async function vbenPrompt<T = any>(
  options: PromptProps<T>,
): Promise<T | undefined> {
  const {
    component: _component,
    componentProps: _componentProps,
    componentSlots,
    content,
    defaultValue,
    modelPropName: _modelPropName,
    ...delegated
  } = options;

  const modelValue = ref<T | undefined>(defaultValue);
  const inputComponentRef = ref<null | VNode>(null);
  const staticContents: Component[] = [
    h(VbenRenderContent, { content, renderBr: true }),
  ];

  const modelPropName = _modelPropName || 'modelValue';
  const componentProps = { ..._componentProps };

  // 每次渲染时都会重新计算的内容函数
  const contentRenderer = () => {
    const currentProps = {
      ...componentProps,
      [modelPropName]: modelValue.value,
      [`onUpdate:${modelPropName}`]: (val: T) => {
        modelValue.value = val;
      },
    };

    // 设置当前值

    // 设置更新处理函数

    // 创建输入组件
    inputComponentRef.value = h(
      _component || Input,
      currentProps,
      componentSlots,
    );

    // 返回包含静态内容和输入组件的数组
    return h(
      'div',
      { class: 'flex flex-col gap-2' },
      { default: () => [...staticContents, inputComponentRef.value] },
    );
  };

  const props: AlertProps & Recordable<any> = {
    ...delegated,
    /**
     * 在关闭弹窗前执行外部拦截器，仅当拦截器允许时才继续关闭。
     *
     * @param scope - 当前操作允许访问的权限或样式作用域。
     * @returns 外部关闭拦截器的返回值；未配置拦截器时返回 undefined。
     */
    async beforeClose(scope: BeforeCloseScope) {
      if (delegated.beforeClose) {
        return await delegated.beforeClose({
          ...scope,
          value: modelValue.value,
        });
      }
    },
    // 使用函数形式，每次渲染都会重新计算内容
    content: contentRenderer,
    contentMasking: true,
    /**
     * 提示框打开并完成渲染后，把焦点移到输入组件或首个可聚焦后代。
     */
    async onOpened() {
      await nextTick();
      const componentRef: null | VNode = inputComponentRef.value;
      if (componentRef) {
        if (
          componentRef.component?.exposed &&
          isFunction(componentRef.component.exposed.focus)
        ) {
          componentRef.component.exposed.focus();
        } else {
          if (componentRef.el) {
            if (
              isFunction(componentRef.el.focus) &&
              ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(
                componentRef.el.tagName,
              )
            ) {
              componentRef.el.focus();
            } else if (isFunction(componentRef.el.querySelector)) {
              const focusableElement = componentRef.el.querySelector(
                'input, select, textarea, button',
              );
              if (focusableElement && isFunction(focusableElement.focus)) {
                focusableElement.focus();
              }
            } else if (
              componentRef.el.nextElementSibling &&
              isFunction(componentRef.el.nextElementSibling.focus)
            ) {
              componentRef.el.nextElementSibling.focus();
            }
          }
        }
      }
    },
  };

  await vbenConfirm(props);
  return modelValue.value;
}

/**
 * 卸载全部提示框 Vue 容器、移除对应 DOM 并清空提示记录。
 */
export function clearAllAlerts() {
  alerts.value.forEach((alert) => {
    // 从DOM中移除容器
    render(null, alert.container);
    if (alert.container.parentNode) {
      alert.container.remove();
    }
  });
  alerts.value = [];
}
