import type { ApplicationPluginOptions } from '../typing';

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { fs } from '@vben/node-utils';

import dotenv from 'dotenv';

const getBoolean = (value: string | undefined) => value === 'true';

const getString = (value: string | undefined, fallback: string) =>
  value ?? fallback;

const getNumber = (value: string | undefined, fallback: number) =>
  Number(value) || fallback;

/**
 * 从 npm 生命周期脚本解析构建模式，并按基础、本地、模式、模式本地的覆盖顺序列出环境文件。
 *
 * @returns 按当前 mode 与环境层级排列的配置文件名数组。
 */
function getConfFiles() {
  const script = process.env.npm_lifecycle_script as string;
  const reg = /--mode ([\d_a-z]+)/;
  const result = reg.exec(script);
  let mode = 'production';
  if (result) {
    mode = result[1] as string;
  }
  return ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`];
}

/**
 * 合并指定环境文件与进程变量，只保留匹配前缀的键；单个文件解析失败不阻断其他来源。
 *
 * @param match - 正则处理得到的匹配结果；未传入时使用 `'VITE_GLOB_'`。
 * @param confFiles - 需要传给构建工具处理的配置文件列表；未传入时使用 `getConfFiles()`。
 * @returns 由环境文件和进程变量合并、且仅包含指定前缀键的环境对象。
 */
async function loadEnv<T = Record<string, string>>(
  match = 'VITE_GLOB_',
  confFiles = getConfFiles(),
) {
  let envConfig = {};
  const reg = new RegExp(`^(${match})`);

  for (const confFile of confFiles) {
    try {
      const confFilePath = join(process.cwd(), confFile);
      if (existsSync(confFilePath)) {
        const envPath = await fs.readFile(confFilePath, {
          encoding: 'utf8',
        });
        const env = dotenv.parse(envPath);
        envConfig = { ...envConfig, ...env };
      }
    } catch (error) {
      console.error(`Error while parsing ${confFile}`, error);
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (reg.test(key) && value !== undefined) {
      envConfig = { ...envConfig, [key]: value };
    }
  }

  Object.keys(envConfig).forEach((key) => {
    if (!reg.test(key)) {
      Reflect.deleteProperty(envConfig, key);
    }
  });
  return envConfig as T;
}

/**
 * 读取 Vite 环境变量并转换为应用标题、端口、压缩类型及插件开关。
 *
 * @param match - 正则处理得到的匹配结果；未传入时使用 `'VITE_'`。
 * @param confFiles - 需要传给构建工具处理的配置文件列表；未传入时使用 `getConfFiles()`。
 * @returns 包含应用标题、基础路径、端口、压缩类型及各插件布尔开关的配置。
 */
async function loadAndConvertEnv(
  match = 'VITE_',
  confFiles = getConfFiles(),
): Promise<
  Partial<ApplicationPluginOptions> & {
    appTitle: string;
    base: string;
    port: number;
  }
> {
  const envConfig = await loadEnv(match, confFiles);

  const {
    VITE_APP_TITLE,
    VITE_ARCHIVER,
    VITE_BASE,
    VITE_COMPRESS,
    VITE_DEVTOOLS,
    VITE_INJECT_APP_LOADING,
    VITE_NITRO_MOCK,
    VITE_PORT,
    VITE_PWA,
    VITE_VISUALIZER,
  } = envConfig;

  const compressTypes = (VITE_COMPRESS ?? '')
    .split(',')
    .filter((item) => item === 'brotli' || item === 'gzip');

  return {
    appTitle: getString(VITE_APP_TITLE, 'Vben Admin'),
    archiver: getBoolean(VITE_ARCHIVER),
    base: getString(VITE_BASE, '/'),
    compress: compressTypes.length > 0,
    compressTypes,
    devtools: getBoolean(VITE_DEVTOOLS),
    injectAppLoading: getBoolean(VITE_INJECT_APP_LOADING),
    nitroMock: getBoolean(VITE_NITRO_MOCK),
    port: getNumber(VITE_PORT, 5173),
    pwa: getBoolean(VITE_PWA),
    visualizer: getBoolean(VITE_VISUALIZER),
  };
}

export { loadAndConvertEnv, loadEnv };
