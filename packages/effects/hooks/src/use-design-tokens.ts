import { reactive, watch } from 'vue';

import { preferences, usePreferences } from '@vben/preferences';
import { convertToRgb, updateCSSVariables } from '@vben/utils';

/**
 * 将全局 CSS 主题变量映射为 Ant Design 响应式 token，并随偏好变化同步颜色与圆角。
 *
 * @returns 随主题变化的 Ant Design 颜色、间距与圆角 token。
 */

export function useAntdDesignTokens() {
  const tokens = reactive({
    borderRadius: '' as any,
    colorBgBase: '',
    colorBgContainer: '',
    colorBgElevated: '',
    colorBgLayout: '',
    colorBgMask: '',
    colorBorder: '',
    colorBorderSecondary: '',
    colorError: '',
    colorInfo: '',
    colorPrimary: '',
    colorSuccess: '',
    colorTextBase: '',
    colorWarning: '',
    zIndexPopupBase: 2000, // 调整基础弹层层级，避免下拉等组件被弹窗或者最大化状态下的表格遮挡
  });
  const formControlTokens = reactive({
    activeBorderColor: '',
    colorBgContainer: '',
    colorBorder: '',
    hoverBorderColor: '',
    lineWidth: 1,
  });
  const components = reactive({
    Cascader: formControlTokens,
    DatePicker: formControlTokens,
    Input: formControlTokens,
    InputNumber: formControlTokens,
    Select: formControlTokens,
    TreeSelect: formControlTokens,
  });

  const getCssVariableValue = (variable: string, isColor: boolean = true) => {
    const rootStyles = getComputedStyle(document.documentElement);
    const value = rootStyles.getPropertyValue(variable);
    if (isColor) {
      return `hsl(${value})`;
    }
    return value;
  };

  const getCssVariableValueWithFallback = (
    variable: string,
    fallback: string,
    isColor: boolean = true,
  ) => {
    const value = getCssVariableValue(variable, isColor).trim();
    if (
      value ===
      (() => {
        if (isColor) {
          return 'hsl()';
        }
        return '';
      })()
    ) {
      return fallback;
    }
    return value;
  };

  const syncTokens = () => {
    tokens.colorPrimary = getCssVariableValue('--primary');

    tokens.colorInfo = getCssVariableValue('--primary');

    tokens.colorError = getCssVariableValue('--destructive');

    tokens.colorWarning = getCssVariableValue('--warning');

    tokens.colorSuccess = getCssVariableValue('--success');

    tokens.colorTextBase = getCssVariableValue('--foreground');

    getCssVariableValue('--primary-foreground');

    tokens.colorBorderSecondary = tokens.colorBorder =
      getCssVariableValue('--border');

    tokens.colorBgElevated = getCssVariableValue('--popover');

    tokens.colorBgContainer = getCssVariableValue('--card');

    tokens.colorBgBase = getCssVariableValue('--background');

    const radius = Number.parseFloat(getCssVariableValue('--radius', false));
    // 1rem = 16px
    if (Number.isFinite(radius)) {
      tokens.borderRadius = radius * 16;
    } else {
      tokens.borderRadius = 8;
    }

    tokens.colorBgLayout = getCssVariableValue('--background-deep');
    tokens.colorBgMask = getCssVariableValue('--overlay');

    // 表单类组件单独走输入框变量，避免深色模式下输入框与卡片背景粘在一起。
    formControlTokens.colorBgContainer = getCssVariableValueWithFallback(
      '--input-background',
      tokens.colorBgContainer,
    );
    formControlTokens.colorBorder = getCssVariableValueWithFallback(
      '--input',
      tokens.colorBorder,
    );
    formControlTokens.activeBorderColor = tokens.colorPrimary;
    formControlTokens.hoverBorderColor = getCssVariableValueWithFallback(
      '--accent-hover',
      tokens.colorPrimary,
    );
  };

  watch(() => preferences.theme, syncTokens, {
    deep: true,
    flush: 'post',
    immediate: true,
  });

  return {
    components,
    tokens,
  };
}

/**
 * 把 Naive UI 主题色与状态色转换为设计令牌，未传颜色时沿用组件库默认值。
 *
 * @returns Naive UI 主色与状态色对应的响应式设计令牌。
 */
