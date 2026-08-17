import type {
  ApplicationConfig,
  VbenAdminProAppConfigRaw,
} from '@vben/types/global';

/**
 * 根据生产模式合并 Vite 注入配置与开发默认值，并返回只读应用配置。
 *
 * @param env - Vite 解析后的环境变量，用于读取应用运行配置。
 * @param isProduction - 是否按生产环境读取注入配置。
 * @returns 只读的应用运行配置引用。
 */
export function useAppConfig(
  env: Record<string, any>,
  isProduction: boolean,
): ApplicationConfig {
  // 生产环境下，直接使用 window._VBEN_ADMIN_PRO_APP_CONF_ 全局变量
  const config = (() => {
    if (isProduction) {
      return window._VBEN_ADMIN_PRO_APP_CONF_;
    }
    return env as VbenAdminProAppConfigRaw;
  })();

  const {
    VITE_GLOB_API_URL,
    VITE_GLOB_AUTH_DINGDING_CORP_ID,
    VITE_GLOB_AUTH_DINGDING_CLIENT_ID,
  } = config;

  const applicationConfig: ApplicationConfig = {
    apiURL: VITE_GLOB_API_URL,
    auth: {},
  };
  if (VITE_GLOB_AUTH_DINGDING_CORP_ID && VITE_GLOB_AUTH_DINGDING_CLIENT_ID) {
    applicationConfig.auth.dingding = {
      clientId: VITE_GLOB_AUTH_DINGDING_CLIENT_ID,
      corpId: VITE_GLOB_AUTH_DINGDING_CORP_ID,
    };
  }

  return applicationConfig;
}
