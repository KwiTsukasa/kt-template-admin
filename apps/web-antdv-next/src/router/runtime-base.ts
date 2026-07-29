const ADMIN_MOUNT_PATH = '/admin';

export function resolveAdminRuntimeBase(pathname: string) {
  const normalizedPathname = pathname.startsWith('/')
    ? pathname
    : `/${pathname}`;

  return normalizedPathname === ADMIN_MOUNT_PATH ||
    normalizedPathname.startsWith(`${ADMIN_MOUNT_PATH}/`)
    ? `${ADMIN_MOUNT_PATH}/`
    : '/';
}
