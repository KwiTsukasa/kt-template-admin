import type { Locale } from 'antdv-next/dist/locale/index';

import type { App } from 'vue';

import type { LocaleSetupOptions, SupportedLanguagesType } from '@vben/locales';

import { ref } from 'vue';

import {
  $t,
  setupI18n as coreSetup,
  loadLocalesMapFromDir,
} from '@vben/locales';
import { preferences } from '@vben/preferences';

import antdEnLocale from 'antdv-next/dist/locale/en_US';
import antdDefaultLocale from 'antdv-next/dist/locale/zh_CN';
import dayjs from 'dayjs';

const antdLocale = ref<Locale>(antdDefaultLocale);

const modules = import.meta.glob('./langs/**/*.json');

const localesMap = loadLocalesMapFromDir(
  /\.\/langs\/([^/]+)\/(.*)\.json$/,
  modules,
);
/**
 * 并行加载指定语言的应用消息与第三方本地化资源；应用消息缺失时返回 undefined。
 *
 * @param lang - 需要动态加载并设为当前值的语言代码。
 * @returns 当前语言的应用消息、第三方语言包和日期本地化配置。
 */
async function loadMessages(lang: SupportedLanguagesType) {
  const [appLocaleMessages] = await Promise.all([
    localesMap[lang]?.(),
    loadThirdPartyMessage(lang),
  ]);
  return appLocaleMessages?.default;
}

/**
 * 根据语言代码并行加载 Vue、Antdv 与 VXE Table 的本地化资源。
 *
 * @param lang - 需要动态加载并设为当前值的语言代码。
 */
async function loadThirdPartyMessage(lang: SupportedLanguagesType) {
  await Promise.all([loadAntdLocale(lang), loadDayjsLocale(lang)]);
}

/**
 * 根据语言代码动态加载 Day.js 本地化包，并切换全局 locale。
 *
 * @param lang - 需要动态加载并设为当前值的语言代码。
 */
async function loadDayjsLocale(lang: SupportedLanguagesType) {
  let locale;
  switch (lang) {
    case 'en-US': {
      locale = await import('dayjs/locale/en');
      break;
    }
    case 'zh-CN': {
      locale = await import('dayjs/locale/zh-cn');
      break;
    }
    // 默认使用英语
    default: {
      locale = await import('dayjs/locale/en');
    }
  }
  if (locale) {
    dayjs.locale(locale);
  } else {
    console.error(`Failed to load dayjs locale for ${lang}`);
  }
}

/**
 * 根据语言代码动态加载 Ant Design Vue 本地化包。
 *
 * @param lang - 需要动态加载并设为当前值的语言代码。
 */
async function loadAntdLocale(lang: SupportedLanguagesType) {
  switch (lang) {
    case 'en-US': {
      antdLocale.value = antdEnLocale;
      break;
    }
    case 'zh-CN': {
      antdLocale.value = antdDefaultLocale;
      break;
    }
  }
}

/**
 * 用应用偏好语言初始化核心国际化，并在开发环境保留缺失翻译警告。
 *
 * @param app - 要安装核心 i18n 插件的 Vue 应用实例。
 * @param options - 覆盖默认语言、消息加载器和缺失翻译警告的国际化选项；省略时使用应用偏好语言。
 */
async function setupI18n(app: App, options: LocaleSetupOptions = {}) {
  await coreSetup(app, {
    defaultLocale: preferences.app.locale,
    loadMessages,
    missingWarn: !import.meta.env.PROD,
    ...options,
  });
}

export { $t, antdLocale, setupI18n };
