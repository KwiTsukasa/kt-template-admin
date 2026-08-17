import type { PluginOption } from 'vite';

import {
  dateUtil,
  findMonorepoRoot,
  getPackages,
  readPackageJSON,
} from '@vben/node-utils';

import { readWorkspaceManifest } from '@pnpm/workspace.read-manifest';

/**
 * 把 catalog 或 workspace 依赖协议解析为映射中的版本，普通版本字符串保持原样。
 *
 * @param pkgsMeta - 工作区包名到实际版本的映射，用于解析 workspace 协议。
 * @param name - 正在解析版本的依赖包名称，用于查找 catalog 或工作区映射。
 * @param value - package.json 中的版本声明；普通版本原样返回。
 * @param catalog - catalog 依赖名到实际版本的映射，用于解析 catalog 协议。
 * @returns catalog 或 workspace 映射中的版本，普通声明原样返回；映射缺少包名时为 undefined。
 */
function resolvePackageVersion(
  pkgsMeta: Record<string, string>,
  name: string,
  value: string,
  catalog: Record<string, string>,
) {
  if (value.includes('catalog:')) {
    return catalog[name];
  }

  if (value.includes('workspace')) {
    return pkgsMeta[name];
  }

  return value;
}

/**
 * 汇总工作区全部包依赖，并把 catalog 与 workspace 协议解析为实际版本。
 *
 * @returns 工作区依赖名到解析后实际版本的映射。
 */
async function resolveMonorepoDependencies() {
  const { packages } = await getPackages();
  const manifest = await readWorkspaceManifest(findMonorepoRoot());
  const catalog = manifest?.catalog || {};

  const resultDevDependencies: Record<string, string | undefined> = {};
  const resultDependencies: Record<string, string | undefined> = {};
  const pkgsMeta: Record<string, string> = {};

  for (const { packageJson } of packages) {
    pkgsMeta[packageJson.name] = packageJson.version;
  }

  for (const { packageJson } of packages) {
    const { dependencies = {}, devDependencies = {} } = packageJson;
    for (const [key, value] of Object.entries(dependencies)) {
      resultDependencies[key] = resolvePackageVersion(
        pkgsMeta,
        key,
        value,
        catalog,
      );
    }
    for (const [key, value] of Object.entries(devDependencies)) {
      resultDevDependencies[key] = resolvePackageVersion(
        pkgsMeta,
        key,
        value,
        catalog,
      );
    }
  }
  return {
    dependencies: resultDependencies,
    devDependencies: resultDevDependencies,
  };
}

/**
 * 在构建阶段把包名、版本和构建时间注入应用元数据。
 *
 * @param root - Vite 项目根目录，用来读取包信息或版权文件；未传入时使用 `process.cwd()`。
 * @returns 向 Vite define 注入版本、作者、依赖与构建时间的插件。
 */
async function viteMetadataPlugin(
  root = process.cwd(),
): Promise<PluginOption | undefined> {
  const { author, description, homepage, license, version } =
    await readPackageJSON(root);

  const buildTime = dateUtil().format('YYYY-MM-DD HH:mm:ss');

  return {
    /**
     * 解析工作区依赖与包信息，并生成注入应用版本、作者及构建时间的 Vite define 配置。
     *
     * @returns 通过 `define` 注入应用版本与构建元数据的 Vite 配置片段。
     */
    async config() {
      const { dependencies, devDependencies } =
        await resolveMonorepoDependencies();

      const isAuthorObject = typeof author === 'object';
      const authorName = (() => {
        if (isAuthorObject) {
          return author.name;
        }
        return author;
      })();
      const authorEmail = (() => {
        if (isAuthorObject) {
          return author.email;
        }
        return null;
      })();
      const authorUrl = (() => {
        if (isAuthorObject) {
          return author.url;
        }
        return null;
      })();

      return {
        define: {
          __VBEN_ADMIN_METADATA__: JSON.stringify({
            authorEmail,
            authorName,
            authorUrl,
            buildTime,
            dependencies,
            description,
            devDependencies,
            homepage,
            license,
            version,
          }),
          'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
        },
      };
    },
    enforce: 'post',
    name: 'vite:inject-metadata',
  };
}

export { viteMetadataPlugin };
