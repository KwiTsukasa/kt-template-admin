import type { PluginOption } from 'vite';

import type { NitroMockPluginOptions } from '../typing';

import { colors, consola, getPackage } from '@vben/node-utils';

import getPort from 'get-port';
import { build, createDevServer, createNitro, prepare } from 'nitropack';

const hmrKeyRe = /^runtimeConfig\.|routeRules\./;

export const viteNitroMockPlugin = ({
  mockServerPackage = '@vben/backend-mock',
  port = 5320,
  verbose = true,
}: NitroMockPluginOptions = {}): PluginOption => {
  return {
    /**
     * 仅在指定端口空闲且 mock 包存在时启动 Nitro 模拟服务，并扩展 Vite 的服务地址输出。
     *
     * @param server - 需要注册中间件或监听器的 Vite 开发服务器。
     */
    async configureServer(server) {
      const availablePort = await getPort({ port });
      if (availablePort !== port) {
        return;
      }

      const pkg = await getPackage(mockServerPackage);
      if (!pkg) {
        consola.log(
          `Package ${mockServerPackage} not found. Skip mock server.`,
        );
        return;
      }

      runNitroServer(pkg.dir, port, verbose);

      const _printUrls = server.printUrls;
      server.printUrls = () => {
        _printUrls();

        consola.log(
          `  ${colors.green('➜')}  ${colors.bold('Nitro Mock Server')}: ${colors.cyan(`http://localhost:${port}/api`)}`,
        );
      };
    },
    enforce: 'pre',
    name: 'vite:mock-server',
  };
};

/**
 * 创建可监听配置变化的 Nitro Mock 开发服务器，并在启动前完成 prepare 与 build。
 *
 * @param rootDir - 解析工作区文件与包路径时使用的根目录。
 * @param port - 端点格式化或连接使用的网络端口号。
 * @param verbose - 是否输出更详细的构建或诊断日志。
 * @returns Nitro Mock 服务完成监听、准备与首次构建后兑现的 Promise。
 */
async function runNitroServer(rootDir: string, port: number, verbose: boolean) {
  let nitro: any;
  const reload = async () => {
    if (nitro) {
      consola.info('Restarting dev server...');
      if ('unwatch' in nitro.options._c12) {
        await nitro.options._c12.unwatch();
      }
      await nitro.close();
    }
    nitro = await createNitro(
      {
        dev: true,
        preset: 'nitro-dev',
        rootDir,
      },
      {
        c12: {
          /**
           * 比较 Nitro 配置变化；仅热更新键变化时原位更新配置，否则重启开发服务器。
           */
          async onUpdate({ getDiff, newConfig }) {
            const diff = getDiff();
            if (diff.length === 0) {
              return;
            }
            verbose &&
              consola.info(
                `Nitro config updated:\n${diff
                  .map((entry) => `  ${entry.toString()}`)
                  .join('\n')}`,
              );
            await (() => {
              if (diff.every((e) => hmrKeyRe.test(e.key))) {
                return nitro.updateConfig(newConfig.config);
              }
              return reload();
            })();
          },
        },
        watch: true,
      },
    );
    nitro.hooks.hookOnce('restart', reload);

    const server = createDevServer(nitro);
    await server.listen(port, { showURL: false });
    await prepare(nitro);
    await build(nitro);

    if (verbose) {
      console.log('');
      consola.success(colors.bold(colors.green('Nitro Mock Server started.')));
    }
  };
  return await reload();
}
