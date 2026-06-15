import type { Recordable } from '@vben/types';

import type { QqbotApi } from './index';

import { requestClient } from '#/api/request';

export namespace QqbotPluginPlatformApi {
  export type InstallStatus =
    | 'disabled'
    | 'enabled'
    | 'failed'
    | 'installed'
    | 'uninstalled'
    | 'uploaded'
    | 'validated';

  export type RuntimeStatus =
    | 'crashed'
    | 'healthy'
    | 'starting'
    | 'stopped'
    | 'unhealthy';

  export interface ManifestValidationResult {
    manifest: Recordable<any>;
    valid: boolean;
  }

  export interface Installation {
    createTime?: string;
    id: string;
    installedPath?: string;
    pluginId: string;
    runtimeStatus: RuntimeStatus;
    status: InstallStatus;
    updateTime?: string;
    versionId: string;
  }

  export interface RuntimeEvent {
    createTime?: string;
    eventType: string;
    id: string;
    installationId?: null | string;
    level: 'error' | 'info' | 'warn';
    pluginId: string;
    safeSummary?: Recordable<any>;
  }

  export interface AccountBinding {
    accountId: string;
    createTime?: string;
    enabled: boolean;
    id: string;
    pluginId: string;
  }

  export interface ConfigBody {
    configKey: string;
    pluginId: string;
    value?: any;
  }

  export interface PackageBody {
    manifest: Recordable<any>;
    packageHash?: string;
    packagePath?: string;
  }
}

export function getQqbotPluginList(triggerMode?: QqbotApi.PluginTriggerMode) {
  return requestClient.get<QqbotApi.Plugin[]>('/qqbot/plugin/list', {
    params: { triggerMode },
  });
}

export function getQqbotPluginOperationList(
  pluginKey?: string,
  triggerMode?: QqbotApi.PluginTriggerMode,
) {
  return requestClient.get<QqbotApi.PluginOperation[]>(
    '/qqbot/plugin/operation/list',
    { params: { pluginKey, triggerMode } },
  );
}

export function getQqbotPluginOperationPage(
  params: QqbotApi.PluginOperationQuery,
) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.PluginOperation>>(
    '/qqbot/plugin/operation/page',
    { params },
  );
}

export function getQqbotPluginHealth(
  pluginKey?: string,
  triggerMode?: QqbotApi.PluginTriggerMode,
) {
  return requestClient.get<QqbotApi.PluginHealth[]>('/qqbot/plugin/health', {
    params: { pluginKey, triggerMode },
  });
}

export function getQqbotEventPluginList(params?: { selfId?: string }) {
  return requestClient.get<QqbotApi.EventPlugin[]>('/qqbot/plugin/event/list', {
    params,
  });
}

export function bindQqbotEventPlugin(selfId: string, pluginKey: string) {
  const params = new URLSearchParams({ pluginKey, selfId });
  return requestClient.post<QqbotApi.EventPlugin>(
    `/qqbot/plugin/event/bind?${params.toString()}`,
  );
}

export function unbindQqbotEventPlugin(selfId: string, pluginKey: string) {
  const params = new URLSearchParams({ pluginKey, selfId });
  return requestClient.post<boolean>(
    `/qqbot/plugin/event/unbind?${params.toString()}`,
  );
}

export function getQqbotPluginPlatformInstallations() {
  return requestClient.get<QqbotPluginPlatformApi.Installation[]>(
    '/qqbot/plugin-platform/installations',
  );
}

export function uploadQqbotPluginPackage(
  data: QqbotPluginPlatformApi.PackageBody,
) {
  return requestClient.post<QqbotPluginPlatformApi.ManifestValidationResult>(
    '/qqbot/plugin-platform/upload',
    data,
  );
}

export function validateQqbotPluginManifest(
  manifest: QqbotPluginPlatformApi.PackageBody['manifest'],
) {
  return requestClient.post<QqbotPluginPlatformApi.ManifestValidationResult>(
    '/qqbot/plugin-platform/validate',
    { manifest },
  );
}

export function installQqbotPluginPackage(
  data: QqbotPluginPlatformApi.PackageBody,
) {
  return requestClient.post<QqbotPluginPlatformApi.Installation>(
    '/qqbot/plugin-platform/install',
    data,
  );
}

export function installLocalQqbotPluginPackage(
  data: QqbotPluginPlatformApi.PackageBody,
) {
  return requestClient.post<QqbotPluginPlatformApi.Installation>(
    '/qqbot/plugin-platform/install-local',
    data,
  );
}

export function enableQqbotPluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/qqbot/plugin-platform/enable',
    { id },
  );
}

export function disableQqbotPluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/qqbot/plugin-platform/disable',
    { id },
  );
}

export function upgradeQqbotPluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/qqbot/plugin-platform/upgrade',
    { id },
  );
}

export function uninstallQqbotPluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/qqbot/plugin-platform/uninstall',
    { id },
  );
}

export function updateQqbotPluginConfig(
  data: QqbotPluginPlatformApi.ConfigBody,
) {
  return requestClient.post<QqbotPluginPlatformApi.ConfigBody>(
    '/qqbot/plugin-platform/config',
    data,
  );
}

export function getQqbotPluginRuntimeEvents(pluginId?: string) {
  return requestClient.get<QqbotPluginPlatformApi.RuntimeEvent[]>(
    '/qqbot/plugin-platform/runtime-events',
    {
      params: { pluginId },
    },
  );
}

export function getQqbotPluginAccountBindings(pluginId?: string) {
  return requestClient.get<QqbotPluginPlatformApi.AccountBinding[]>(
    '/qqbot/plugin-platform/account-bindings',
    {
      params: { pluginId },
    },
  );
}
