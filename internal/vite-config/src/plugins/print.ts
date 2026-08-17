import type { PluginOption } from 'vite';

import type { PrintPluginOptions } from '../typing';

import { colors } from '@vben/node-utils';

export const vitePrintPlugin = (
  options: PrintPluginOptions = {},
): PluginOption => {
  const { infoMap = {} } = options;

  return {
    /**
     * 包装 Vite 开发服务器的地址输出，并追加调用方配置的信息项。
     *
     * @param server - 需要注册中间件或监听器的 Vite 开发服务器。
     */
    configureServer(server) {
      const _printUrls = server.printUrls;
      server.printUrls = () => {
        _printUrls();

        for (const [key, value] of Object.entries(infoMap)) {
          console.log(
            `  ${colors.green('➜')}  ${colors.bold(key)}: ${colors.cyan(value)}`,
          );
        }
      };
    },
    enforce: 'pre',
    name: 'vite:print-info',
  };
};
