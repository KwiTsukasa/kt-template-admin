import type { DefineConfig, VbenViteConfig } from '../typing';

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { defineApplicationConfig } from './application';
import { defineLibraryConfig } from './library';

export * from './application';
export * from './library';

/**
 * 根据显式类型或 index.html 自动识别项目形态，并选择应用或库配置。
 *
 * @param userConfigPromise - 用户提供的 Vite 配置或异步配置工厂。
 * @param type - 显式指定 application、library 或 auto；auto 会依据 index.html 推断；未传入时使用 `'auto'`。
 * @returns 与识别出的应用或库项目形态对应的 Vite 配置工厂。
 * @throws 项目类型既不是 `application` 也不是 `library` 时抛出。
 */
function defineConfig(
  userConfigPromise?: DefineConfig,
  type: 'application' | 'auto' | 'library' = 'auto',
): VbenViteConfig {
  let projectType = type;

  // 根据包是否存在 index.html,自动判断类型
  if (projectType === 'auto') {
    const htmlPath = join(process.cwd(), 'index.html');
    if (existsSync(htmlPath)) {
      projectType = 'application';
    } else {
      projectType = 'library';
    }
  }

  switch (projectType) {
    case 'application': {
      return defineApplicationConfig(userConfigPromise);
    }
    case 'library': {
      return defineLibraryConfig(userConfigPromise);
    }
    default: {
      throw new Error(`Unsupported project type: ${projectType}`);
    }
  }
}

export { defineConfig };
