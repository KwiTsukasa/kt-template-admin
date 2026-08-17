export const ADMIN_SSO_DEFAULT_REDIRECT = '/blog/article';

/**
 * 把路由查询参数归一为单个字符串，数组只采用首个非空值。
 *
 * @param value - 路由 query 的字符串或字符串数组；数组只读取首项，空值返回空字符串。
 * @returns 首个非空路由查询字符串；没有可用字符串时为空字符串。
 */
function readQueryValue(value: unknown) {
  const scalar = (() => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  })();
  if (typeof scalar === 'string') {
    return scalar;
  }
  return '';
}

/**
 * 检查当前路由是否携带管理端 SSO 参数且来源符合单点登录入口契约。
 *
 * @param value - 路由中的 SSO 标志；数组只读取首项，只有字符串 `1` 表示 SSO 请求。
 * @returns 路由携带合法管理端 SSO 来源和回跳参数时返回 true，否则返回 false。
 */
export function isAdminSsoRequest(value: unknown) {
  return readQueryValue(value) === '1';
}

/**
 * 仅允许博客文章列表作为 SSO 回跳目标，非法编码或其他地址统一回退到白名单路径。
 *
 * @param value - 尚未校验的 SSO 回跳参数；无效编码或非白名单地址会回退。
 * @returns 白名单内的 SSO 回跳路径；输入无效或不是文章列表地址时返回默认路径。
 */
export function resolveAdminSsoRedirect(value: unknown) {
  const rawValue = readQueryValue(value);
  let decodedValue = rawValue;

  try {
    decodedValue = decodeURIComponent(rawValue);
  } catch {
    // A malformed value is rejected by the fixed allow-list below.
  }

  if (decodedValue === ADMIN_SSO_DEFAULT_REDIRECT) {
    return decodedValue;
  }
  return ADMIN_SSO_DEFAULT_REDIRECT;
}
