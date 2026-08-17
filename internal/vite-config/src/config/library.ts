import type { ConfigEnv, UserConfig } from 'vite';

import type { DefineLibraryOptions } from '../typing';

import { readPackageJSON } from '@vben/node-utils';

import { defineConfig, mergeConfig } from 'vite';

import { loadLibraryPlugins } from '../plugins';
import { getCommonConfig } from './common';

/**
 * 把库模式默认值与用户配置合并，返回适用于包构建的 Vite 配置。
 *
 * @param userConfigPromise - 用户提供的 Vite 配置或异步配置工厂。
 * @returns 合并库构建默认值、外部依赖规则与用户覆盖后的 Vite 配置工厂。
 */
function defineLibraryConfig(userConfigPromise?: DefineLibraryOptions) {
  return defineConfig(async (config: ConfigEnv) => {
    const options = await userConfigPromise?.(config);
    const { command, mode } = config;
    const { library = {}, vite = {} } = options || {};
    const root = process.cwd();
    const isBuild = command === 'build';

    const plugins = await loadLibraryPlugins({
      dts: false,
      injectMetadata: true,
      isBuild,
      mode,
      ...library,
    });

    const { dependencies = {}, peerDependencies = {} } =
      await readPackageJSON(root);

    const externalPackages = [
      ...Object.keys(dependencies),
      ...Object.keys(peerDependencies),
    ];

    const packageConfig: UserConfig = {
      build: {
        lib: {
          entry: 'src/index.ts',
          fileName: () => 'index.mjs',
          formats: ['es'],
        },
        rollupOptions: {
          external: (id) => {
            return externalPackages.some(
              (pkg) => id === pkg || id.startsWith(`${pkg}/`),
            );
          },
        },
      },
      plugins,
    };
    const commonConfig = await getCommonConfig();
    const mergedConmonConfig = mergeConfig(commonConfig, packageConfig);
    return mergeConfig(mergedConmonConfig, vite);
  });
}

export { defineLibraryConfig };
