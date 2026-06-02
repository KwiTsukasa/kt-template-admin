import { $t } from '#/locales';

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
