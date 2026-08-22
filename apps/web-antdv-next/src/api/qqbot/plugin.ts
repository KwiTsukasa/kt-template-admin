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

  export interface PackageValidationResult extends ManifestValidationResult {
    packageHash: string;
    packagePath: string;
    packageSizeBytes?: number;
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
    accountName: string;
    bound: boolean;
    connectionMode: QqbotApi.ConnectionMode;
    createTime?: string;
    enabled: boolean;
    id: null | string;
    pluginId: string;
    pluginKey: string;
    pluginName: string;
    selfId: string;
  }

  export interface ConfigBody {
    configKey: string;
    pluginId: string;
    value?: any;
  }

  export interface ManifestBody {
    manifest: Recordable<any>;
  }

  export interface PackageBody {
    packageHash?: string;
    packagePath: string;
  }
}

/**
 * 根据命令或事件触发模式读取可配置的 QQBot 插件。
 *
 * @param triggerMode - 用于筛选 QQBot 插件的触发模式。
 * @returns 与触发模式匹配的插件数组；没有匹配插件时为空数组。
 */
export function getQqbotPluginList(triggerMode?: QqbotApi.PluginTriggerMode) {
  return requestClient.get<QqbotApi.Plugin[]>('/qqbot/plugin/list', {
    params: { triggerMode },
  });
}

/**
 * 根据插件键与触发模式读取可绑定的插件操作。
 *
 * @param pluginKey - 目标 QQBot 插件包的稳定键名。
 * @param triggerMode - 用于筛选 QQBot 插件的触发模式。
 * @returns 与插件键和触发模式匹配的操作数组；没有匹配项时为空数组。
 */
export function getQqbotPluginOperationList(
  pluginKey?: string,
  triggerMode?: QqbotApi.PluginTriggerMode,
) {
  return requestClient.get<QqbotApi.PluginOperation[]>(
    '/qqbot/plugin/operation/list',
    { params: { pluginKey, triggerMode } },
  );
}

/**
 * 根据筛选与分页条件读取 QQBot 插件操作及所属插件信息。
 *
 * @param params - 插件操作页使用的插件、触发模式和分页条件。
 * @returns 包含插件操作记录和总数的分页结果。
 */
export function getQqbotPluginOperationPage(
  params: QqbotApi.PluginOperationQuery,
) {
  return requestClient.get<QqbotApi.PageResult<QqbotApi.PluginOperation>>(
    '/qqbot/plugin/operation/page',
    { params },
  );
}

/**
 * 根据可选插件键与触发模式读取运行健康状态。
 *
 * @param pluginKey - 目标 QQBot 插件包的稳定键名。
 * @param triggerMode - 用于筛选 QQBot 插件的触发模式。
 * @returns 与筛选条件匹配的插件健康状态数组；没有匹配插件时为空数组。
 */
export function getQqbotPluginHealth(
  pluginKey?: string,
  triggerMode?: QqbotApi.PluginTriggerMode,
) {
  return requestClient.get<QqbotApi.PluginHealth[]>('/qqbot/plugin/health', {
    params: { pluginKey, triggerMode },
  });
}

/**
 * 读取事件插件，并可按 QQBot 账号标识筛选绑定状态。
 *
 * @param selfId - 可选 NapCat QQ 号或 QQ 官方账号稳定键；缺省时返回全部事件插件。
 * @returns 与可选账号筛选匹配的事件插件数组；没有匹配项时为空数组。
 */
export function getQqbotEventPluginList(selfId?: string) {
  return requestClient.get<QqbotApi.EventPlugin[]>('/qqbot/plugin/event/list', {
    params: { selfId },
  });
}

/**
 * 把事件插件绑定到指定 QQBot 账号，并返回绑定后的插件记录。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @param pluginKey - 目标 QQBot 插件包的稳定键名。
 * @returns 绑定完成后的事件插件记录，bound 标志反映最新关系。
 */
export function bindQqbotEventPlugin(selfId: string, pluginKey: string) {
  const params = new URLSearchParams({ pluginKey, selfId });
  return requestClient.post<QqbotApi.EventPlugin>(
    `/qqbot/plugin/event/bind?${params.toString()}`,
  );
}

/**
 * 解除事件插件与指定 QQBot 账号的绑定，并返回操作确认。
 *
 * @param selfId - 目标 QQBot 账号的稳定标识。
 * @param pluginKey - 目标 QQBot 插件包的稳定键名。
 * @returns 后端成功解除事件插件绑定时返回 true，否则返回 false。
 */
export function unbindQqbotEventPlugin(selfId: string, pluginKey: string) {
  const params = new URLSearchParams({ pluginKey, selfId });
  return requestClient.post<boolean>(
    `/qqbot/plugin/event/unbind?${params.toString()}`,
  );
}

/**
 * 从后端读取插件包安装版本、安装状态与运行健康状态。
 *
 * @returns 插件包版本、安装状态和运行状态数组；尚无安装时为空数组。
 */
export function getQqbotPluginPlatformInstallations() {
  return requestClient.get<QqbotPluginPlatformApi.Installation[]>(
    '/qqbot/plugin-platform/installations',
  );
}

/**
 * 登记本地插件包路径与可选哈希，并返回清单校验和包元数据。
 *
 * @param data - 已落盘插件包路径及可选内容哈希，用于上传校验。
 * @returns 插件包路径、哈希、大小、规范化 manifest 及其有效标志。
 */
export function uploadQqbotPluginPackage(
  data: QqbotPluginPlatformApi.PackageBody,
) {
  return requestClient.post<QqbotPluginPlatformApi.PackageValidationResult>(
    '/qqbot/plugin-platform/upload',
    data,
  );
}

