import type { Linter } from 'eslint';

import {
  command,
  comments,
  disableds,
  ignores,
  importPluginConfig,
  javascript,
  jsdoc,
  jsonc,
  node,
  perfectionist,
  pnpm,
  prettier,
  regexp,
  test,
  turbo,
  typescript,
  unicorn,
  vue,
  yaml,
} from './configs';
import { customConfig } from './custom-config';

type FlatConfig = Linter.Config;

type FlatConfigPromise =
  | FlatConfig
  | FlatConfig[]
  | Promise<FlatConfig>
  | Promise<FlatConfig[]>;

/**
 * 并行解析仓库内置 ESLint 配置与调用方扩展，并展平为最终规则数组。
 *
 * @param config - 追加到仓库内置规则之后的调用方 ESLint 扁平配置；省略时为空数组。
 * @returns 与识别出的应用或库项目形态对应的 Vite 配置工厂。
 */
async function defineConfig(config: FlatConfig[] = []) {
  const configs: FlatConfigPromise[] = [
    vue(),
    javascript(),
    ignores(),
    prettier(),
    typescript(),
    jsonc(),
    disableds(),
    importPluginConfig(),
    node(),
    perfectionist(),
    comments(),
    jsdoc(),
    unicorn(),
    test(),
    regexp(),
    command(),
    turbo(),
    yaml(),
    pnpm(),
    ...customConfig,
    ...config,
  ];

  const resolved = await Promise.all(configs);

  return resolved.flat();
}

export { defineConfig };
