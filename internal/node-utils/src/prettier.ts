import fs from 'node:fs/promises';

import { format, getFileInfo, resolveConfig } from 'prettier';

/**
 * 使用仓库 Prettier 配置格式化目标文件内容，并返回格式化后的文本。
 *
 * @param filepath - 要读取仓库配置、格式化内容并在变化时写回的文件路径。
 * @returns 按推断解析器格式化后的文件文本；内容变化时该文本也已写回文件。
 */
async function prettierFormat(filepath: string) {
  const prettierOptions = await resolveConfig(filepath, {});

  const fileInfo = await getFileInfo(filepath);

  const input = await fs.readFile(filepath, 'utf8');
  const output = await format(input, {
    ...prettierOptions,
    parser: fileInfo.inferredParser as any,
  });
  if (output !== input) {
    await fs.writeFile(filepath, output, 'utf8');
  }
  return output;
}

export { prettierFormat };
