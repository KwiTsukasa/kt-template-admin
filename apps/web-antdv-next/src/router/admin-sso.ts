export const ADMIN_SSO_DEFAULT_REDIRECT = '/blog/article';

/**
 * Reads a scalar router query value while tolerating Vue Router array values.
 * @param value Raw route-query value.
 * @returns First string value or an empty string when absent.
 */
function readQueryValue(value: unknown) {
  const scalar = Array.isArray(value) ? value[0] : value;
  return typeof scalar === 'string' ? scalar : '';
}

/**
 * Detects the explicit cross-site Admin SSO bootstrap flag.
 * @param value Raw `sso` route-query value.
 * @returns Whether silent Admin-cookie restoration should be attempted.
 */
export function isAdminSsoRequest(value: unknown) {
  return readQueryValue(value) === '1';
}

/**
 * Resolves the fixed Blog management landing route without accepting open redirects.
 * @param value Raw `redirect` route-query value, optionally URL-encoded once.
 * @returns The allow-listed Blog article management route.
 */
export function resolveAdminSsoRedirect(value: unknown) {
  const rawValue = readQueryValue(value);
  let decodedValue = rawValue;

  try {
    decodedValue = decodeURIComponent(rawValue);
  } catch {
    // A malformed value is rejected by the fixed allow-list below.
  }

  return decodedValue === ADMIN_SSO_DEFAULT_REDIRECT
    ? decodedValue
    : ADMIN_SSO_DEFAULT_REDIRECT;
}
