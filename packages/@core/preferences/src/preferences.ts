import type { DeepPartial } from '@vben-core/typings';

import type { InitialOptions, Preferences } from './types';

import { markRaw, reactive, readonly, watch } from 'vue';

import { StorageManager } from '@vben-core/shared/cache';
import { isMacOs, merge } from '@vben-core/shared/utils';

import {
  breakpointsTailwind,
  useBreakpoints,
  useDebounceFn,
} from '@vueuse/core';

import { defaultPreferences } from './config';
import { updateCSSVariables } from './update-css-variables';

const STORAGE_KEYS = {
  MAIN: 'preferences',
  LOCALE: 'preferences-locale',
  THEME: 'preferences-theme',
} as const;

class PreferenceManager {
  private cache: StorageManager;
  private debouncedSave: (preference: Preferences) => void;
  private initialPreferences: Preferences = defaultPreferences;
  private isInitialized = false;
  private state: Preferences;

  constructor() {
    this.cache = new StorageManager();
    this.state = reactive<Preferences>(
      this.loadFromCache() || { ...defaultPreferences },
    );
    this.debouncedSave = useDebounceFn(
      (preference) => this.saveToCache(preference),
      150,
    );
  }

  clearCache = () => {
    Object.values(STORAGE_KEYS).forEach((key) => this.cache.removeItem(key));
  };

  getInitialPreferences = () => {
    return this.initialPreferences;
  };

  getPreferences = () => {
    return readonly(this.state);
  };

  initPreferences = async ({ namespace, overrides }: InitialOptions) => {
    // 防止重复初始化
    if (this.isInitialized) {
      return;
    }

    // 使用命名空间初始化存储管理器
    this.cache = new StorageManager({ prefix: namespace });

    // 合并初始偏好设置
    this.initialPreferences = merge({}, overrides, defaultPreferences);

    // 加载缓存的偏好设置并与初始配置合并
    const cachedPreferences = this.loadFromCache() || {};
    const mergedPreference = merge(
      {},
      cachedPreferences,
      this.initialPreferences,
    );

    // 更新偏好设置
    this.updatePreferences(mergedPreference);

    // 设置监听器
    this.setupWatcher();

    // 初始化平台标识
    this.initPlatform();

    this.isInitialized = true;
  };

  resetPreferences = () => {
    // 将状态重置为初始偏好设置
    Object.assign(this.state, this.initialPreferences);

    // 保存偏好设置至缓存
    this.saveToCache(this.state);

    // 直接触发 UI 更新
    this.handleUpdates(this.state);
  };

  updatePreferences = (updates: DeepPartial<Preferences>) => {
    // 深度合并更新内容和当前状态
    const mergedState = merge({}, updates, markRaw(this.state));
    Object.assign(this.state, mergedState);

    // 根据更新的值执行更新
    this.handleUpdates(updates);

    // 保存到缓存
    this.debouncedSave(this.state);
  };

  /**
   * 将偏好字段补丁合并到响应式状态，并按配置同步缓存。
   *
   * @param updates - 本次偏好设置变化的字段补丁。
   */
  private handleUpdates(updates: DeepPartial<Preferences>) {
    const { theme, app } = updates;

    if (
      theme &&
      (Object.keys(theme).length > 0 || Reflect.has(theme, 'fontSize'))
    ) {
      updateCSSVariables(this.state);
    }

    if (
      app &&
      (Reflect.has(app, 'colorGrayMode') || Reflect.has(app, 'colorWeakMode'))
    ) {
      this.updateColorMode(this.state);
    }
  }

  /**
   * 根据 userAgent 与窗口尺寸初始化移动端平台标志。
   */
  private initPlatform() {
    if (isMacOs()) {
      document.documentElement.dataset.platform = 'macOs';
    } else {
      document.documentElement.dataset.platform = 'window';
    }
  }

  /**
   * 从命名空间缓存读取完整偏好设置；尚未持久化时返回 null。
   *
   * @returns 缓存中的完整偏好设置；尚未持久化时为 null。
   */
  private loadFromCache(): null | Preferences {
    return this.cache.getItem<Preferences>(STORAGE_KEYS.MAIN);
  }

  /**
   * 将完整偏好设置持久化到本地缓存。
   *
   * @param preference - 要写入主配置、语言与主题模式缓存的完整偏好设置。
   */
  private saveToCache(preference: Preferences) {
    this.cache.setItem(STORAGE_KEYS.MAIN, preference);
    this.cache.setItem(STORAGE_KEYS.LOCALE, preference.app.locale);
    this.cache.setItem(STORAGE_KEYS.THEME, preference.theme.mode);
  }

  /**
   * 通过响应式监听同步系统主题、偏好缓存和页面颜色模式。
   */
  private setupWatcher() {
    if (this.isInitialized) {
      return;
    }

    // 监听断点，判断是否移动端
    const breakpoints = useBreakpoints(breakpointsTailwind);
    const isMobile = breakpoints.smaller('md');

    watch(
      () => isMobile.value,
      (val) => {
        this.updatePreferences({
          app: { isMobile: val },
        });
      },
      { immediate: true },
    );

    // 监听系统主题偏好设置变化
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', ({ matches: isDark }) => {
        // 仅在自动模式下跟随系统主题
        if (this.state.theme.mode === 'auto') {
          // 先应用实际的主题
          this.updatePreferences({
            theme: {
              mode: (() => {
                if (isDark) {
                  return 'dark';
                }
                return 'light';
              })(),
            },
          });
          // 再恢复为 auto 模式，保持跟随系统的状态
          this.updatePreferences({
            theme: { mode: 'auto' },
          });
        }
      });
  }

  /**
   * 根据灰度与色弱偏好切换 document 根节点的滤镜 class。
   *
   * @param preference - 提供灰度模式与色弱模式开关的完整偏好设置。
   */
  private updateColorMode(preference: Preferences) {
    const { colorGrayMode, colorWeakMode } = preference.app;
    const dom = document.documentElement;

    dom.classList.toggle('invert-mode', colorWeakMode);
    dom.classList.toggle('grayscale-mode', colorGrayMode);
  }
}

const preferencesManager = new PreferenceManager();

export { PreferenceManager, preferencesManager };
