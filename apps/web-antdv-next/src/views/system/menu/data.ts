import { $t } from '#/locales';

/**
 * 生成目录、页面、按钮、内嵌页和外链的国际化菜单类型选项。
 *
 * @returns 目录、菜单和按钮类型的表单选项数组。
 */
export function getMenuTypeOptions() {
  return [
    {
      color: 'processing',
      label: $t('system.menu.typeCatalog'),
      value: 'catalog',
    },
    { color: 'default', label: $t('system.menu.typeMenu'), value: 'menu' },
    { color: 'error', label: $t('system.menu.typeButton'), value: 'button' },
    {
      color: 'success',
      label: $t('system.menu.typeEmbedded'),
      value: 'embedded',
    },
    { color: 'warning', label: $t('system.menu.typeLink'), value: 'link' },
  ];
}
