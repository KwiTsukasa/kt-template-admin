import type { Linter } from 'eslint';

import { interopDefault } from '../util';

/**
 * 加载 Turbo 插件，并报告未在 turbo.json 声明的环境变量。
 *
 * @returns 注册 Turbo ESLint 插件的配置数组。
 */
export async function turbo(): Promise<Linter.Config[]> {
  const [pluginTurbo] = await Promise.all([
    interopDefault(import('eslint-config-turbo')),
  ] as const);

  return [
    {
      plugins: {
        turbo: pluginTurbo,
      },
    },
  ];
}
