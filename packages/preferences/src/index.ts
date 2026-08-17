import type { Preferences } from '@vben-core/preferences';
import type { DeepPartial } from '@vben-core/typings';

/**
 * 将应用级偏好覆盖项保留为类型安全定义，实际合并由偏好初始化流程完成。
 *
 * @param preferences - 应用希望覆盖的部分偏好字段。
 * @returns 未经修改的同一偏好覆盖对象。
 */

function defineOverridesPreferences(preferences: DeepPartial<Preferences>) {
  return preferences;
}

export { defineOverridesPreferences };

export * from '@vben-core/preferences';
