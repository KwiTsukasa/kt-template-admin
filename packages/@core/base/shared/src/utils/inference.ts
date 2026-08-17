// eslint-disable-next-line vue/prefer-import-from-vue
import { isFunction, isObject, isString } from '@vue/shared';

/**
 * 判断输入是否严格等于 undefined，并向 TypeScript 收窄空值类型。
 *
 * @param value - 要检查是否缺失的输入值。
 * @returns 输入严格等于 undefined 时为 true。
 */
function isUndefined(value?: unknown): value is undefined {
  return value === undefined;
}

/**
 * 仅当输入的运行时类型为 boolean 时返回 true。
 *
 * @param value - 要检查布尔类型的未知输入。
 * @returns 输入类型为 boolean 时为 true。
 */
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * 将 null、undefined、空字符串、空数组、空 Map、空 Set 和无自有属性对象判定为空。
 *
 * @param value - 要按标量、集合或对象规则检查是否为空的输入。
 * @returns 输入为 null、undefined、空字符串、空集合或无自有属性对象时为 true。
 */
function isEmpty<T = unknown>(value?: T): value is T {
  if (value === null || value === undefined) {
    return true;
  }

  if (Array.isArray(value) || isString(value)) {
    return value.length === 0;
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size === 0;
  }

  if (isObject(value)) {
    return Object.keys(value).length === 0;
  }

  return false;
}

/**
 * 仅当字符串以 HTTP 或 HTTPS 协议开头时返回 true；空字符串直接判定无效。
 *
 * @param url - 要检查协议前缀的候选绝对地址；省略时判定无效。
 * @returns 字符串是 HTTP 或 HTTPS 绝对地址时为 true。
 */
function isHttpUrl(url?: string): boolean {
  if (!url) {
    return false;
  }
  // 使用正则表达式测试URL是否以http:// 或 https:// 开头
  const httpRegex = /^https?:\/\/.*$/;
  return httpRegex.test(url);
}

/**
 * 仅在浏览器环境中检查对象的 window 自引用，并据此收窄窗口对象类型。
 *
 * @param value - 要检查窗口对象身份的运行时输入。
 * @returns 输入与当前全局 window 对象相同时为 true。
 */
function isWindow(value: any): value is Window {
  return (
    typeof window !== 'undefined' && value !== null && value === value.window
  );
}

/**
 * 通过浏览器 userAgent 中的 Macintosh 或 Mac OS X 标记识别 macOS。
 *
 * @returns 浏览器 userAgent 表明当前系统为 macOS 时为 true。
 */
function isMacOs(): boolean {
  const macRegex = /macintosh|mac os x/i;
  return macRegex.test(navigator.userAgent);
}

/**
 * 通过浏览器 userAgent 中的 Windows 或 Win32 标记识别 Windows。
 *
 * @returns 浏览器 userAgent 表明当前系统为 Windows 时为 true。
 */
function isWindowsOs(): boolean {
  const windowsRegex = /windows|win32/i;
  return windowsRegex.test(navigator.userAgent);
}

/**
 * 仅当输入为有限 number 时返回 true，并排除 NaN 与正负 Infinity。
 *
 * @param value - 要检查有限数字类型的运行时输入。
 * @returns 输入类型为 number 且不是 NaN 时为 true。
 */
function isNumber(value: any): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 根据参数顺序返回首个非 null 且非 undefined 的值，全部为空时返回 undefined。
 *
 * @param values - 按优先级排列、允许包含 null 或 undefined 的候选值。
 * @returns 按参数顺序找到的首个非 null 且非 undefined 值；全部为空时返回 undefined。
 */
function getFirstNonNullOrUndefined<T>(
  ...values: (null | T | undefined)[]
): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

export {
  getFirstNonNullOrUndefined,
  isBoolean,
  isEmpty,
  isFunction,
  isHttpUrl,
  isMacOs,
  isNumber,
  isObject,
  isString,
  isUndefined,
  isWindow,
  isWindowsOs,
};
