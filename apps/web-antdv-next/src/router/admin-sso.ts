export const ADMIN_SSO_DEFAULT_REDIRECT = '/blog/article';
export const ADMIN_SSO_VOICE_HOST = 'voice.nas4.kwitsukasa.top';
export const ADMIN_SSO_VOICE_CALLBACK_PATHS = Object.freeze([
  '/auth/callback',
  '/auth/ios-callback',
]);

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
 * 仅接受 Voice 动态总网关 Host、显式有效端口和两个无查询 callback，拒绝其他外部地址。
 *
 * @param value - 已完成单层 URI 解码的候选外部回跳地址。
 * @returns 完全规范化的 Voice callback；任一 Host、端口、凭据、路径或查询不符时为空。
 */
function normalizeVoiceArchiveSsoRedirect(value: string) {
  try {
    const url = new URL(value);
    const port = Number(url.port);
    const validPort =
      url.port.length > 0 &&
      Number.isInteger(port) &&
      port >= 1 &&
      port <= 65_535;
    if (url.protocol !== 'https:' || url.hostname !== ADMIN_SSO_VOICE_HOST) {
      return '';
    }
    if (!validPort || url.username || url.password || url.search || url.hash) {
      return '';
    }
    if (!ADMIN_SSO_VOICE_CALLBACK_PATHS.includes(url.pathname)) {
      return '';
    }
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * 仅允许博客文章列表与 Voice 动态网关的严格 HTTPS callback，其他地址统一回退。
 *
 * @param value - 尚未校验的 SSO 回跳参数；无效编码或非白名单地址会回退。
 * @returns 白名单内的站内路径或外部 callback；输入无效时返回默认路径。
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
  const voiceRedirect = normalizeVoiceArchiveSsoRedirect(decodedValue);
  if (voiceRedirect) {
    return voiceRedirect;
  }
  return ADMIN_SSO_DEFAULT_REDIRECT;
}
