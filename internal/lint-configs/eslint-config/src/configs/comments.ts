import type { Linter } from 'eslint';

import { interopDefault } from '../util';

/**
 * 加载 eslint-comments 插件，并禁止聚合、重复、无限和未配对的禁用注释。
 *
 * @returns 约束警告注释格式与关键词的 ESLint 扁平配置数组。
 */
export async function comments(): Promise<Linter.Config[]> {
  const [pluginComments] = await Promise.all([
    // @ts-expect-error - no types
    interopDefault(import('eslint-plugin-eslint-comments')),
  ] as const);

  return [
    {
      plugins: {
        'eslint-comments': pluginComments,
      },
      rules: {
        'eslint-comments/no-aggregating-enable': 'error',
        'eslint-comments/no-duplicate-disable': 'error',
        'eslint-comments/no-unlimited-disable': 'error',
        'eslint-comments/no-unused-enable': 'error',
      },
    },
  ];
}
