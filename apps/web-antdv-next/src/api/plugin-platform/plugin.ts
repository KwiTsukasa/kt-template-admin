import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace PluginPlatformApi {
  export type PluginTriggerMode = 'command' | 'event';

  export interface PageResult<T> {
    list: T[];
    pageNo?: number;
    pageSize?: number;
    total: number;
  }

  export interface Plugin {
    description?: string;
    key: string;
    name: string;
    operationCount: number;
    triggerMode: PluginTriggerMode;
    version: string;
  }

  export interface PluginOperation {
    cacheTtlMs?: number;
    description?: string;
    inputSchema?: Recordable<any>;
    key: string;
    name: string;
    outputSchema?: Recordable<any>;
    pluginKey: string;
    triggerMode: PluginTriggerMode;
  }

  export interface PluginOperationQuery extends Recordable<any> {
    pageNo?: number;
    pageSize?: number;
    pluginKey?: string;
    triggerMode?: PluginTriggerMode;
  }

  export interface PluginHealth {
    checkedAt: string;
    message?: string;
    name?: string;
    pluginKey?: string;
    status: 'degraded' | 'healthy' | 'offline';
    triggerMode?: PluginTriggerMode;
  }

  export interface EventPluginDefinition {
    description?: string;
    key: string;
    name: string;
    remark?: string;
    triggerType: 'message';
    version: string;
  }

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
 * 根据命令或事件触发模式读取可配置的协议插件。
 *
 * @param triggerMode - 用于筛选协议插件的触发模式。
 * @returns 与触发模式匹配的插件数组；没有匹配插件时为空数组。
 */
export function getPluginList(
  triggerMode?: PluginPlatformApi.PluginTriggerMode,
) {
  return requestClient.get<PluginPlatformApi.Plugin[]>(
    '/plugin-platform/catalog/list',
    {
      params: { triggerMode },
    },
  );
}

/**
 * 根据插件键与触发模式读取可绑定的插件操作。
 *
 * @param pluginKey - 目标插件包的稳定键名。
 * @param triggerMode - 用于筛选协议插件的触发模式。
 * @returns 与插件键和触发模式匹配的操作数组；没有匹配项时为空数组。
 */
export function getPluginOperationList(
  pluginKey?: string,
  triggerMode?: PluginPlatformApi.PluginTriggerMode,
) {
  return requestClient.get<PluginPlatformApi.PluginOperation[]>(
    '/plugin-platform/catalog/operation/list',
    { params: { pluginKey, triggerMode } },
  );
}

/**
 * 根据筛选与分页条件读取插件操作及所属插件信息。
 *
 * @param params - 插件操作页使用的插件、触发模式和分页条件。
 * @returns 包含插件操作记录和总数的分页结果。
 */
export function getPluginOperationPage(
  params: PluginPlatformApi.PluginOperationQuery,
) {
  return requestClient.get<
    PluginPlatformApi.PageResult<PluginPlatformApi.PluginOperation>
  >('/plugin-platform/catalog/operation/page', { params });
}

/**
 * 根据可选插件键与触发模式读取运行健康状态。
 *
 * @param pluginKey - 目标插件包的稳定键名。
 * @param triggerMode - 用于筛选协议插件的触发模式。
 * @returns 与筛选条件匹配的插件健康状态数组；没有匹配插件时为空数组。
 */
export function getPluginHealth(
  pluginKey?: string,
  triggerMode?: PluginPlatformApi.PluginTriggerMode,
) {
  return requestClient.get<PluginPlatformApi.PluginHealth[]>(
    '/plugin-platform/catalog/health',
    {
      params: { pluginKey, triggerMode },
    },
  );
}

/**
 * 读取平台无关事件插件定义，不包含任何 Bot 账号绑定状态。
 * @returns 当前启用的事件插件数组。
 */
export function getEventPluginList() {
  return requestClient.get<PluginPlatformApi.EventPluginDefinition[]>(
    '/plugin-platform/catalog/event/list',
  );
}

/**
 * 从后端读取插件包安装版本、安装状态与运行健康状态。
 *
 * @returns 插件包版本、安装状态和运行状态数组；尚无安装时为空数组。
 */
export function getPluginInstallations() {
  return requestClient.get<PluginPlatformApi.Installation[]>(
    '/plugin-platform/installations',
  );
}

/**
 * 登记本地插件包路径与可选哈希，并返回清单校验和包元数据。
 *
 * @param data - 已落盘插件包路径及可选内容哈希，用于上传校验。
 * @returns 插件包路径、哈希、大小、规范化 manifest 及其有效标志。
 */
export function uploadPluginPackage(data: PluginPlatformApi.PackageBody) {
  return requestClient.post<PluginPlatformApi.PackageValidationResult>(
    '/plugin-platform/upload',
    data,
  );
}

/**
 * 校验插件 manifest 结构，并返回规范化清单与有效标志。
 *
 * @param manifest - 待校验的插件 manifest 内容。
 * @returns 规范化后的 manifest 及其是否通过校验的标志。
 */
export function validatePluginManifest(
  manifest: PluginPlatformApi.ManifestBody['manifest'],
) {
  return requestClient.post<PluginPlatformApi.ManifestValidationResult>(
    '/plugin-platform/validate',
    { manifest },
  );
}

/**
 * 提交已上传的插件包进行安装，并返回新建的平台安装记录。
 *
 * @param data - 已上传插件包路径及可选内容哈希，用于创建平台安装。
 * @returns 服务端创建或更新后的插件安装记录。
 */
export function installPluginPackage(data: PluginPlatformApi.PackageBody) {
  return requestClient.post<PluginPlatformApi.Installation>(
    '/plugin-platform/install',
    data,
  );
}

/**
 * 提交 NAS 本地插件包路径进行安装，并返回新建的平台安装记录。
 *
 * @param data - NAS 本地插件包路径及可选内容哈希。
 * @returns 服务端创建或更新后的插件安装记录。
 */
export function installLocalPluginPackage(data: PluginPlatformApi.PackageBody) {
  return requestClient.post<PluginPlatformApi.Installation>(
    '/plugin-platform/install-local',
    data,
  );
}

/**
 * 启用指定插件安装，并返回安装标识与最新状态。
 *
 * @param id - 需要启动运行态的插件安装标识。
 * @returns 已启用的安装标识及后端确认的最新状态。
 */
export function enablePluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/plugin-platform/enable',
    { id },
  );
}

