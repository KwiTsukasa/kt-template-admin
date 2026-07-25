type LayoutType =
  | 'full-content'
  | 'header-mixed-nav'
  | 'header-nav'
  | 'header-sidebar-nav'
  | 'mixed-nav'
  | 'sidebar-mixed-nav'
  | 'sidebar-nav';

type ThemeModeType = 'auto' | 'dark' | 'light';

type PreferencesButtonPositionType = 'auto' | 'fixed' | 'header';

type BuiltinThemeType =
  | 'custom'
  | 'deep-blue'
  | 'deep-green'
  | 'default'
  | 'gray'
  | 'green'
  | 'neutral'
  | 'orange'
  | 'pink'
  | 'red'
  | 'rose'
  | 'sky-blue'
  | 'slate'
  | 'stone'
  | 'violet'
  | 'yellow'
  | 'zinc'
  | (Record<never, never> & string);

type ContentCompactType = 'compact' | 'wide';

type LayoutHeaderModeType = 'auto' | 'auto-scroll' | 'fixed' | 'static';
type LayoutHeaderMenuAlignType = 'center' | 'end' | 'start';

type LoginExpiredModeType = 'modal' | 'page';

type BreadcrumbStyleType = 'background' | 'normal';

type AccessModeType = 'backend' | 'frontend' | 'mixed';

type NavigationStyleType = 'plain' | 'rounded';

type TabsStyleType = 'brisk' | 'card' | 'chrome' | 'plain';

type PageTransitionType = 'fade' | 'fade-down' | 'fade-slide' | 'fade-up';

type AuthPageLayoutType = 'panel-center' | 'panel-left' | 'panel-right';

interface TimezoneOption {
  label: string;
  offset: number;
  timezone: string;
}

export type {
  AccessModeType,
  AuthPageLayoutType,
  BreadcrumbStyleType,
  BuiltinThemeType,
  ContentCompactType,
  LayoutHeaderMenuAlignType,
  LayoutHeaderModeType,
  LayoutType,
  LoginExpiredModeType,
  NavigationStyleType,
  PageTransitionType,
  PreferencesButtonPositionType,
  TabsStyleType,
  ThemeModeType,
  TimezoneOption,
};
