import type { PluginPlatformApi } from '#/api/plugin-platform/plugin';

export interface PluginMetadata {
  pluginMap: Record<string, PluginPlatformApi.Plugin>;
  pluginOptions: Array<{ label: string; value: string }>;
}

export interface LoadPluginMetadataOptions {
  labelOf: (value: unknown, fallback?: string) => string;
  loadPlugins: () => Promise<PluginPlatformApi.Plugin[]>;
  onError?: (error: unknown) => void;
  reloadTriggerModes: () => Promise<unknown>;
}

/**
 * 容错加载协议插件和触发模式，返回按键索引及可直接用于下拉框的选项。
 *
 * @param options - 限制加载命令或事件插件的可选触发模式。
 * @returns 包含插件键索引与下拉选项的元数据；插件加载失败时两者均为空。
 */
export async function loadPluginMetadata(
  options: LoadPluginMetadataOptions,
): Promise<PluginMetadata> {
  const [plugins] = await Promise.all([
    options.loadPlugins().catch((error: unknown) => {
      options.onError?.(error);
      return [];
    }),
    options.reloadTriggerModes().catch((error: unknown) => {
      options.onError?.(error);
      return [];
    }),
  ]);
  const pluginMap: Record<string, PluginPlatformApi.Plugin> = {};
  for (const item of plugins) {
    pluginMap[item.key] = item;
  }

  return {
    pluginMap,
    pluginOptions: plugins.map((item) => ({
      label: `${item.name} (${item.key} / ${options.labelOf(item.triggerMode, '-')})`,
      value: item.key,
    })),
  };
}
