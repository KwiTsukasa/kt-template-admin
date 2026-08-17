import type { IconifyIconStructure } from '@vben-core/icons';

import { addIcon } from '@vben-core/icons';

let loaded = false;
if (!loaded) {
  loadSvgIcons();
  loaded = true;
}

/**
 * 通过解析 SVG 根属性、viewBox 与子节点，转换为 Iconify 图标结构。
 *
 * @param svgData - 需要解析为 SVG DOM 的源文本。
 * @returns 包含 SVG body、宽高和 viewBox 的 Iconify 图标数据。
 */
function parseSvg(svgData: string): IconifyIconStructure {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(svgData, 'image/svg+xml');
  const svgElement = xmlDoc.documentElement;

  // 提取 SVG 根元素的关键样式属性
  const getAttrs = (el: Element, attrs: string[]) =>
    attrs
      .map((attr) => {
        if (el.hasAttribute(attr)) {
          return `${attr}="${el.getAttribute(attr)}"`;
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');

  const rootAttrs = getAttrs(svgElement, [
    'fill',
    'stroke',
    'fill-rule',
    'stroke-width',
  ]);

  const svgContent = [...svgElement.childNodes]
    .filter((node) => node.nodeType === Node.ELEMENT_NODE)
    .map((node) => new XMLSerializer().serializeToString(node))
    .join('');
  // 若根有属性，用一个 g 标签包裹内容并继承属性
  const body = (() => {
    if (rootAttrs) {
      return `<g ${rootAttrs}>${svgContent}</g>`;
    }
    return svgContent;
  })();

  const viewBoxValue = svgElement.getAttribute('viewBox') || '';
  const [left, top, width, height] = viewBoxValue.split(' ').map((val) => {
    const num = Number(val);
    if (Number.isNaN(num)) {
      return undefined;
    }
    return num;
  });

  return {
    body,
    height,
    left,
    top,
    width,
  };
}

/**
 * 将项目 SVG 文件批量加载为可按名称渲染的 Vue 图标组件。
 */
async function loadSvgIcons() {
  const svgEagers = import.meta.glob('./icons/**', {
    eager: true,
    query: '?raw',
  });

  await Promise.all(
    Object.entries(svgEagers).map((svg) => {
      const [key, body] = svg as [string, string | { default: string }];

      // ./icons/xxxx.svg => xxxxxx
      const start = key.lastIndexOf('/') + 1;
      const end = key.lastIndexOf('.');
      const iconName = key.slice(start, end);

      return addIcon(`svg:${iconName}`, {
        ...parseSvg(
          (() => {
            if (typeof body === 'object') {
              return body.default;
            }
            return body;
          })(),
        ),
      });
    }),
  );
}