export function useNaiveDesignTokens() {
  const rootStyles = getComputedStyle(document.documentElement);

  const commonTokens = reactive({
    baseColor: '',
    bodyColor: '',
    borderColor: '',
    borderRadius: '',
    cardColor: '',
    dividerColor: '',
    errorColor: '',
    errorColorHover: '',
    errorColorPressed: '',
    errorColorSuppl: '',
    invertedColor: '',
    modalColor: '',
    popoverColor: '',
    primaryColor: '',
    primaryColorHover: '',
    primaryColorPressed: '',
    primaryColorSuppl: '',
    successColor: '',
    successColorHover: '',
    successColorPressed: '',
    successColorSuppl: '',
    tableColor: '',
    textColorBase: '',
    warningColor: '',
    warningColorHover: '',
    warningColorPressed: '',
    warningColorSuppl: '',
  });

  const getCssVariableValue = (variable: string, isColor: boolean = true) => {
    const value = rootStyles.getPropertyValue(variable);
    if (isColor) {
      return convertToRgb(`hsl(${value})`);
    }
    return value;
  };

  watch(
    () => preferences.theme,
    () => {
      commonTokens.primaryColor = getCssVariableValue('--primary');
      commonTokens.primaryColorHover = getCssVariableValue('--primary-600');
      commonTokens.primaryColorPressed = getCssVariableValue('--primary-700');
      commonTokens.primaryColorSuppl = getCssVariableValue('--primary-800');

      commonTokens.errorColor = getCssVariableValue('--destructive');
      commonTokens.errorColorHover = getCssVariableValue('--destructive-600');
      commonTokens.errorColorPressed = getCssVariableValue('--destructive-700');
      commonTokens.errorColorSuppl = getCssVariableValue('--destructive-800');

      commonTokens.warningColor = getCssVariableValue('--warning');
      commonTokens.warningColorHover = getCssVariableValue('--warning-600');
      commonTokens.warningColorPressed = getCssVariableValue('--warning-700');
      commonTokens.warningColorSuppl = getCssVariableValue('--warning-800');

      commonTokens.successColor = getCssVariableValue('--success');
      commonTokens.successColorHover = getCssVariableValue('--success-600');
      commonTokens.successColorPressed = getCssVariableValue('--success-700');
      commonTokens.successColorSuppl = getCssVariableValue('--success-800');

      commonTokens.textColorBase = getCssVariableValue('--foreground');

      commonTokens.baseColor = getCssVariableValue('--primary-foreground');

      commonTokens.dividerColor = commonTokens.borderColor =
        getCssVariableValue('--border');

      commonTokens.modalColor = commonTokens.popoverColor =
        getCssVariableValue('--popover');

      commonTokens.tableColor = commonTokens.cardColor =
        getCssVariableValue('--card');

      commonTokens.bodyColor = getCssVariableValue('--background');
      commonTokens.invertedColor = getCssVariableValue('--background-deep');

      commonTokens.borderRadius = getCssVariableValue('--radius', false);
    },
    { immediate: true },
  );
  return {
    commonTokens,
  };
}

/**
 * 把 Element Plus 主题色与状态色转换为设计令牌，未传颜色时沿用组件库默认值。
 */
