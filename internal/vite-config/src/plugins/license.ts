import type {
  NormalizedOutputOptions,
  OutputBundle,
  OutputChunk,
} from 'rollup';
import type { PluginOption } from 'vite';

import { EOL } from 'node:os';

import { dateUtil, readPackageJSON } from '@vben/node-utils';

/**
 * 通过构建插件向产物注入项目版权与依赖许可信息。
 *
 * @param root - Vite 项目根目录，用来读取包信息或版权文件；未传入时使用 `process.cwd()`。
 * @returns 为入口 chunk 添加版权头的仅构建期 Vite 插件。
 */

async function viteLicensePlugin(
  root = process.cwd(),
): Promise<PluginOption | undefined> {
  const {
    description = '',
    homepage = '',
    version = '',
  } = await readPackageJSON(root);

  return {
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      handler: (_options: NormalizedOutputOptions, bundle: OutputBundle) => {
        const date = dateUtil().format('YYYY-MM-DD ');
        const copyrightText = `/*!
  * Vben Admin
  * Version: ${version}
  * Author: vben
  * Copyright (C) 2024 Vben
  * License: MIT License
  * Description: ${description}
  * Date Created: ${date}
  * Homepage: ${homepage}
  * Contact: ann.vben@gmail.com
*/
              `.trim();

        for (const [, fileContent] of Object.entries(bundle)) {
          if (fileContent.type === 'chunk' && fileContent.isEntry) {
            const chunkContent = fileContent as OutputChunk;
            // 插入版权信息
            const content = chunkContent.code;
            const updatedContent = `${copyrightText}${EOL}${content}`;

            // 更新bundle
            (fileContent as OutputChunk).code = updatedContent;
          }
        }
      },
      order: 'post',
    },
    name: 'vite:license',
  };
}

export { viteLicensePlugin };
