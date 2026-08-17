import { TinyColor } from '@ctrl/tinycolor';

/**
 * 将 CSS 颜色解析为带单位的 HSL 文本，并在透明时附加 alpha 通道。
 *
 * @param color - 需要解析或写入 CSS 变量的颜色文本。
 * @returns 以 h、s、l 数值字段表示的 HSL 颜色。
 */
function convertToHsl(color: string): string {
  const { a, h, l, s } = new TinyColor(color).toHsl();
  const hsl = `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  if (a < 1) {
    return `${hsl} ${a}`;
  }
  return hsl;
}

/**
 * 将 CSS 颜色解析为空格分隔的 HSL 通道，供 CSS 变量直接引用。
 *
 * @param color - 需要解析或写入 CSS 变量的颜色文本。
 * @returns 可直接写入 CSS 变量的空格分隔 HSL 通道字符串。
 */
function convertToHslCssVar(color: string): string {
  const { a, h, l, s } = new TinyColor(color).toHsl();
  const hsl = `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  if (a < 1) {
    return `${hsl} / ${a}`;
  }
  return hsl;
}

/**
 * 移除 HSL 角度单位后将颜色转换为 RGB 文本，规避 TinyColor 对带单位色相的解析限制。
 *
 * @param str - 要转换为 RGB 的 CSS 颜色文本。
 * @returns 去除 HSL 角度单位后转换得到的 rgb(...) 字符串。
 */
function convertToRgb(str: string): string {
  return new TinyColor(str.replaceAll(/deg|grad|rad|turn/g, '')).toRgbString();
}

/**
 * 仅在输入非空且 TinyColor 能成功解析时判定为有效颜色。
 *
 * @param color - 需要解析或写入 CSS 变量的颜色文本。
 * @returns TinyColor 能识别输入颜色时为 true，否则为 false。
 */
function isValidColor(color?: string) {
  if (!color) {
    return false;
  }
  return new TinyColor(color).isValid;
}

export {
  convertToHsl,
  convertToHslCssVar,
  convertToRgb,
  isValidColor,
  TinyColor,
};
