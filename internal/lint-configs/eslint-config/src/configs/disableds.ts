import type { Linter } from 'eslint';

/**
 * 根据测试、声明文件和 JavaScript 文件关闭不适用的 TypeScript 或控制台规则。
 *
 * @returns 关闭与仓库约定冲突的基础 ESLint 规则的配置数组。
 */
export async function disableds(): Promise<Linter.Config[]> {
  return [
    {
      files: ['**/__tests__/**/*.?([cm])[jt]s?(x)'],
      name: 'disables/test',
      rules: {
        '@typescript-eslint/ban-ts-comment': 'off',
        'no-console': 'off',
      },
    },
    {
      files: ['**/*.d.ts'],
      name: 'disables/dts',
      rules: {
        '@typescript-eslint/triple-slash-reference': 'off',
      },
    },
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      name: 'disables/js',
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
  ];
}
