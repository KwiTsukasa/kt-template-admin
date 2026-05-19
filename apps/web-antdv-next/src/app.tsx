import { computed, defineComponent } from 'vue';
import { RouterView } from 'vue-router';

import { useAntdDesignTokens } from '@vben/hooks';
import { preferences, usePreferences } from '@vben/preferences';

import { App as AntdApp, ConfigProvider, theme } from 'antdv-next';

import { antdLocale } from '#/locales';

export default defineComponent({
  name: 'App',
  setup() {
    const { isDark } = usePreferences();
    const { components, tokens } = useAntdDesignTokens();

    const tokenTheme = computed(() => {
      const algorithm = isDark.value
        ? [theme.darkAlgorithm]
        : [theme.defaultAlgorithm];

      if (preferences.app.compact) {
        algorithm.push(theme.compactAlgorithm);
      }

      return {
        algorithm,
        components,
        token: tokens,
      };
    });

    return () => (
      <ConfigProvider locale={antdLocale.value} theme={tokenTheme.value}>
        <AntdApp>
          <RouterView />
        </AntdApp>
      </ConfigProvider>
    );
  },
});
