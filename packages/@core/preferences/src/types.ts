import type {
  AccessModeType,
  AuthPageLayoutType,
  BreadcrumbStyleType,
  BuiltinThemeType,
  ContentCompactType,
  DeepPartial,
  LayoutHeaderMenuAlignType,
  LayoutHeaderModeType,
  LayoutType,
  LoginExpiredModeType,
  NavigationStyleType,
  PageTransitionType,
  PreferencesButtonPositionType,
  TabsStyleType,
  ThemeModeType,
} from '@vben-core/typings';

type SupportedLanguagesType = 'en-US' | 'zh-CN';

interface AppPreferences {
  accessMode: AccessModeType;
  authPageLayout: AuthPageLayoutType;
  checkUpdatesInterval: number;
  colorGrayMode: boolean;
  colorWeakMode: boolean;
  compact: boolean;
  contentCompact: ContentCompactType;
  contentCompactWidth: number;
  contentPadding: number;
  contentPaddingBottom: number;
  contentPaddingLeft: number;
  contentPaddingRight: number;
  contentPaddingTop: number;
  // /** 应用默认头像 */
  defaultAvatar: string;
  defaultHomePath: string;
  // /** 开启动态标题 */
  dynamicTitle: boolean;
  enableCheckUpdates: boolean;
  enablePreferences: boolean;
  enableRefreshToken: boolean;
  enableStickyPreferencesNavigationBar: boolean;
  isMobile: boolean;
  layout: LayoutType;
  locale: SupportedLanguagesType;
  loginExpiredMode: LoginExpiredModeType;
  name: string;
  preferencesButtonPosition: PreferencesButtonPositionType;
  watermark: boolean;
  watermarkContent: string;
  zIndex: number;
}

interface BreadcrumbPreferences {
  enable: boolean;
  hideOnlyOne: boolean;
  showHome: boolean;
  showIcon: boolean;
  styleType: BreadcrumbStyleType;
}

interface CopyrightPreferences {
  companyName: string;
  companySiteLink: string;
  date: string;
  enable: boolean;
  icp: string;
  icpLink: string;
  settingShow?: boolean;
}

interface FooterPreferences {
  enable: boolean;
  fixed: boolean;
  height: number;
}

interface HeaderPreferences {
  enable: boolean;
  height: number;
  hidden: boolean;
  menuAlign: LayoutHeaderMenuAlignType;
  mode: LayoutHeaderModeType;
}

interface LogoPreferences {
  enable: boolean;
  fit: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  source: string;
  sourceDark?: string;
}

interface NavigationPreferences {
  accordion: boolean;
  split: boolean;
  styleType: NavigationStyleType;
}

interface SidebarPreferences {
  autoActivateChild: boolean;
  collapsed: boolean;
  collapsedButton: boolean;
  collapsedShowTitle: boolean;
  collapseWidth: number;
  enable: boolean;
  expandOnHover: boolean;
  extraCollapse: boolean;
  extraCollapsedWidth: number;
  fixedButton: boolean;
  hidden: boolean;
  mixedWidth: number;
  width: number;
}

interface ShortcutKeyPreferences {
  enable: boolean;
  globalLockScreen: boolean;
  globalLogout: boolean;
  globalPreferences: boolean;
  globalSearch: boolean;
}

interface TabbarPreferences {
  draggable: boolean;
  enable: boolean;
  height: number;
  keepAlive: boolean;
  maxCount: number;
  middleClickToClose: boolean;
  persist: boolean;
  showIcon: boolean;
  showMaximize: boolean;
  showMore: boolean;
  styleType: TabsStyleType;
  visitHistory: boolean;
  wheelable: boolean;
}

interface ThemePreferences {
  builtinType: BuiltinThemeType;
  colorDestructive: string;
  colorPrimary: string;
  colorSuccess: string;
  colorWarning: string;
  fontSize: number;
  mode: ThemeModeType;
  radius: string;
  semiDarkHeader: boolean;
  semiDarkSidebar: boolean;
}

interface TransitionPreferences {
  enable: boolean;
  // /** 是否开启页面加载loading */
  loading: boolean;
  name: PageTransitionType | string;
  progress: boolean;
}

interface WidgetPreferences {
  fullscreen: boolean;
  globalSearch: boolean;
  languageToggle: boolean;
  lockScreen: boolean;
  notification: boolean;
  refresh: boolean;
  sidebarToggle: boolean;
  themeToggle: boolean;
  timezone: boolean;
}

interface Preferences {
  app: AppPreferences;
  breadcrumb: BreadcrumbPreferences;
  copyright: CopyrightPreferences;
  footer: FooterPreferences;
  header: HeaderPreferences;
  logo: LogoPreferences;
  navigation: NavigationPreferences;
  shortcutKeys: ShortcutKeyPreferences;
  sidebar: SidebarPreferences;
  tabbar: TabbarPreferences;
  theme: ThemePreferences;
  transition: TransitionPreferences;
  widget: WidgetPreferences;
}

type PreferencesKeys = keyof Preferences;

interface InitialOptions {
  namespace: string;
  overrides?: DeepPartial<Preferences>;
}
export type {
  AppPreferences,
  BreadcrumbPreferences,
  FooterPreferences,
  HeaderPreferences,
  InitialOptions,
  LogoPreferences,
  NavigationPreferences,
  Preferences,
  PreferencesKeys,
  ShortcutKeyPreferences,
  SidebarPreferences,
  SupportedLanguagesType,
  TabbarPreferences,
  ThemePreferences,
  TransitionPreferences,
  WidgetPreferences,
};
