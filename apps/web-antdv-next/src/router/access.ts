import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { message } from 'antdv-next';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden');

/**
 * 按应用权限模式加载菜单，并结合页面与布局组件映射生成可注册路由及可见菜单。
 *
 * @param options - 提供页面组件映射、菜单加载器和无权限页面等访问控制依赖。
 * @returns 包含可注册路由与对应可见菜单的访问结果。
 */
async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = {
    ...import.meta.glob(['../views/**/*.tsx', '!../views/**/*.spec.tsx']),
    ...import.meta.glob('../views/**/*.vue'),
  };

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      message.loading({
        content: `${$t('common.loadingMenu')}...`,
        duration: 1.5,
      });
      return await getAllMenusApi();
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };
