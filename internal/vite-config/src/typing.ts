import type { PluginVisualizerOptions } from 'rollup-plugin-visualizer';
// prettier-ignore
import type {
  ConfigEnv,
  UserConfig,
  UserConfigFnPromise,
} from 'vite';
import type { PluginOptions } from 'vite-plugin-dts';
import type { Options as PwaPluginOptions } from 'vite-plugin-pwa';

interface IImportMap {
  imports?: Record<string, string>;
  scopes?: {
    [scope: string]: Record<string, string>;
  };
}

interface PrintPluginOptions {
  infoMap?: Record<string, string | undefined>;
}

interface NitroMockPluginOptions {
  mockServerPackage?: string;

  port?: number;

  verbose?: boolean;
}

interface ArchiverPluginOptions {
  name?: string;
  outputDir?: string;
}

interface ImportmapPluginOptions {
  defaultProvider?: 'esm.sh' | 'jspm.io';
  importmap?: Array<{ name: string; range?: string }>;
  inputMap?: IImportMap;
}

interface ConditionPlugin {
  condition?: boolean;
  plugins: () => PromiseLike<unknown[]> | unknown[];
}

interface CommonPluginOptions {
  devtools?: boolean;
  env?: Record<string, any>;
  injectMetadata?: boolean;
  isBuild?: boolean;
  mode?: string;
  visualizer?: boolean | PluginVisualizerOptions;
}

interface ApplicationPluginOptions extends CommonPluginOptions {
  appTitle?: string;
  archiver?: boolean;
  archiverPluginOptions?: ArchiverPluginOptions;
  compress?: boolean;
  compressTypes?: ('brotli' | 'gzip')[];
  extraAppConfig?: boolean;
  html?: boolean;
  i18n?: boolean;
  importmap?: boolean;
  importmapOptions?: ImportmapPluginOptions;
  injectAppLoading?: boolean;
  injectGlobalScss?: boolean;
  license?: boolean;
  nitroMock?: boolean;
  nitroMockOptions?: NitroMockPluginOptions;
  print?: boolean;
  printInfoMap?: PrintPluginOptions['infoMap'];
  pwa?: boolean;
  pwaOptions?: Partial<PwaPluginOptions>;
}

interface LibraryPluginOptions extends CommonPluginOptions {
  dts?: boolean | PluginOptions;
}

type ApplicationOptions = ApplicationPluginOptions;

type LibraryOptions = LibraryPluginOptions;

type DefineApplicationOptions = (config?: ConfigEnv) => Promise<{
  application?: ApplicationOptions;
  vite?: UserConfig;
}>;

type DefineLibraryOptions = (config?: ConfigEnv) => Promise<{
  library?: LibraryOptions;
  vite?: UserConfig;
}>;

type DefineConfig = DefineApplicationOptions | DefineLibraryOptions;

type VbenViteConfig = Promise<UserConfig> | UserConfig | UserConfigFnPromise;

export type {
  ApplicationPluginOptions,
  ArchiverPluginOptions,
  CommonPluginOptions,
  ConditionPlugin,
  DefineApplicationOptions,
  DefineConfig,
  DefineLibraryOptions,
  IImportMap,
  ImportmapPluginOptions,
  LibraryPluginOptions,
  NitroMockPluginOptions,
  PrintPluginOptions,
  VbenViteConfig,
};