export function useElementPlusDesignTokens() {
  const { isDark } = usePreferences();
  const rootStyles = getComputedStyle(document.documentElement);

  const getCssVariableValueRaw = (variable: string) => {
    return rootStyles.getPropertyValue(variable);
  };

  const getCssVariableValue = (variable: string, isColor: boolean = true) => {
    const value = getCssVariableValueRaw(variable);
    if (isColor) {
      return convertToRgb(`hsl(${value})`);
    }
    return value;
  };

  watch(
    () => preferences.theme,
    () => {
      const background = getCssVariableValue('--background');
      const border = getCssVariableValue('--border');
      const accent = getCssVariableValue('--accent');

      const variables: Record<string, string> = {
        '--el-bg-color': background,
        '--el-bg-color-overlay': getCssVariableValue('--popover'),
        '--el-bg-color-page': getCssVariableValue('--background-deep'),
        '--el-border-color': border,
        '--el-border-color-dark': border,
        '--el-border-color-extra-light': border,
        '--el-border-color-hover': accent,
        '--el-border-color-light': border,
        '--el-border-color-lighter': border,

        '--el-border-radius-base': getCssVariableValue('--radius', false),
        '--el-color-danger': getCssVariableValue('--destructive-500'),
        '--el-color-danger-dark-2': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-400');
          }
          return getCssVariableValue('--destructive-600');
        })(),
        '--el-color-danger-light-3': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-600');
          }
          return getCssVariableValue('--destructive-400');
        })(),
        '--el-color-danger-light-5': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-700');
          }
          return getCssVariableValue('--destructive-300');
        })(),
        '--el-color-danger-light-7': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-800');
          }
          return getCssVariableValue('--destructive-200');
        })(),
        '--el-color-danger-light-8': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-900');
          }
          return getCssVariableValue('--destructive-100');
        })(),
        '--el-color-danger-light-9': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-950');
          }
          return getCssVariableValue('--destructive-50');
        })(),

        '--el-color-error': getCssVariableValue('--destructive-500'),
        '--el-color-error-dark-2': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-400');
          }
          return getCssVariableValue('--destructive-600');
        })(),
        '--el-color-error-light-3': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-600');
          }
          return getCssVariableValue('--destructive-400');
        })(),
        '--el-color-error-light-5': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-700');
          }
          return getCssVariableValue('--destructive-300');
        })(),
        '--el-color-error-light-7': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-800');
          }
          return getCssVariableValue('--destructive-200');
        })(),
        '--el-color-error-light-8': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-900');
          }
          return getCssVariableValue('--destructive-100');
        })(),
        '--el-color-error-light-9': (() => {
          if (isDark.value) {
            return getCssVariableValue('--destructive-950');
          }
          return getCssVariableValue('--destructive-50');
        })(),

        '--el-color-info-light-5': border,
        '--el-color-info-light-8': border,
        '--el-color-info-light-9': getCssVariableValue('--info'), // getCssVariableValue('--secondary'),

        '--el-color-primary': getCssVariableValue('--primary-500'),
        '--el-color-primary-dark-2': (() => {
          if (isDark.value) {
            return getCssVariableValue('--primary-400');
          }
          return getCssVariableValue('--primary-600');
        })(),
        '--el-color-primary-light-3': (() => {
          if (isDark.value) {
            return getCssVariableValue('--primary-600');
          }
          return getCssVariableValue('--primary-400');
        })(),
        '--el-color-primary-light-5': (() => {
          if (isDark.value) {
            return getCssVariableValue('--primary-700');
          }
          return getCssVariableValue('--primary-300');
        })(),
        '--el-color-primary-light-7': (() => {
          if (isDark.value) {
            return getCssVariableValue('--primary-800');
          }
          return getCssVariableValue('--primary-200');
        })(),
        '--el-color-primary-light-8': (() => {
          if (isDark.value) {
            return getCssVariableValue('--primary-900');
          }
          return getCssVariableValue('--primary-100');
        })(),
        '--el-color-primary-light-9': (() => {
          if (isDark.value) {
            return getCssVariableValue('--primary-950');
          }
          return getCssVariableValue('--primary-50');
        })(),

        '--el-color-success': getCssVariableValue('--success-500'),
        '--el-color-success-dark-2': (() => {
          if (isDark.value) {
            return getCssVariableValue('--success-400');
          }
          return getCssVariableValue('--success-600');
        })(),
        '--el-color-success-light-3': (() => {
          if (isDark.value) {
            return getCssVariableValue('--success-600');
          }
          return getCssVariableValue('--success-400');
        })(),
        '--el-color-success-light-5': (() => {
          if (isDark.value) {
            return getCssVariableValue('--success-700');
          }
          return getCssVariableValue('--success-300');
        })(),
        '--el-color-success-light-7': (() => {
          if (isDark.value) {
            return getCssVariableValue('--success-800');
          }
          return getCssVariableValue('--success-200');
        })(),
        '--el-color-success-light-8': (() => {
          if (isDark.value) {
            return getCssVariableValue('--success-900');
          }
          return getCssVariableValue('--success-100');
        })(),
        '--el-color-success-light-9': (() => {
          if (isDark.value) {
            return getCssVariableValue('--success-950');
          }
          return getCssVariableValue('--success-50');
        })(),

        '--el-color-warning': getCssVariableValue('--warning-500'),
        '--el-color-warning-dark-2': (() => {
          if (isDark.value) {
            return getCssVariableValue('--warning-400');
          }
          return getCssVariableValue('--warning-600');
        })(),
        '--el-color-warning-light-3': (() => {
          if (isDark.value) {
            return getCssVariableValue('--warning-600');
          }
          return getCssVariableValue('--warning-400');
        })(),
        '--el-color-warning-light-5': (() => {
          if (isDark.value) {
            return getCssVariableValue('--warning-700');
          }
          return getCssVariableValue('--warning-300');
        })(),
        '--el-color-warning-light-7': (() => {
          if (isDark.value) {
            return getCssVariableValue('--warning-800');
          }
          return getCssVariableValue('--warning-200');
        })(),
        '--el-color-warning-light-8': (() => {
          if (isDark.value) {
            return getCssVariableValue('--warning-900');
          }
          return getCssVariableValue('--warning-100');
        })(),
        '--el-color-warning-light-9': (() => {
          if (isDark.value) {
            return getCssVariableValue('--warning-950');
          }
          return getCssVariableValue('--warning-50');
        })(),

        '--el-fill-color': getCssVariableValue('--accent'),
        '--el-fill-color-blank': background,
        '--el-fill-color-light': getCssVariableValue('--accent'),
        '--el-fill-color-lighter': getCssVariableValue('--accent-lighter'),

        '--el-fill-color-dark': getCssVariableValue('--accent-dark'),
        '--el-fill-color-darker': getCssVariableValue('--accent-darker'),

        // 解决ElLoading背景色问题
        '--el-mask-color': (() => {
          if (isDark.value) {
            return 'rgba(0,0,0,.8)';
          }
          return 'rgba(255,255,255,.9)';
        })(),

        '--el-text-color-primary': getCssVariableValue('--foreground'),

        '--el-text-color-regular': getCssVariableValue('--foreground'),
      };

      updateCSSVariables(variables, `__vben_design_styles__`);
    },
    { immediate: true },
  );
}
