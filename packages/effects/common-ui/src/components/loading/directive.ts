import type { App, Directive, DirectiveBinding } from 'vue';

import { h, render } from 'vue';

import { VbenLoading, VbenSpinner } from '@vben-core/shadcn-ui';
import { isString } from '@vben-core/shared/utils';

const LOADING_INSTANCE_KEY = Symbol('loading');
const SPINNER_INSTANCE_KEY = Symbol('spinner');

const CLASS_NAME_RELATIVE = 'spinner-parent--relative';

const loadingDirective: Directive = {
  mounted(el, binding) {
    const instance = h(VbenLoading, getOptions(binding));
    render(instance, el);

    el.classList.add(CLASS_NAME_RELATIVE);
    el[LOADING_INSTANCE_KEY] = instance;
  },
  unmounted(el) {
    const instance = el[LOADING_INSTANCE_KEY];
    el.classList.remove(CLASS_NAME_RELATIVE);
    render(null, el);
    instance.el.remove();

    el[LOADING_INSTANCE_KEY] = null;
  },

  updated(el, binding) {
    const instance = el[LOADING_INSTANCE_KEY];
    const options = getOptions(binding);
    if (options && instance?.component) {
      try {
        Object.keys(options).forEach((key) => {
          instance.component.props[key] = options[key];
        });
        instance.component.update();
      } catch (error) {
        console.error(
          'Failed to update loading component in directive:',
          error,
        );
      }
    }
  },
};

/**
 * 把加载指令绑定值归一为文本与布尔选项，缺省字段使用指令默认值。
 *
 * @param binding - 加载指令当前绑定的文本或选项对象。
 * @returns 归一后的加载文本与是否旋转选项。
 */
function getOptions(binding: DirectiveBinding) {
  if (binding.value === undefined) {
    return { spinning: true };
  } else if (typeof binding.value === 'boolean') {
    return { spinning: binding.value };
  } else {
    return { ...binding.value };
  }
}

const spinningDirective: Directive = {
  mounted(el, binding) {
    const instance = h(VbenSpinner, getOptions(binding));
    render(instance, el);

    el.classList.add(CLASS_NAME_RELATIVE);
    el[SPINNER_INSTANCE_KEY] = instance;
  },
  unmounted(el) {
    const instance = el[SPINNER_INSTANCE_KEY];
    el.classList.remove(CLASS_NAME_RELATIVE);
    render(null, el);
    instance.el.remove();

    el[SPINNER_INSTANCE_KEY] = null;
  },

  updated(el, binding) {
    const instance = el[SPINNER_INSTANCE_KEY];
    const options = getOptions(binding);
    if (options && instance?.component) {
      try {
        Object.keys(options).forEach((key) => {
          instance.component.props[key] = options[key];
        });
        instance.component.update();
      } catch (error) {
        console.error(
          'Failed to update spinner component in directive:',
          error,
        );
      }
    }
  },
};

type loadingDirectiveParams = {
  loading?: boolean | string;
  spinning?: boolean | string;
};

/**
 * 把 `loading` 指令及其参数解析逻辑注册到 Vue 应用。
 *
 * @param app - 要注册 loading 指令的 Vue 应用实例。
 * @param params - loading 指令的自定义文案、遮罩和图标参数。
 */
export function registerLoadingDirective(
  app: App,
  params?: loadingDirectiveParams,
) {
  // 注入一个样式供指令使用，确保容器是相对定位
  const style = document.createElement('style');
  style.id = CLASS_NAME_RELATIVE;
  style.innerHTML = `
    .${CLASS_NAME_RELATIVE} {
      position: relative !important;
    }
  `;
  document.head.append(style);
  if (params?.loading !== false) {
    app.directive(
      (() => {
        if (isString(params?.loading)) {
          return params.loading;
        }
        return 'loading';
      })(),
      loadingDirective,
    );
  }
  if (params?.spinning !== false) {
    app.directive(
      (() => {
        if (isString(params?.spinning)) {
          return params.spinning;
        }
        return 'spinning';
      })(),
      spinningDirective,
    );
  }
}
