export type ThemeValue =
  | boolean
  | null
  | number
  | string
  | ThemeObject
  | ThemeValue[];
export interface ThemeObject {
  [key: string]: ThemeValue;
}
export type ThemePath = (number | string)[];
export interface ThemeField {
  choices?: string[];
  initial: ThemeValue;
  kind: 'boolean' | 'image' | 'number' | 'select' | 'text';
  label: string;
  max?: number;
  min?: number;
  path: string;
}
export interface ThemeGroup {
  fields: ThemeField[];
  title: string;
}

export const themeGroups: ThemeGroup[] = [
  {
    title: '站点信息',
    fields: [
      { path: 'site.title', label: '站点标题', kind: 'text', initial: '' },
      {
        path: 'site.description',
        label: '站点描述',
        kind: 'text',
        initial: '',
      },
      { path: 'site.home', label: '首页地址', kind: 'text', initial: '' },
      { path: 'site.url', label: '站点地址', kind: 'text', initial: '' },
      { path: 'site.authorName', label: '作者名称', kind: 'text', initial: '' },
      {
        path: 'site.authorAvatar',
        label: '作者头像',
        kind: 'image',
        initial: '',
      },
    ],
  },
  {
    title: '外观与背景',
    fields: [
      { path: 'themeColor', label: '主题色', kind: 'text', initial: '#c3a1ed' },
      {
        path: 'themeColorRgb',
        label: '主题色 RGB',
        kind: 'text',
        initial: '195,161,237',
      },
      { path: 'themeVersion', label: '主题版本', kind: 'text', initial: '' },
      {
        path: 'themeCardRadius',
        label: '卡片圆角（像素）',
        kind: 'number',
        min: 0,
        max: 200,
        initial: 4,
      },
      {
        path: 'enableCustomThemeColor',
        label: '启用自定义主题色',
        kind: 'boolean',
        initial: true,
      },
      {
        path: 'darkmodeAutoSwitch',
        label: '深色模式',
        kind: 'select',
        choices: ['alwayson', 'alwaysoff', 'system', 'time', 'false'],
        initial: 'system',
      },
      {
        path: 'backgroundImage',
        label: '浅色背景图片',
        kind: 'image',
        initial: '',
      },
      {
        path: 'backgroundOpacity',
        label: '浅色背景不透明度',
        kind: 'number',
        min: 0,
        max: 1,
        initial: 1,
      },
      {
        path: 'backgroundDarkImage',
        label: '深色背景图片',
        kind: 'image',
        initial: '',
      },
      {
        path: 'backgroundDarkOpacity',
        label: '深色背景不透明度',
        kind: 'number',
        min: 0,
        max: 1,
        initial: 1,
      },
      {
        path: 'backgroundDarkBrightness',
        label: '深色背景亮度',
        kind: 'number',
        min: 0,
        max: 1,
        initial: 0.65,
      },
      {
        path: 'headerMenuVisible',
        label: '显示顶部菜单',
        kind: 'boolean',
        initial: true,
      },
    ],
  },
  {
    title: '文章与交互',
    fields: [
      {
        path: 'argonConfig.codeHighlight.enable',
        label: '启用代码高亮',
        kind: 'boolean',
        initial: true,
      },
      {
        path: 'argonConfig.codeHighlight.breakLine',
        label: '代码自动换行',
        kind: 'boolean',
        initial: false,
      },
      {
        path: 'argonConfig.codeHighlight.hideLinenumber',
        label: '隐藏代码行号',
        kind: 'boolean',
        initial: false,
      },
      {
        path: 'argonConfig.codeHighlight.transparentLinenumber',
        label: '行号背景透明',
        kind: 'boolean',
        initial: false,
      },
      {
        path: 'argonConfig.lazyload.effect',
        label: '图片懒加载效果',
        kind: 'select',
        choices: ['fadeIn', 'show'],
        initial: 'fadeIn',
      },
      {
        path: 'argonConfig.lazyload.threshold',
        label: '懒加载提前距离（像素）',
        kind: 'number',
        min: 0,
        max: 10_000,
        initial: 800,
      },
      {
        path: 'argonConfig.dateFormat',
        label: '日期格式',
        kind: 'select',
        choices: ['YMD', 'MDY', 'DMY'],
        initial: 'YMD',
      },
      {
        path: 'argonConfig.disablePjax',
        label: '禁用 PJAX',
        kind: 'boolean',
        initial: true,
      },
      {
        path: 'argonConfig.foldLongComments',
        label: '折叠长评论',
        kind: 'boolean',
        initial: false,
      },
      {
        path: 'argonConfig.foldLongShuoshuo',
        label: '折叠长说说',
        kind: 'boolean',
        initial: false,
      },
      {
        path: 'argonConfig.headroom',
        label: '滚动时自动隐藏顶栏',
        kind: 'boolean',
        initial: 'false',
      },
      {
        path: 'argonConfig.language',
        label: '主题语言',
        kind: 'select',
        choices: ['zh_CN', 'zh_TW', 'en_US'],
        initial: 'zh_CN',
      },
      {
        path: 'argonConfig.pangu',
        label: '中西文间距范围',
        kind: 'select',
        choices: ['article', 'all', 'false'],
        initial: 'article',
      },
      {
        path: 'argonConfig.pjaxAnimationDuration',
        label: 'PJAX 动画时长（毫秒）',
        kind: 'number',
        min: 0,
        max: 10_000,
        initial: 600,
      },
      {
        path: 'argonConfig.waterflowColumns',
        label: '瀑布流列数',
        kind: 'number',
        min: 1,
        max: 6,
        initial: '1',
      },
      {
        path: 'argonConfig.wpPath',
        label: 'WordPress 路径',
        kind: 'text',
        initial: '/',
      },
      {
        path: 'argonConfig.zoomify',
        label: '启用图片放大',
        kind: 'boolean',
        initial: false,
      },
    ],
  },
];

