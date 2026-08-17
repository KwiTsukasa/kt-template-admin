import type { Linter } from 'eslint';

import { interopDefault } from '../util';

/**
 * 加载 eslint-plugin-jsdoc，并检查标签、参数、属性、返回值和 yield 说明。
 *
 * @returns 约束 JSDoc 语法、标签和说明完整性的 ESLint 配置数组。
 */
export async function jsdoc(): Promise<Linter.Config[]> {
  const [pluginJsdoc] = await Promise.all([
    interopDefault(import('eslint-plugin-jsdoc')),
  ] as const);

  return [
    {
      plugins: {
        jsdoc: pluginJsdoc,
      },
      rules: {
        'jsdoc/check-access': 'warn',
        'jsdoc/check-param-names': 'warn',
        'jsdoc/check-property-names': 'warn',
        'jsdoc/check-types': 'warn',
        'jsdoc/empty-tags': 'warn',
        'jsdoc/implements-on-classes': 'warn',
        'jsdoc/no-defaults': 'warn',
        'jsdoc/no-multi-asterisks': 'warn',
        'jsdoc/require-param-name': 'warn',
        'jsdoc/require-property': 'warn',
        'jsdoc/require-property-description': 'warn',
        'jsdoc/require-property-name': 'warn',
        'jsdoc/require-returns-check': 'warn',
        'jsdoc/require-returns-description': 'warn',
        'jsdoc/require-yields-check': 'warn',
      },
    },
  ];
}
