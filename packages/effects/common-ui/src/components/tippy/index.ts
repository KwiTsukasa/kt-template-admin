import type { DefaultProps, Props } from 'tippy.js';

import type { App, SetupContext } from 'vue';

import { h, watchEffect } from 'vue';
import { setDefaultProps, Tippy as TippyComponent } from 'vue-tippy';

import { usePreferences } from '@vben-core/preferences';

import useTippyDirective from './directive';

import 'tippy.js/dist/tippy.css';
import 'tippy.js/dist/backdrop.css';
import 'tippy.js/themes/light.css';
import 'tippy.js/animations/scale.css';
import 'tippy.js/animations/shift-toward.css';
import 'tippy.js/animations/shift-away.css';
import 'tippy.js/animations/perspective.css';

const { isDark } = usePreferences();
export type TippyProps = Partial<
  Props & {
    animation?:
      | 'fade'
      | 'perspective'
      | 'scale'
      | 'shift-away'
      | 'shift-toward'
      | boolean;
    theme?: 'auto' | 'dark' | 'light';
  }
>;

/**
 * 注册带明暗主题联动的 Tippy 默认配置和 Vue 指令，并让显式主题覆盖自动切换。
 *
 * @param app - 要安装 Tippy Vue 插件与指令的应用实例。
 * @param options - Tippy 默认属性以及随明暗主题切换的主题名。
 */
export function initTippy(app: App<Element>, options?: DefaultProps) {
  setDefaultProps({
    allowHTML: true,
    delay: [500, 200],
    theme: (() => {
      if (isDark.value) {
        return '';
      }
      return 'light';
    })(),
    ...options,
  });
  if (!options || !Reflect.has(options, 'theme') || options.theme === 'auto') {
    watchEffect(() => {
      setDefaultProps({
        theme: (() => {
          if (isDark.value) {
            return '';
          }
          return 'light';
        })(),
      });
    });
  }

  app.directive('tippy', useTippyDirective(isDark));
}

export const Tippy = (props: any, { attrs, slots }: SetupContext) => {
  let theme: string = (attrs.theme as string) ?? 'auto';
  if (theme === 'auto') {
    if (isDark.value) {
      theme = '';
    } else {
      theme = 'light';
    }
  }
  if (theme === 'dark') {
    theme = '';
  }
  return h(
    TippyComponent,
    {
      ...props,
      ...attrs,
      theme,
    },
    slots,
  );
};
