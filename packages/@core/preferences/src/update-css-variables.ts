import type { Preferences } from './types';

import { generatorColorVariables } from '@vben-core/shared/color';
import { updateCSSVariables as executeUpdateCSSVariables } from '@vben-core/shared/utils';

import { BUILT_IN_THEME_PRESETS } from './constants';

/**
 * 根据当前偏好生成主题、圆角、字体与布局 CSS 变量并写入页面。
 *
 * @param preferences - 要投影到根元素类名、属性和 CSS 变量的完整偏好设置。
 */
function updateCSSVariables(preferences: Preferences) {
  // 当修改到颜色变量时，更新 css 变量
  const root = document.documentElement;
  if (!root) {
    return;
  }

  const theme = preferences?.theme ?? {};

  const { builtinType, mode, radius } = theme;

  // html 设置 dark 类
  if (Reflect.has(theme, 'mode')) {
    const dark = isDarkTheme(mode);
    root.classList.toggle('dark', dark);
  }

  // html 设置 data-theme=[builtinType]
  if (Reflect.has(theme, 'builtinType')) {
    const rootTheme = root.dataset.theme;
    if (rootTheme !== builtinType) {
      root.dataset.theme = builtinType;
    }
  }

  // 获取当前的内置主题
  const currentBuiltType = [...BUILT_IN_THEME_PRESETS].find(
    (item) => item.type === builtinType,
  );

  let builtinTypeColorPrimary: string | undefined = '';

  if (currentBuiltType) {
    const isDark = isDarkTheme(preferences.theme.mode);
    // 设置不同主题的主要颜色
    const color = (() => {
      if (isDark) {
        return (
          currentBuiltType.darkPrimaryColor || currentBuiltType.primaryColor
        );
      }
      return currentBuiltType.primaryColor;
    })();
    builtinTypeColorPrimary = color || currentBuiltType.color;
  }

  // 如果内置主题颜色和自定义颜色都不存在，则不更新主题颜色
  if (
    builtinTypeColorPrimary ||
    Reflect.has(theme, 'colorPrimary') ||
    Reflect.has(theme, 'colorDestructive') ||
    Reflect.has(theme, 'colorSuccess') ||
    Reflect.has(theme, 'colorWarning')
  ) {
    // preferences.theme.colorPrimary = builtinTypeColorPrimary || colorPrimary;
    updateMainColorVariables(preferences);
  }

  // 更新圆角
  if (Reflect.has(theme, 'radius')) {
    document.documentElement.style.setProperty('--radius', `${radius}rem`);
  }

  // 更新字体大小
  if (Reflect.has(theme, 'fontSize')) {
    const fontSize = theme.fontSize;
    document.documentElement.style.setProperty(
      '--font-size-base',
      `${fontSize}px`,
    );
    document.documentElement.style.setProperty(
      '--menu-font-size',
      `calc(${fontSize}px * 0.875)`,
    );
  }
}

/**
 * 根据主题色偏好生成主色阶 CSS 变量。
 *
 * @param preference - 提供主色、成功色、警告色与破坏性色的完整偏好设置。
 */
function updateMainColorVariables(preference: Preferences) {
  if (!preference.theme) {
    return;
  }
  const { colorDestructive, colorPrimary, colorSuccess, colorWarning } =
    preference.theme;

  const colorVariables = generatorColorVariables([
    { color: colorPrimary, name: 'primary' },
    { alias: 'warning', color: colorWarning, name: 'yellow' },
    { alias: 'success', color: colorSuccess, name: 'green' },
    { alias: 'destructive', color: colorDestructive, name: 'red' },
  ]);

  // 要设置的 CSS 变量映射
  const colorMappings = {
    '--green-500': '--success',
    '--primary-500': '--primary',
    '--red-500': '--destructive',
    '--yellow-500': '--warning',
  };

  // 统一处理颜色变量的更新
  Object.entries(colorMappings).forEach(([sourceVar, targetVar]) => {
    const colorValue = colorVariables[sourceVar];
    if (colorValue) {
      document.documentElement.style.setProperty(targetVar, colorValue);
    }
  });

  executeUpdateCSSVariables(colorVariables);
}

/**
 * 根据主题名称和系统偏好判断当前是否应使用深色配色。
 *
 * @param theme - 需要转换为 CSS 变量或应用到界面的主题配置。
 * @returns 显式深色主题或跟随系统且系统偏好深色时返回 true，否则返回 false。
 */
function isDarkTheme(theme: string) {
  let dark = theme === 'dark';
  if (theme === 'auto') {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return dark;
}

export { isDarkTheme, updateCSSVariables };
