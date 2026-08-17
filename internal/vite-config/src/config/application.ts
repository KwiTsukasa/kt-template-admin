import type { CSSOptions, UserConfig } from 'vite';

import type { DefineApplicationOptions } from '../typing';

import path, { relative } from 'node:path';

import { findMonorepoRoot } from '@vben/node-utils';

import { NodePackageImporter } from 'sass';
import { defineConfig, loadEnv, mergeConfig } from 'vite';

import { defaultImportmapOptions, getDefaultPwaOptions } from '../options';
import { loadApplicationPlugins } from '../plugins';
import { loadAndConvertEnv } from '../utils/env';
import { getCommonConfig } from './common';

/**
 * 把应用级 Vite 默认值与用户配置合并，返回最终应用构建配置。
 *
 * @param userConfigPromise - 用户提供的 Vite 配置或异步配置工厂。
 * @returns 合并环境变量、应用插件、通用默认值与用户覆盖后的 Vite 配置工厂。
 */
function defineApplicationConfig(userConfigPromise?: DefineApplicationOptions) {
  return defineConfig(async (config) => {
    const options = await userConfigPromise?.(config);
    const { appTitle, base, port, ...envConfig } = await loadAndConvertEnv();
    const { command, mode } = config;
    const { application = {}, vite = {} } = options || {};
    const root = process.cwd();
    const isBuild = command === 'build';
    const env = loadEnv(mode, root);

    const plugins = await loadApplicationPlugins({
      archiver: true,
      archiverPluginOptions: {},
      compress: false,
      compressTypes: ['brotli', 'gzip'],
      devtools: true,
      env,
      extraAppConfig: true,
      html: true,
      i18n: true,
      importmapOptions: defaultImportmapOptions,
      injectAppLoading: true,
      injectMetadata: true,
      isBuild,
      license: true,
      mode,
      nitroMock: !isBuild,
      nitroMockOptions: {},
      print: !isBuild,
      printInfoMap: {
        'Vben Admin Docs': 'https://doc.vben.pro',
      },
      pwa: true,
      pwaOptions: getDefaultPwaOptions(appTitle),
      ...envConfig,
      ...application,
    });

    const { injectGlobalScss = true } = application;

    const applicationConfig: UserConfig = {
      base,
      build: {
        rollupOptions: {
          output: {
            assetFileNames: '[ext]/[name]-[hash].[ext]',
            chunkFileNames: 'js/[name]-[hash].js',
            entryFileNames: 'jse/index-[name]-[hash].js',
          },
        },
        target: 'es2015',
      },
      css: createCssOptions(injectGlobalScss),
      esbuild: {
        drop: (() => {
          if (isBuild) {
            return [
              // 'console',
              'debugger',
            ];
          }
          return [];
        })(),
        legalComments: 'none',
      },
      plugins,
      server: {
        host: true,
        port,
        warmup: {
          // 预热文件
          clientFiles: [
            './index.html',
            './src/bootstrap.ts',
            './src/{views,layouts,router,store,api,adapter}/*',
          ],
        },
      },
    };

    const mergedCommonConfig = mergeConfig(
      await getCommonConfig(),
      applicationConfig,
    );
    return mergeConfig(mergedCommonConfig, vite);
  });
}

/**
 * 生成 Vite CSS 预处理配置；启用时仅向 apps 下的 SCSS 自动注入全局资源。
 *
 * @param injectGlobalScss - 是否把全局 SCSS 资源自动注入每个样式模块；未传入时使用 `true`。
 * @returns Vite CSS 配置；禁用全局注入时预处理器配置为空对象。
 */
function createCssOptions(injectGlobalScss = true): CSSOptions {
  const root = findMonorepoRoot();
  return {
    preprocessorOptions: (() => {
      if (injectGlobalScss) {
        return {
          scss: {
            additionalData: (content: string, filepath: string) => {
              const relativePath = relative(root, filepath);
              // apps下的包注入全局样式
              if (relativePath.startsWith(`apps${path.sep}`)) {
                return `@use "@vben/styles/global" as *;\n${content}`;
              }
              return content;
            },
            // api: 'modern',
            importers: [new NodePackageImporter()],
          },
        };
      }
      return {};
    })(),
  };
}

export { defineApplicationConfig };
