import type { PluginOption } from 'vite';

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPackageJSON } from '@vben/node-utils';

/**
 * 在生产构建中把共享 loading 模板注入应用 HTML，避免每个入口重复维护。
 *
 * @param isBuild - 是否处于生产构建；false 时不注入首屏 loading 模板。
 * @param env - Vite 解析后的环境变量，用于读取应用运行配置；未传入时使用 `{}`。
 * @param loadingTemplate - 要读取并注入应用 HTML 的首屏 loading 模板文件名；未传入时使用 `'loading.html'`。
 * @returns 首屏 loading HTML 注入插件；模板为空时为 undefined。
 */
async function viteInjectAppLoadingPlugin(
  isBuild: boolean,
  env: Record<string, any> = {},
  loadingTemplate = 'loading.html',
): Promise<PluginOption | undefined> {
  const loadingHtml = await getLoadingRawByHtmlTemplate(loadingTemplate);
  const { version } = await readPackageJSON(process.cwd());
  const envRaw = (() => {
    if (isBuild) {
      return 'prod';
    }
    return 'dev';
  })();
  const cacheName = `'${env.VITE_APP_NAMESPACE}-${version}-${envRaw}-preferences-theme'`;

  // 获取缓存的主题
  // 保证黑暗主题下，刷新页面时，loading也是黑暗主题
  const injectScript = `
  <script data-app-loading="inject-js">
  var theme = localStorage.getItem(${cacheName});
  document.documentElement.classList.toggle('dark', /dark/.test(theme));
</script>
`;

  if (!loadingHtml) {
    return;
  }

  return {
    enforce: 'pre',
    name: 'vite:inject-app-loading',
    transformIndexHtml: {
      /**
       * 把首屏加载脚本与占位标记插入 body 起始位置，并返回修改后的 HTML。
       *
       * @param html - 需要注入首屏加载占位样式和节点的入口 HTML。
       * @returns 在 body 起始位置加入加载标记后的 HTML。
       */
      handler(html) {
        const re = /<body\s*>/;
        html = html.replace(re, `<body>${injectScript}${loadingHtml}`);
        return html;
      },
      order: 'pre',
    },
  };
}

/**
 * 根据模板文件名读取共享 loading HTML 原文。
 *
 * @param loadingTemplate - 要读取并注入应用 HTML 的首屏 loading 模板文件名。
 * @returns 应用自定义或内置默认 loading 模板的 UTF-8 HTML。
 */
async function getLoadingRawByHtmlTemplate(loadingTemplate: string) {
  // 支持在app内自定义loading模板，模版参考default-loading.html即可
  let appLoadingPath = join(process.cwd(), loadingTemplate);

  if (!fs.existsSync(appLoadingPath)) {
    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    appLoadingPath = join(__dirname, './default-loading.html');
  }

  return await fsp.readFile(appLoadingPath, 'utf8');
}

export { viteInjectAppLoadingPlugin };