/**
 * 停用指定插件安装，并返回安装标识与最新状态。
 *
 * @param id - 需要停止运行态的插件安装标识。
 * @returns 已停用的安装标识及后端确认的最新状态。
 */
export function disablePluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/plugin-platform/disable',
    { id },
  );
}

/**
 * 升级指定插件安装，并返回安装标识与最新状态。
 *
 * @param id - 需要升级到可用新版本的插件安装标识。
 * @returns 升级后的插件安装标识与后端确认状态。
 */
export function upgradePluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/plugin-platform/upgrade',
    { id },
  );
}

/**
 * 卸载指定插件安装，并返回安装标识与卸载状态。
 *
 * @param id - 需要卸载并清理运行态的插件安装标识。
 * @returns 被卸载的安装标识及后端确认的卸载状态。
 */
export function uninstallPluginInstallation(id: string) {
  return requestClient.post<{ id: string; status: string }>(
    '/plugin-platform/uninstall',
    { id },
  );
}

/**
 * 保存指定插件的配置键和值，并返回持久化后的配置项。
 *
 * @param data - 插件标识、配置键及其待保存值。
 * @returns 后端保存后的插件标识、配置键和值。
 */
export function updatePluginConfig(data: PluginPlatformApi.ConfigBody) {
  return requestClient.post<PluginPlatformApi.ConfigBody>(
    '/plugin-platform/config',
    data,
  );
}

/**
 * 读取插件运行事件，并可按插件实例筛选错误、警告和信息记录。
 *
 * @param pluginId - 目标 Bot 插件运行实例的唯一标识。
 * @returns 与可选插件筛选匹配的运行事件数组；没有事件时为空数组。
 */
export function getPluginRuntimeEvents(pluginId?: string) {
  return requestClient.get<PluginPlatformApi.RuntimeEvent[]>(
    '/plugin-platform/runtime-events',
    {
      params: { pluginId },
    },
  );
}
