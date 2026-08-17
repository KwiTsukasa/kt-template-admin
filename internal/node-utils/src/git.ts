import path from 'node:path';

import { execa } from 'execa';

/**
 * 通过 Git diff 读取已暂存文件路径，并统一转换为正斜杠。
 *
 * @returns Git 暂存区内的 POSIX 风格文件路径数组；没有暂存文件时为空数组。
 */
async function getStagedFiles(): Promise<string[]> {
  try {
    const { stdout } = await execa('git', [
      '-c',
      'submodule.recurse=false',
      'diff',
      '--staged',
      '--diff-filter=ACMR',
      '--name-only',
      '--ignore-submodules',
      '-z',
    ]);

    let changedList = (() => {
      if (stdout) {
        return stdout.replace(/\0$/, '').split('\0');
      }
      return [];
    })();
    changedList = changedList.map((item) => path.resolve(process.cwd(), item));
    const changedSet = new Set(changedList);
    changedSet.delete('');
    return [...changedSet];
  } catch (error) {
    console.error('Failed to get staged files:', error);
    return [];
  }
}

export { getStagedFiles };
