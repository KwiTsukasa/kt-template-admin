import type { QqbotApi } from '#/api/qqbot';

export interface QqbotPluginMetadata {
  pluginMap: Record<string, QqbotApi.Plugin>;
  pluginOptions: Array<{ label: string; value: string }>;
}

export interface LoadQqbotPluginMetadataOptions {
  labelOf: (value: unknown, fallback?: string) => string;
  loadPlugins: () => Promise<QqbotApi.Plugin[]>;
  onError?: (error: unknown) => void;
  reloadTriggerModes: () => Promise<unknown>;
}

export async function loadQqbotPluginMetadata(
  options: LoadQqbotPluginMetadataOptions,
): Promise<QqbotPluginMetadata> {
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
  const pluginMap: Record<string, QqbotApi.Plugin> = {};
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
