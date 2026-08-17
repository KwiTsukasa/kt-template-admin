import type { ComputedRef, Directive } from 'vue';

import { useTippy } from 'vue-tippy';

/**
 * 提供 Tippy 指令的挂载、更新和卸载处理，配置变化时同步更新或销毁提示实例。
 *
 * @param isDark - 当前是否使用深色主题。
 * @returns 可注册到 Vue 应用的 Tippy 指令生命周期对象。
 */
export default function useTippyDirective(isDark: ComputedRef<boolean>) {
  const directive: Directive = {
    mounted(el, binding, vnode) {
      const opts = (() => {
        if (typeof binding.value === 'string') {
          return { content: binding.value };
        }
        return binding.value || {};
      })();

      const modifiers = Object.keys(binding.modifiers || {});
      const placement = modifiers.find((modifier) => modifier !== 'arrow');
      const withArrow = modifiers.includes('arrow');

      if (placement) {
        opts.placement = opts.placement || placement;
      }

      if (withArrow) {
        if (opts.arrow === undefined) {
          opts.arrow = true;
        } else {
          opts.arrow = opts.arrow;
        }
      }

      if (vnode.props && vnode.props.onTippyShow) {
        opts.onShow = function (...args: any[]) {
          return vnode.props?.onTippyShow(...args);
        };
      }

      if (vnode.props && vnode.props.onTippyShown) {
        opts.onShown = function (...args: any[]) {
          return vnode.props?.onTippyShown(...args);
        };
      }

      if (vnode.props && vnode.props.onTippyHidden) {
        opts.onHidden = function (...args: any[]) {
          return vnode.props?.onTippyHidden(...args);
        };
      }

      if (vnode.props && vnode.props.onTippyHide) {
        opts.onHide = function (...args: any[]) {
          return vnode.props?.onTippyHide(...args);
        };
      }

      if (vnode.props && vnode.props.onTippyMount) {
        opts.onMount = function (...args: any[]) {
          return vnode.props?.onTippyMount(...args);
        };
      }

      if (el.getAttribute('title') && !opts.content) {
        opts.content = el.getAttribute('title');
        el.removeAttribute('title');
      }

      if (el.getAttribute('content') && !opts.content) {
        opts.content = el.getAttribute('content');
      }

      useTippy(el, opts);
    },
    unmounted(el) {
      if (el.$tippy) {
        el.$tippy.destroy();
      } else if (el._tippy) {
        el._tippy.destroy();
      }
    },

    updated(el, binding) {
      const opts = (() => {
        if (typeof binding.value === 'string') {
          return {
            content: binding.value,
            theme: (() => {
              if (isDark.value) {
                return '';
              }
              return 'light';
            })(),
          };
        }
        return Object.assign(
          {
            theme: (() => {
              if (isDark.value) {
                return '';
              }
              return 'light';
            })(),
          },
          binding.value,
        );
      })();

      if (el.getAttribute('title') && !opts.content) {
        opts.content = el.getAttribute('title');
        el.removeAttribute('title');
      }

      if (el.getAttribute('content') && !opts.content) {
        opts.content = el.getAttribute('content');
      }

      if (el.$tippy) {
        el.$tippy.setProps(opts || {});
      } else if (el._tippy) {
        el._tippy.setProps(opts || {});
      }
    },
  };
  return directive;
}
