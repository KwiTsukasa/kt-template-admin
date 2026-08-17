import type { PluginOption } from 'vite';

import type {
  ApplicationPluginOptions,
  CommonPluginOptions,
  ConditionPlugin,
  LibraryPluginOptions,
} from '../typing';

import viteVueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
import viteVue from '@vitejs/plugin-vue';
import viteVueJsx from '@vitejs/plugin-vue-jsx';
import { visualizer as viteVisualizerPlugin } from 'rollup-plugin-visualizer';
import viteCompressPlugin from 'vite-plugin-compression';
import viteDtsPlugin from 'vite-plugin-dts';
import { createHtmlPlugin as viteHtmlPlugin } from 'vite-plugin-html';
import { VitePWA } from 'vite-plugin-pwa';
import viteVueDevTools from 'vite-plugin-vue-devtools';

import { viteArchiverPlugin } from './archiver';
import { viteExtraAppConfigPlugin } from './extra-app-config';
import { viteImportMapPlugin } from './importmap';
import { viteInjectAppLoadingPlugin } from './inject-app-loading';
import { viteMetadataPlugin } from './inject-metadata';
import { viteLicensePlugin } from './license';
import { viteNitroMockPlugin } from './nitro-mock';
import { vitePrintPlugin } from './print';

/**
 * 按各项 condition 过滤并展开启用的 Vite 插件。
 *
 * @param conditionPlugins - 按条件决定是否装载的 Vite 插件定义集合。
 * @returns condition 成立后展开得到的 Vite 插件数组。
 */
async function loadConditionPlugins(conditionPlugins: ConditionPlugin[]) {
  const plugins: PluginOption[] = [];
  for (const conditionPlugin of conditionPlugins) {
    if (conditionPlugin.condition) {
      // 第三方插件可能绑定到不同的 Vite 类型实例，运行时统一收敛为 Vite PluginOption。
      const realPlugins = (await conditionPlugin.plugins()) as PluginOption[];
      plugins.push(...realPlugins);
    }
  }
  return plugins.flat();
}

/**
 * 组装 Vue、JSX、开发工具、构建元数据和产物分析插件，并保留各自启用条件。
 *
 * @param options - 通用 Vite 插件的启用开关与构建配置。
 * @returns 开发与构建共用且按选项启用的 Vite 插件数组。
 */
async function loadCommonPlugins(
  options: CommonPluginOptions,
): Promise<ConditionPlugin[]> {
  const { devtools, injectMetadata, isBuild, visualizer } = options;
  return [
    {
      condition: true,
      plugins: () => [
        viteVue({
          script: {
            defineModel: true,
            // propsDestructure: true,
          },
        }),
        viteVueJsx(),
      ],
    },

    {
      condition: !isBuild && devtools,
      plugins: () => [viteVueDevTools()],
    },
    {
      condition: injectMetadata,
      plugins: async () => [await viteMetadataPlugin()],
    },
    {
      condition: isBuild && !!visualizer,
      plugins: () => [<PluginOption>viteVisualizerPlugin({
          filename: './node_modules/.cache/visualizer/stats.html',
          gzipSize: true,
          open: true,
        })],
    },
  ];
}

/**
 * 根据应用构建选项启用国际化、模拟服务、PWA、压缩、导入映射及运行时配置等插件。
 *
 * @param options - 应用构建插件的压缩、分析、PWA 与注入配置。
 * @returns 按应用构建选项启用的 Vite 插件数组。
 */
async function loadApplicationPlugins(
  options: ApplicationPluginOptions,
): Promise<PluginOption[]> {
  // 单独取，否则commonOptions拿不到
  const isBuild = options.isBuild;
  const env = options.env ?? {};

  const {
    appTitle,
    archiver,
    archiverPluginOptions,
    compress,
    compressTypes,
    extraAppConfig,
    html,
    i18n,
    importmap,
    importmapOptions,
    injectAppLoading,
    license,
    nitroMock,
    nitroMockOptions,
    print,
    printInfoMap,
    pwa,
    pwaOptions,
    ...commonOptions
  } = options;

  const commonPlugins = await loadCommonPlugins(commonOptions);

  return await loadConditionPlugins([
    ...commonPlugins,
    {
      condition: i18n,
      plugins: async () => {
        return [
          viteVueI18nPlugin({
            compositionOnly: true,
            fullInstall: true,
            runtimeOnly: true,
          }),
        ];
      },
    },
    {
      condition: print,
      plugins: async () => {
        return [await vitePrintPlugin({ infoMap: printInfoMap })];
      },
    },
    {
      condition: nitroMock,
      plugins: async () => {
        return [await viteNitroMockPlugin(nitroMockOptions)];
      },
    },

    {
      condition: injectAppLoading,
      plugins: async () => [await viteInjectAppLoadingPlugin(!!isBuild, env)],
    },
    {
      condition: license,
      plugins: async () => [await viteLicensePlugin()],
    },
    {
      condition: pwa,
      plugins: () =>
        VitePWA({
          injectRegister: false,
          workbox: {
            globPatterns: [],
          },
          ...pwaOptions,
          manifest: {
            display: 'standalone',
            start_url: '/',
            theme_color: '#ffffff',
            ...pwaOptions?.manifest,
          },
        }),
    },
    {
      condition: isBuild && !!compress,
      plugins: () => {
        const compressPlugins: PluginOption[] = [];
        if (compressTypes?.includes('brotli')) {
          compressPlugins.push(
            viteCompressPlugin({ deleteOriginFile: false, ext: '.br' }),
          );
        }
        if (compressTypes?.includes('gzip')) {
          compressPlugins.push(
            viteCompressPlugin({ deleteOriginFile: false, ext: '.gz' }),
          );
        }
        return compressPlugins;
      },
    },
    {
      condition: !!html,
      plugins: () => [
        viteHtmlPlugin({
          inject: {
            data: {
              ...env,
              VITE_APP_TITLE:
                env.VITE_APP_TITLE ||
                process.env.VITE_APP_TITLE ||
                appTitle ||
                'Vben Admin Antdv Next',
            },
          },
          minify: true,
        }),
      ],
    },
    {
      condition: isBuild && importmap,
      plugins: () => {
        return [viteImportMapPlugin(importmapOptions)];
      },
    },
    {
      condition: isBuild && extraAppConfig,
      plugins: async () => [
        await viteExtraAppConfigPlugin({ isBuild: true, root: process.cwd() }),
      ],
    },
    {
      condition: archiver,
      plugins: async () => {
        return [await viteArchiverPlugin(archiverPluginOptions)];
      },
    },
  ]);
}

/**
 * 为库构建复用通用插件，并仅在构建且启用声明输出时加入类型声明插件。
 *
 * @param options - 库构建插件的输出与类型声明配置。
 * @returns 按库构建选项启用的 Vite 插件数组。
 */
async function loadLibraryPlugins(
  options: LibraryPluginOptions,
): Promise<PluginOption[]> {
  // 单独取，否则commonOptions拿不到
  const isBuild = options.isBuild;
  const { dts, ...commonOptions } = options;
  const commonPlugins = await loadCommonPlugins(commonOptions);
  return await loadConditionPlugins([
    ...commonPlugins,
    {
      condition: isBuild && !!dts,
      plugins: () => [viteDtsPlugin({ logLevel: 'error' })],
    },
  ]);
}

export {
  loadApplicationPlugins,
  loadLibraryPlugins,
  viteArchiverPlugin,
  viteCompressPlugin,
  viteDtsPlugin,
  viteHtmlPlugin,
  viteVisualizerPlugin,
};
