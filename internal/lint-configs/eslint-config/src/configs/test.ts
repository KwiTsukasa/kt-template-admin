import type { Linter } from 'eslint';

import { interopDefault } from '../util';

/**
 * 为 Vitest 与基准测试启用测试规则，并禁止提交 only 用例。
 *
 * @returns 适用于 Vitest、基准测试并禁止 only 测试的 ESLint 配置数组。
 */
export async function test(): Promise<Linter.Config[]> {
  const [pluginTest, pluginNoOnlyTests] = await Promise.all([
    interopDefault(import('eslint-plugin-vitest')),
    // @ts-expect-error - no types
    interopDefault(import('eslint-plugin-no-only-tests')),
  ] as const);

  return [
    {
      files: [
        `**/__tests__/**/*.?([cm])[jt]s?(x)`,
        `**/*.spec.?([cm])[jt]s?(x)`,
        `**/*.test.?([cm])[jt]s?(x)`,
        `**/*.bench.?([cm])[jt]s?(x)`,
        `**/*.benchmark.?([cm])[jt]s?(x)`,
      ],
      plugins: {
        test: {
          ...pluginTest,
          rules: {
            ...pluginTest.rules,
            ...pluginNoOnlyTests.rules,
          },
        },
      },
      rules: {
        'no-console': 'off',
        'node/prefer-global/process': 'off',
        'test/consistent-test-it': [
          'error',
          { fn: 'it', withinDescribe: 'it' },
        ],
        'test/no-identical-title': 'error',
        'test/no-import-node-test': 'error',
        'test/no-only-tests': 'error',
        'test/prefer-hooks-in-order': 'error',
        'test/prefer-lowercase-title': 'error',
      },
    },
  ];
}
