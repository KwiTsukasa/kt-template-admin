import type { Linter } from 'eslint';

import * as pluginImport from 'eslint-plugin-import-x';

/**
 * 动态加载指定 ESLint 插件配置，并统一转换为扁平配置数组。
 *
 * @returns 可直接并入 ESLint 扁平配置的配置数组。
 */
export async function importPluginConfig(): Promise<Linter.Config[]> {
  return [
    {
      plugins: {
        // @ts-expect-error - This is a dynamic import
        import: pluginImport,
      },
      rules: {
        'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
        'import/first': 'error',
        'import/newline-after-import': 'error',
        'import/no-duplicates': 'error',
        'import/no-mutable-exports': 'error',
        'import/no-named-default': 'error',
        'import/no-self-import': 'error',
        'import/no-unresolved': 'off',
        'import/no-webpack-loader-syntax': 'error',
      },
    },
  ];
}
