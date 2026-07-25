import { defineOverridesPreferences } from '@vben/preferences';

export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    accessMode: 'backend',
    defaultHomePath: '/system/role',
    enableRefreshToken: true,
    name: import.meta.env.VITE_APP_TITLE,
  },
  widget: {
    notification: false,
  },
});
