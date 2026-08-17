import { computed } from 'vue';

import { diff } from '@vben-core/shared/utils';

import { preferencesManager } from './preferences';
import { isDarkTheme } from './update-css-variables';

/**
 * 把全局偏好投影为主题、布局、快捷键和按钮位置等响应式派生状态。
 *
 * @returns 主题、布局、快捷键、侧栏和偏好按钮位置等只读派生状态集合。
 */
function usePreferences() {
  const preferences = preferencesManager.getPreferences();
  const initialPreferences = preferencesManager.getInitialPreferences();
  const diffPreference = computed(() => {
    return diff(initialPreferences, preferences);
  });

  const appPreferences = computed(() => preferences.app);

  const shortcutKeysPreferences = computed(() => preferences.shortcutKeys);

  const isDark = computed(() => {
    return isDarkTheme(preferences.theme.mode);
  });

  const locale = computed(() => {
    return preferences.app.locale;
  });

  const isMobile = computed(() => {
    return appPreferences.value.isMobile;
  });

  const theme = computed(() => {
    if (isDark.value) {
      return 'dark';
    }
    return 'light';
  });

  const layout = computed(() => {
    if (isMobile.value) {
      return 'sidebar-nav';
    }
    return appPreferences.value.layout;
  });

  const isShowHeaderNav = computed(() => {
    return preferences.header.enable;
  });

  const isFullContent = computed(
    () => appPreferences.value.layout === 'full-content',
  );

  const isSideNav = computed(
    () => appPreferences.value.layout === 'sidebar-nav',
  );

  const isSideMixedNav = computed(
    () => appPreferences.value.layout === 'sidebar-mixed-nav',
  );

  const isHeaderNav = computed(
    () => appPreferences.value.layout === 'header-nav',
  );

  const isHeaderMixedNav = computed(
    () => appPreferences.value.layout === 'header-mixed-nav',
  );

  const isHeaderSidebarNav = computed(
    () => appPreferences.value.layout === 'header-sidebar-nav',
  );

  const isMixedNav = computed(
    () => appPreferences.value.layout === 'mixed-nav',
  );

  const isSideMode = computed(() => {
    return (
      isMixedNav.value ||
      isSideMixedNav.value ||
      isSideNav.value ||
      isHeaderMixedNav.value ||
      isHeaderSidebarNav.value
    );
  });

  const sidebarCollapsed = computed(() => {
    return preferences.sidebar.collapsed;
  });

  const keepAlive = computed(
    () => preferences.tabbar.enable && preferences.tabbar.keepAlive,
  );

  const authPanelLeft = computed(() => {
    return appPreferences.value.authPageLayout === 'panel-left';
  });

  const authPanelRight = computed(() => {
    return appPreferences.value.authPageLayout === 'panel-right';
  });

  const authPanelCenter = computed(() => {
    return appPreferences.value.authPageLayout === 'panel-center';
  });

  const contentIsMaximize = computed(() => {
    const headerIsHidden = preferences.header.hidden;
    const sidebarIsHidden = preferences.sidebar.hidden;
    return headerIsHidden && sidebarIsHidden && !isFullContent.value;
  });

  const globalSearchShortcutKey = computed(() => {
    const { enable, globalSearch } = shortcutKeysPreferences.value;
    return enable && globalSearch;
  });

  const globalLogoutShortcutKey = computed(() => {
    const { enable, globalLogout } = shortcutKeysPreferences.value;
    return enable && globalLogout;
  });

  const globalLockScreenShortcutKey = computed(() => {
    const { enable, globalLockScreen } = shortcutKeysPreferences.value;
    return enable && globalLockScreen;
  });

  const preferencesButtonPosition = computed(() => {
    const { enablePreferences, preferencesButtonPosition } = preferences.app;

    // 如果没有启用偏好设置按钮
    if (!enablePreferences) {
      return {
        fixed: false,
        header: false,
      };
    }

    const { header, sidebar } = preferences;
    const headerHidden = header.hidden;
    const sidebarHidden = sidebar.hidden;

    const contentIsMaximize = headerHidden && sidebarHidden;

    const isHeaderPosition = preferencesButtonPosition === 'header';

    // 如果设置了固定位置
    if (preferencesButtonPosition !== 'auto') {
      return {
        fixed: preferencesButtonPosition === 'fixed',
        header: isHeaderPosition,
      };
    }

    // 如果是全屏模式或者没有固定在顶部，
    const fixed =
      contentIsMaximize ||
      isFullContent.value ||
      isMobile.value ||
      !isShowHeaderNav.value;

    return {
      fixed,
      header: !fixed,
    };
  });

  return {
    authPanelCenter,
    authPanelLeft,
    authPanelRight,
    contentIsMaximize,
    diffPreference,
    globalLockScreenShortcutKey,
    globalLogoutShortcutKey,
    globalSearchShortcutKey,
    isDark,
    isFullContent,
    isHeaderMixedNav,
    isHeaderNav,
    isHeaderSidebarNav,
    isMixedNav,
    isMobile,
    isSideMixedNav,
    isSideMode,
    isSideNav,
    keepAlive,
    layout,
    locale,
    preferencesButtonPosition,
    sidebarCollapsed,
    theme,
  };
}

export { usePreferences };
