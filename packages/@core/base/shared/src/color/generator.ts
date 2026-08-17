import { getColors } from 'theme-colors';

import { convertToHslCssVar, TinyColor } from './convert';

interface ColorItem {
  alias?: string;
  color: string;
  name: string;
}

/**
 * 把主题色阶转换为 CSS 变量映射，供运行时主题样式统一写入。
 *
 * @param colorItems - 用于生成主题色阶变量的颜色项集合。
 * @returns 主题色阶及别名对应的 CSS 变量键值映射；无有效颜色时为空对象。
 */
function generatorColorVariables(colorItems: ColorItem[]) {
  const colorVariables: Record<string, string> = {};

  colorItems.forEach(({ alias, color, name }) => {
    if (color) {
      const colorsMap = getColors(new TinyColor(color).toHexString());

      let mainColor = colorsMap['500'];

      const colorKeys = Object.keys(colorsMap);

      colorKeys.forEach((key) => {
        const colorValue = colorsMap[key];

        if (colorValue) {
          const hslColor = convertToHslCssVar(colorValue);
          colorVariables[`--${name}-${key}`] = hslColor;
          if (alias) {
            colorVariables[`--${alias}-${key}`] = hslColor;
          }

          if (key === '500') {
            mainColor = hslColor;
          }
        }
      });
      if (alias && mainColor) {
        colorVariables[`--${alias}`] = mainColor;
      }
    }
  });
  return colorVariables;
}

export { generatorColorVariables };
