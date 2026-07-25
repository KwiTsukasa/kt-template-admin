export const ADMIN_SSO_DEFAULT_REDIRECT = '/blog/article';

function readQueryValue(value: unknown) {
  const scalar = Array.isArray(value) ? value[0] : value;
  return typeof scalar === 'string' ? scalar : '';
}

export function isAdminSsoRequest(value: unknown) {
  return readQueryValue(value) === '1';
}

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
