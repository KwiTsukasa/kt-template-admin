import type { Linter } from 'eslint';

import { interopDefault } from '../util';

/**
 * 根据文件类型为 package.json 与 pnpm-workspace.yaml 启用 pnpm 目录和依赖声明检查。
 *
 * @returns 校验 package.json 与 pnpm-workspace.yaml 目录设置的 ESLint 配置数组。
 */
export async function pnpm(): Promise<Linter.Config[]> {
  const [pluginPnpm, parserPnpm, parserJsonc] = await Promise.all([
    interopDefault(import('eslint-plugin-pnpm')),
    interopDefault(import('yaml-eslint-parser')),
    interopDefault(import('jsonc-eslint-parser')),
  ] as const);

  return [
    {
      files: ['package.json', '**/package.json'],
      languageOptions: {
        parser: parserJsonc,
      },
      plugins: {
        pnpm: pluginPnpm,
      },
      rules: {
        'pnpm/json-enforce-catalog': 'error',
        'pnpm/json-prefer-workspace-settings': 'error',
        'pnpm/json-valid-catalog': 'error',
      },
    },
    {
      files: ['pnpm-workspace.yaml'],
      languageOptions: {
        parser: parserPnpm,
      },
      plugins: {
        pnpm: pluginPnpm,
      },
      rules: {
        'pnpm/yaml-no-duplicate-catalog-item': 'error',
        'pnpm/yaml-no-unused-catalog-item': 'error',
      },
    },
  ];
}
