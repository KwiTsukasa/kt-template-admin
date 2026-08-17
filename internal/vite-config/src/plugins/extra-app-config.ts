import type { PluginOption } from 'vite';

import {
  colors,
  generatorContentHash,
  readPackageJSON,
} from '@vben/node-utils';

import { loadEnv } from '../utils/env';

interface PluginOptions {
  isBuild: boolean;
  root: string;
}

const GLOBAL_CONFIG_FILE_NAME = '_app.config.js';
const VBEN_ADMIN_PRO_APP_CONF = '_VBEN_ADMIN_PRO_APP_CONF_';

/**
 * 在生产构建中输出独立运行时配置脚本，并把带版本摘要的脚本地址注入入口 HTML。
 *
 * @returns 生产构建使用的运行时配置输出插件；非构建模式为 undefined。
 */

async function viteExtraAppConfigPlugin({
  isBuild,
  root,
}: PluginOptions): Promise<PluginOption | undefined> {
  let publicPath: string;
  let source: string;

  if (!isBuild) {
    return;
  }

  const { version = '' } = await readPackageJSON(root);

  return {
    /**
     * 从 Vite 最终配置解析应用元数据和输出目录，供 HTML 转换写入配置脚本。
     *
     * @param config - Vite 完成解析后的最终配置。
     */
    async configResolved(config) {
      publicPath = ensureTrailingSlash(config.base);
      source = await getConfigSource();
    },
    /**
     * 在 Rollup 产物阶段输出运行时应用配置文件；失败只记录构建日志。
     */
    async generateBundle() {
      try {
        this.emitFile({
          fileName: GLOBAL_CONFIG_FILE_NAME,
          source,
          type: 'asset',
        });

        console.log(colors.cyan(`✨configuration file is build successfully!`));
      } catch (error) {
        console.log(
          colors.red(
            `configuration file configuration file failed to package:\n${error}`,
          ),
        );
      }
    },
    name: 'vite:extra-app-config',
    /**
     * 在 HTML 中注入带版本与内容摘要的应用配置脚本标签，原 HTML 内容保持不变。
     *
     * @param html - Vite 提供的入口 HTML，将在其中注入运行时应用配置脚本。
     * @returns 包含注入后 HTML 与配置脚本标签描述符的 Vite HTML 转换结果。
     */
    async transformIndexHtml(html) {
      const hash = `v=${version}-${generatorContentHash(source, 8)}`;

      const appConfigSrc = `${publicPath}${GLOBAL_CONFIG_FILE_NAME}?${hash}`;

      return {
        html,
        tags: [{ attrs: { src: appConfigSrc }, tag: 'script' }],
      };
    },
  };
}

/**
 * 把应用配置序列化为可注入页面的脚本源码，并转义不安全字符。
 *
 * @returns 已转义、可安全注入页面脚本的应用配置源码。
 */
async function getConfigSource() {
  const config = await loadEnv();
  const windowVariable = `window.${VBEN_ADMIN_PRO_APP_CONF}`;
  // 确保变量不会被修改
  let source = `${windowVariable}=${JSON.stringify(config)};`;
  source += `
    Object.freeze(${windowVariable});
    Object.defineProperty(window, "${VBEN_ADMIN_PRO_APP_CONF}", {
      configurable: false,
      writable: false,
    });
  `.replaceAll(/\s/g, '');
  return source;
}

/**
 * 路径已有尾斜杠时保持原值，否则在末尾补上 `/`。
 *
 * @param path - 需要确保以 `/` 结尾的路径字符串。
 * @returns 以 `/` 结尾的路径；原本已有尾斜杠时保持原值。
 */
function ensureTrailingSlash(path: string) {
  if (path.endsWith('/')) {
    return path;
  }
  return `${path}/`;
}

export { viteExtraAppConfigPlugin };
