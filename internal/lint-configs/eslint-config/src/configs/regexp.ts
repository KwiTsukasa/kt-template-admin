import type { Linter } from 'eslint';

import { interopDefault } from '../util';

/**
 * 加载 regexp 插件，并启用正则表达式推荐检查。
 *
 * @returns 启用正则表达式推荐规则的 ESLint 配置数组。
 */
export async function regexp(): Promise<Linter.Config[]> {
  const [pluginRegexp] = await Promise.all([
    interopDefault(import('eslint-plugin-regexp')),
  ] as const);

  return [
    {
      plugins: {
        regexp: pluginRegexp,
      },
      rules: {
        ...pluginRegexp.configs.recommended.rules,
      },
    },
  ];
}
