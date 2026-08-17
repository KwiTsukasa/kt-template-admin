import type { Linter } from 'eslint';

import { interopDefault } from '../util';

/**
 * 启用 Unicorn 推荐规则，并应用仓库约定的命名与兼容性例外。
 *
 * @returns 启用 Unicorn 推荐规则并覆盖仓库例外的 ESLint 配置数组。
 */
export async function unicorn(): Promise<Linter.Config[]> {
  const [pluginUnicorn] = await Promise.all([
    interopDefault(import('eslint-plugin-unicorn')),
  ] as const);

  return [
    {
      plugins: {
        unicorn: pluginUnicorn,
      },
      rules: {
        ...pluginUnicorn.configs.recommended.rules,

        'unicorn/better-regex': 'off',
        'unicorn/consistent-destructuring': 'off',
        'unicorn/consistent-function-scoping': 'off',
        'unicorn/expiring-todo-comments': 'off',
        'unicorn/filename-case': 'off',
        'unicorn/import-style': 'off',
        'unicorn/no-array-for-each': 'off',
        'unicorn/no-null': 'off',
        'unicorn/no-useless-undefined': 'off',
        'unicorn/prefer-at': 'off',
        'unicorn/prefer-dom-node-text-content': 'off',
        'unicorn/prefer-export-from': ['error', { ignoreUsedVariables: true }],
        'unicorn/prefer-global-this': 'off',
        'unicorn/prefer-ternary': 'off',
        'unicorn/prefer-top-level-await': 'off',
        'unicorn/prevent-abbreviations': 'off',
      },
    },
    {
      files: ['internal/**/*.?([cm])[jt]s?(x)'],
      rules: {
        'unicorn/no-process-exit': 'off',
      },
    },
  ];
}
