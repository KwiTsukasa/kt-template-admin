import type { GeneratorOptions } from '@jspm/generator';
import type { Plugin } from 'vite';

import { Generator } from '@jspm/generator';
import { load } from 'cheerio';
import { minify } from 'html-minifier-terser';

const DEFAULT_PROVIDER = 'jspm.io';

type pluginOptions = GeneratorOptions & {
  debug?: boolean;
  defaultProvider?: 'esm.sh' | 'jsdelivr' | 'jspm.io';
  importmap?: Array<{ name: string; range?: string }>;
};

// async function getLatestVersionOfShims() {
//   const result = await fetch('https://ga.jspm.io/npm:es-module-shims');
//   const version = result.text();
//   return version;
// }

/**
 * 按 CDN 提供商选择固定版本 ES Module Shims 地址，未知提供商回退到默认源。
 *
 * @param provide - 是否把新建上下文注入后代组件。
 * @returns 指定 CDN 对应的 ES Module Shims 地址；提供商未知时为默认 CDN 地址。
 */
async function getShimsUrl(provide: string) {
  // const version = await getLatestVersionOfShims();
  const version = '1.10.0';

  const shimsSubpath = `dist/es-module-shims.js`;
  const providerShimsMap: Record<string, string> = {
    'esm.sh': `https://esm.sh/es-module-shims@${version}/${shimsSubpath}`,
    // unpkg: `https://unpkg.com/es-module-shims@${version}/${shimsSubpath}`,
    jsdelivr: `https://cdn.jsdelivr.net/npm/es-module-shims@${version}/${shimsSubpath}`,

    // 下面两个CDN不稳定，暂时不用
    'jspm.io': `https://ga.jspm.io/npm:es-module-shims@${version}/${shimsSubpath}`,
  };

  return providerShimsMap[provide] || providerShimsMap[DEFAULT_PROVIDER];
}

let generator: Generator;

/**
 * 创建负责生成、注入并校验 import map 的 Vite 插件组。
 *
 * @param pluginOptions - 控制 import map 文件名、依赖范围与注入行为的插件选项。
 * @returns 负责生成、注入和校验 import map 的 Vite 插件数组。
 */
