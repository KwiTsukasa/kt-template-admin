import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const UNIT_TEST_FILE_PATTERN =
  /\.(?:spec|test)\.(?:[cm]?[jt]sx?|vue)$|\/__(?:snapshots|tests)__\//;
const ALLOWED_TEST_ROOTS = new Set([
  'api',
  'components',
  'governance',
  'internal',
  'packages',
  'router',
  'store',
  'views',
]);
const ALLOWED_TEST_ROOT_FILES = new Set(['test/tsconfig.json']);

describe('单元测试目录约束', () => {
  it('只允许在仓库根目录 test 下存放单元测试', () => {
    const repositoryFiles = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard'],
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter((file) => file && existsSync(file));
    const scatteredUnitTests = repositoryFiles.filter(
      (file) =>
        !file.startsWith('test/') && UNIT_TEST_FILE_PATTERN.test(`/${file}`),
    );

    expect(scatteredUnitTests).toEqual([]);
  });

  it('禁止在 test 下复制源码目录或保留旧测试目录层级', () => {
    const testFiles = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', 'test'],
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter((file) => file && existsSync(file));
    const invalidTestFiles = testFiles.filter((file) => {
      if (ALLOWED_TEST_ROOT_FILES.has(file)) return false;
      const [, root] = file.split('/');
      return (
        !root ||
        !ALLOWED_TEST_ROOTS.has(root) ||
        file.includes('/src/') ||
        file.includes('/__tests__/')
      );
    });

    expect(invalidTestFiles).toEqual([]);
  });
});