/**
 * 复制配置的 JSON 值，避免编辑草稿修改请求返回的原对象。
 * @param value - 需要独立保存的配置值。
 * @returns 不共享对象或数组引用的配置副本。
 */
export function cloneTheme<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneTheme(item)) as T;
  if (isThemeObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneTheme(child)]),
    ) as T;
  }
  return value;
}

/**
 * 识别可递归编辑的配置对象，排除空值和数组。
 * @param value - 待检查的配置值。
 * @returns 值为普通配置对象时返回真。
 */
export function isThemeObject(value: unknown): value is ThemeObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 沿配置路径读取原值，父级缺失或类型不匹配时保留缺省状态。
 * @param config - 当前配置草稿。
 * @param path - 对象字段或数组下标组成的路径。
 * @returns 路径处原值，缺失时为 undefined。
 */
export function readTheme(
  config: ThemeObject,
  path: ThemePath,
): ThemeValue | undefined {
  let current: ThemeValue | undefined = config;
  for (const key of path) {
    if (!isThemeObject(current) && !Array.isArray(current)) return undefined;
    if (!Object.hasOwn(current, key)) return undefined;
    current = (current as ThemeObject)[key];
  }
  return current;
}

/**
 * 仅修改指定配置路径；中间对象按需建立，删除数组项时保持下标连续。
 * @param config - 接收局部修改的配置草稿。
 * @param path - 需要写入或删除的字段路径。
 * @param value - 新值，undefined 表示移除字段。
 */
export function writeTheme(
  config: ThemeObject,
  path: ThemePath,
  value: ThemeValue | undefined,
) {
  let current: ThemeObject | ThemeValue[] = config;
  for (const key of path.slice(0, -1)) {
    let child;
    if (Object.hasOwn(current, key)) child = (current as ThemeObject)[key];
    if (!isThemeObject(child) && !Array.isArray(child)) {
      Object.defineProperty(current, key, {
        configurable: true,
        enumerable: true,
        value: {},
        writable: true,
      });
    }
    current = (current as ThemeObject)[key] as ThemeObject;
  }
  const key = path.at(-1);
  if (key === undefined) return;
  if (value === undefined) {
    if (Array.isArray(current)) current.splice(Number(key), 1);
    else Reflect.deleteProperty(current, key);
  } else {
    Object.defineProperty(current, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }
}

/**
 * 按历史值的原类型写回数值或开关，避免把 WordPress 字符串静默改成其他类型。
 * @param original - 当前字段的历史原值；原值为字符串时，新输入仍写为字符串。
 * @param value - 数值或开关控件的新输入；是否转换为字符串由历史原值的类型决定。
 * @returns 保留历史字符串类型的新值。
 */
export function preserveScalarType(
  original: ThemeValue | undefined,
  value: boolean | number,
): ThemeValue {
  if (typeof original === 'string') return String(value);
  return value;
}

/**
 * 将有效十六进制主题色转换为三个十进制通道，非法颜色不产生联动修改。
 * @param value - 用户输入的三位或六位十六进制颜色。
 * @returns 可持久化的 RGB 字符串，非法颜色时为 undefined。
 */
export function themeColorRgb(value: string): string | undefined {
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) return undefined;
  let hex = value.slice(1);
  if (hex.length === 3) hex = [...hex].map((part) => part + part).join('');
  return [0, 2, 4]
    .map((start) => Number.parseInt(hex.slice(start, start + 2), 16))
    .join(',');
}
