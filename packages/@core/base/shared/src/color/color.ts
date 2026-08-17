import { TinyColor } from '@ctrl/tinycolor';

/**
 * 根据颜色亮度阈值判断输入颜色是否适合使用浅色前景。
 *
 * @param color - 要按亮度判断深浅的 CSS 颜色文本。
 * @returns 颜色亮度低于阈值、适合浅色前景时返回 true，否则返回 false。
 */
export function isDarkColor(color: string) {
  return new TinyColor(color).isDark();
}

/**
 * 根据颜色亮度阈值判断输入颜色是否适合使用深色前景。
 *
 * @param color - 要按亮度判断深浅的 CSS 颜色文本。
 * @returns 颜色亮度不低于阈值、适合深色前景时返回 true，否则返回 false。
 */
export function isLightColor(color: string) {
  return new TinyColor(color).isLight();
}