async function viteImportMapPlugin(
  pluginOptions?: pluginOptions,
): Promise<Plugin[]> {
  const { importmap } = pluginOptions || {};

  let isSSR = false;
  let isBuild = false;
  let installed = false;
  let installError: Error | null = null;

  const options: pluginOptions = Object.assign(
    {},
    {
      debug: false,
      defaultProvider: 'jspm.io',
      env: ['production', 'browser', 'module'],
      importmap: [],
    },
    pluginOptions,
  );

  generator = new Generator({
    ...options,
    baseUrl: process.cwd(),
  });

  if (options?.debug) {
    (async () => {
      for await (const { message, type } of generator.logStream()) {
        console.log(`${type}: ${message}`);
      }
    })();
  }

  const imports = options.inputMap?.imports ?? {};
  const scopes = options.inputMap?.scopes ?? {};
  const firstLayerKeys = Object.keys(scopes);
  const inputMapScopes: string[] = [];
  firstLayerKeys.forEach((key) => {
    inputMapScopes.push(...Object.keys(scopes[key] || {}));
  });
  const inputMapImports = Object.keys(imports);

  const allDepNames: string[] = [
    ...(importmap?.map((item) => item.name) || []),
    ...inputMapImports,
    ...inputMapScopes,
  ];
  const depNames = new Set<string>(allDepNames);

  const installDeps = importmap?.map((item) => ({
    range: item.range,
    target: item.name,
  }));

  return [
    {
      /**
       * 记录 Vite 命令、模式、项目根目录和输出目录，供 import map 构建钩子共享。
       *
       * @param _ - 占位参数；函数不会读取该值。
       */
      async config(_, { command, isSsrBuild }) {
        isBuild = command === 'build';
        isSSR = !!isSsrBuild;
      },
      enforce: 'pre',
      name: 'importmap:external',
      /**
       * 仅在客户端生产构建中把 import map 依赖标记为外部模块，其他标识返回 null 交给后续插件。
       *
       * @param id - Vite 正在解析的模块导入说明符；仅依赖集合内的项会标记为 external。
       * @returns 目标依赖在客户端生产构建中为外部模块描述符；其他情况返回 null。
       */
      resolveId(id) {
        if (isSSR || !isBuild) {
          return null;
        }

        if (!depNames.has(id)) {
          return null;
        }
        return { external: true, id };
      },
    },
    {
      enforce: 'post',
      name: 'importmap:install',
      /**
       * 在客户端生产构建首次解析模块时安装 import map 依赖，记录安装失败但始终返回 null。
       *
       * @returns 固定返回 null；依赖安装结果仅记录在插件内部状态。
       */
      async resolveId() {
        if (isSSR || !isBuild || installed) {
          return null;
        }
        try {
          installed = true;
          await Promise.allSettled(
            (installDeps || []).map((dep) => generator.install(dep)),
          );
        } catch (error: any) {
          installError = error;
          installed = false;
        }
        return null;
      },
    },
    {
      /**
       * 在非 SSR 构建结束时确认 import map 已安装，防止失败结果进入构建缓存。
       *
       * @throws 非 SSR 构建未成功安装 import map 时抛出。
       */
      buildEnd() {
        // 未生成importmap时，抛出错误，防止被turbo缓存
        if (!installed && !isSSR) {
          installError && console.error(installError);
          throw new Error('Importmap installation failed.');
        }
      },
      enforce: 'post',
      name: 'importmap:html',
      transformIndexHtml: {
        /**
         * 仅在客户端生产构建中向 HTML 注入 ES Module Shims 与 import map。
         *
         * @param html - Vite 提供的入口 HTML，构建时会注入 import map 和 shim。
         * @returns 生产非 SSR 模式下为注入脚本后的 HTML 描述符；其他模式返回原 HTML。
         */
        async handler(html) {
          if (isSSR || !isBuild) {
            return html;
          }

          const importmapJson = generator.getMap();

          if (!importmapJson) {
            return html;
          }

          const esModuleShimsSrc = await getShimsUrl(
            options.defaultProvider || DEFAULT_PROVIDER,
          );

          const resultHtml = await injectShimsToHtml(
            html,
            esModuleShimsSrc || '',
          );
          html = await minify(resultHtml || html, {
            collapseWhitespace: true,
            minifyCSS: true,
            minifyJS: true,
            removeComments: false,
          });

          return {
            html,
            tags: [
              {
                attrs: {
                  type: 'importmap',
                },
                injectTo: 'head-prepend',
                tag: 'script',
                children: `${JSON.stringify(importmapJson)}`,
              },
            ],
          };
        },
        order: 'post',
      },
    },
  ];
}

/**
 * 把 ES Module Shims 脚本标签注入 HTML，已有同源标签时保持幂等。
 *
 * @param html - 需要替换模块脚本类型并注入 ES Module Shims 的 HTML。
 * @param esModuleShimUrl - 要注入页面的 ES Module Shims 脚本地址。
 * @returns 替换模块入口并注入兼容加载逻辑后的 HTML；找不到模块脚本时返回 undefined。
 */
async function injectShimsToHtml(html: string, esModuleShimUrl: string) {
  const $ = load(html);

  const $script = $(`script[type='module']`);

  if (!$script) {
    return;
  }

  const entry = $script.attr('src');

  $script.removeAttr('type');
  $script.removeAttr('crossorigin');
  $script.removeAttr('src');
  $script.html(`
if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('importmap')) {
  self.importShim = function () {
      const promise = new Promise((resolve, reject) => {
          document.head.appendChild(
              Object.assign(document.createElement('script'), {
                  src: '${esModuleShimUrl}',
                  crossorigin: 'anonymous',
                  async: true,
                  onload() {
                      if (!importShim.$proxy) {
                          resolve(importShim);
                      } else {
                          reject(new Error('No globalThis.importShim found:' + esModuleShimUrl));
                      }
                  },
                  onerror(error) {
                      reject(error);
                  },
              }),
          );
      });
      importShim.$proxy = true;
      return promise.then((importShim) => importShim(...arguments));
  };
}

var modules = ['${entry}'];
typeof importShim === 'function'
  ? modules.forEach((moduleName) => importShim(moduleName))
  : modules.forEach((moduleName) => import(moduleName));
 `);
  $('body').after($script);
  $('head').remove(`script[type='module']`);
  return $.html();
}

export { viteImportMapPlugin };
