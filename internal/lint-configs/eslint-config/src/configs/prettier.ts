import type { Linter } from 'eslint';

import { interopDefault } from '../util';

/**
 * 加载 eslint-plugin-prettier，并把格式差异作为 ESLint 错误报告。
 *
 * @returns 把 Prettier 格式差异报告为错误的 ESLint 配置数组。
 */
export async function prettier(): Promise<Linter.Config[]> {
  const [pluginPrettier] = await Promise.all([
    interopDefault(import('eslint-plugin-prettier')),
  ] as const);
  return [
    {
      plugins: {
        prettier: pluginPrettier,
      },
      rules: {
        'prettier/prettier': 'error',
      },
    },
  ];
}
