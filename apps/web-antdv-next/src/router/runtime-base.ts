const ADMIN_MOUNT_PATH = '/admin';

/**
 * 识别当前路径是否位于 `/admin`，返回带尾斜杠的管理端部署根或站点根。
 *
 * @param pathname - 用于识别部署子路径的当前浏览器 pathname。
 * @returns 规范化后的管理端运行基础路径，无法读取浏览器路径时使用配置默认值。
 */
export function resolveAdminRuntimeBase(pathname: string) {
  const normalizedPathname = (() => {
    if (pathname.startsWith('/')) {
      return pathname;
    }
    return `/${pathname}`;
  })();

  if (
    normalizedPathname === ADMIN_MOUNT_PATH ||
    normalizedPathname.startsWith(`${ADMIN_MOUNT_PATH}/`)
  ) {
    return `${ADMIN_MOUNT_PATH}/`;
  }
  return '/';
}
