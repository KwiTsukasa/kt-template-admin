import { dirname } from 'node:path';

import {
  getPackages as getPackagesFunc,
  getPackagesSync as getPackagesSyncFunc,
} from '@manypkg/get-packages';
import { findUpSync } from 'find-up';

/**
 * 从指定目录向上查找 pnpm-workspace.yaml，并返回工作区根路径。
 *
 * @param cwd - 开始向上查找 pnpm 工作区根目录的路径；未传入时使用 `process.cwd()`。
 * @returns 最近一级包含 pnpm-workspace.yaml 的目录路径。
 */
function findMonorepoRoot(cwd: string = process.cwd()) {
  const lockFile = findUpSync('pnpm-lock.yaml', {
    cwd,
    type: 'file',
  });
  return dirname(lockFile || '');
}

/**
 * 从当前 pnpm 工作区同步读取全部包清单。
 *
 * @returns 同步扫描得到的工作区包与 package.json 信息。
 */
function getPackagesSync() {
  const root = findMonorepoRoot();
  return getPackagesSyncFunc(root);
}

/**
 * 从当前 pnpm 工作区异步读取全部包清单。
 *
 * @returns 异步扫描得到的工作区包与 package.json 信息。
 */
async function getPackages() {
  const root = findMonorepoRoot();

  return await getPackagesFunc(root);
}

/**
 * 从工作区包清单中按名称查找目标包；未匹配时返回 undefined。
 *
 * @param pkgName - 需要从工作区包列表中匹配的包名。
 * @returns 名称匹配的工作区包；未找到时为 undefined。
 */
async function getPackage(pkgName: string) {
  const { packages } = await getPackages();
  return packages.find((pkg) => pkg.packageJson.name === pkgName);
}

export { findMonorepoRoot, getPackage, getPackages, getPackagesSync };