/**
 * 校验 QQBot 插件 manifest 结构，并返回规范化清单与有效标志。
 *
 * @param manifest - 待校验的 QQBot 插件 manifest 内容。
 * @returns 规范化后的 manifest 及其是否通过校验的标志。
 */
export function validateQqbotPluginManifest(
  manifest: QqbotPluginPlatformApi.ManifestBody['manifest'],
) {
  return requestClient.post<QqbotPluginPlatformApi.ManifestValidationResult>(
    '/qqbot/plugin-platform/validate',
    { manifest },
  );
}

/**
 * 提交已上传的 QQBot 插件包进行安装，并返回新建的平台安装记录。
 *
 * @param data - 已上传插件包路径及可选内容哈希，用于创建平台安装。
 * @returns 服务端创建或更新后的 QQBot 插件安装记录。
 */
export function installQqbotPluginPackage(
  data: QqbotPluginPlatformApi.PackageBody,
) {
  return requestClient.post<QqbotPluginPlatformApi.Installation>(
    '/qqbot/plugin-platform/install',
    data,
  );
}

/**
 * 提交 NAS 本地插件包路径进行安装，并返回新建的平台安装记录。
 *
 * @param data - NAS 本地插件包路径及可选内容哈希。
 * @returns 服务端创建或更新后的 QQBot 插件安装记录。
 */
export function installLocalQqbotPluginPackage(
  data: QqbotPluginPlatformApi.PackageBody,
) {
  return requestClient.post<QqbotPluginPlatformApi.Installation>(
    '/qqbot/plugin-platform/install-local',
    data,
  );
}

/**
 * 启用指定插件安装，并返回安装标识与最新状态。
 *
 * @param id - 需要启动运行态的插件安装标识。
 * @returns 已启用的安装标识及后端确认的最新状态。
 */
export function enableQqbotPluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/qqbot/plugin-platform/enable',
    { id },
  );
}

/**
 * 停用指定插件安装，并返回安装标识与最新状态。
 *
 * @param id - 需要停止运行态的插件安装标识。
 * @returns 已停用的安装标识及后端确认的最新状态。
 */
export function disableQqbotPluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/qqbot/plugin-platform/disable',
    { id },
  );
}

/**
 * 升级指定 QQBot 插件安装，并返回安装标识与最新状态。
 *
 * @param id - 需要升级到可用新版本的插件安装标识。
 * @returns 升级后的插件安装标识与后端确认状态。
 */
export function upgradeQqbotPluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/qqbot/plugin-platform/upgrade',
    { id },
  );
}

/**
 * 卸载指定插件安装，并返回安装标识与卸载状态。
 *
 * @param id - 需要卸载并清理运行态的插件安装标识。
 * @returns 被卸载的安装标识及后端确认的卸载状态。
 */
export function uninstallQqbotPluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/qqbot/plugin-platform/uninstall',
    { id },
  );
}

/**
 * 保存指定插件的配置键和值，并返回持久化后的配置项。
 *
 * @param data - 插件标识、配置键及其待保存值。
 * @returns 后端保存后的插件标识、配置键和值。
 */
export function updateQqbotPluginConfig(
  data: QqbotPluginPlatformApi.ConfigBody,
) {
  return requestClient.post<QqbotPluginPlatformApi.ConfigBody>(
    '/qqbot/plugin-platform/config',
    data,
  );
}

/**
 * 读取插件运行事件，并可按插件实例筛选错误、警告和信息记录。
 *
 * @param pluginId - 目标 QQBot 插件运行实例的唯一标识。
 * @returns 与可选插件筛选匹配的运行事件数组；没有事件时为空数组。
 */
export function getQqbotPluginRuntimeEvents(pluginId?: string) {
  return requestClient.get<QqbotPluginPlatformApi.RuntimeEvent[]>(
    '/qqbot/plugin-platform/runtime-events',
    {
      params: { pluginId },
    },
  );
}

/**
 * 读取插件与 QQBot 账号的绑定，并可按插件实例筛选。
 *
 * @param pluginId - 目标 QQBot 插件运行实例的唯一标识。
 * @returns 与可选插件筛选匹配的账号绑定数组；没有绑定时为空数组。
 */
export function getQqbotPluginAccountBindings(pluginId?: string) {
  return requestClient.get<QqbotPluginPlatformApi.AccountBinding[]>(
    '/qqbot/plugin-platform/account-bindings',
    {
      params: { pluginId },
    },
  );
}

/**
 * 把 NapCat 或 QQ 官方账号绑定到指定插件平台记录。
 *
 * @param accountId - QQBot 账号主键。
 * @param pluginId - 插件主键。
 * @returns 后端完成平台绑定时返回 true。
 */
export function bindQqbotPluginAccount(accountId: string, pluginId: string) {
  return requestClient.post<boolean>(
    '/qqbot/plugin-platform/account-bindings/bind',
    { accountId, pluginId },
  );
}

/**
 * 将 NapCat 或 QQ 官方账号的现有插件行标记为停用而不删除，使相同组合可再次幂等绑定。
 *
 * @param accountId - QQBot 账号主键。
 * @param pluginId - 插件主键。
 * @returns 后端完成平台解绑时返回 true。
 */
export function unbindQqbotPluginAccount(accountId: string, pluginId: string) {
  return requestClient.post<boolean>(
    '/qqbot/plugin-platform/account-bindings/unbind',
    { accountId, pluginId },
  );
}
