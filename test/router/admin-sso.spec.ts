import {
  ADMIN_SSO_DEFAULT_REDIRECT,
  ADMIN_SSO_KWICORE_CALLBACK,
  ADMIN_SSO_LEGACY_ANDROID_CALLBACK,
  ADMIN_SSO_VOICE_CALLBACK_PATHS,
  ADMIN_SSO_VOICE_HOST,
  buildAdminMobileSsoRedirect,
  isAdminMobileSsoCallback,
  isAdminSsoRequest,
  resolveAdminSsoRedirect,
} from '@test-source/apps/web-antdv-next/src/router/admin-sso';
import { describe, expect, it } from 'vitest';

describe('admin SSO route helpers', () => {
  it('recognizes only the explicit SSO bootstrap flag', () => {
    expect(isAdminSsoRequest('1')).toBe(true);
    expect(isAdminSsoRequest(['1'])).toBe(true);
    expect(isAdminSsoRequest('true')).toBe(false);
    expect(isAdminSsoRequest(undefined)).toBe(false);
  });

  it('accepts the Blog management route in plain or encoded form', () => {
    expect(resolveAdminSsoRedirect('/blog/article')).toBe(
      ADMIN_SSO_DEFAULT_REDIRECT,
    );
    expect(resolveAdminSsoRedirect('%2Fblog%2Farticle')).toBe(
      ADMIN_SSO_DEFAULT_REDIRECT,
    );
  });

  it('accepts only dynamic-port Voice Archive web and iOS callbacks', () => {
    for (const path of ADMIN_SSO_VOICE_CALLBACK_PATHS) {
      const callback = `https://${ADMIN_SSO_VOICE_HOST}:52418${path}`;
      expect(resolveAdminSsoRedirect(callback)).toBe(callback);
      expect(resolveAdminSsoRedirect(encodeURIComponent(callback))).toBe(
        callback,
      );
    }
  });

  it('accepts only the fixed current and compatibility Android callbacks', () => {
    for (const callback of [
      ADMIN_SSO_KWICORE_CALLBACK,
      ADMIN_SSO_LEGACY_ANDROID_CALLBACK,
    ]) {
      expect(resolveAdminSsoRedirect(callback)).toBe(callback);
      expect(resolveAdminSsoRedirect(encodeURIComponent(callback))).toBe(
        callback,
      );
      expect(isAdminMobileSsoCallback(callback)).toBe(true);
    }
  });

  it('builds an Android callback carrying only the Admin access token', () => {
    const token = `${'a'.repeat(40)}.${'b'.repeat(43)}`;
    const callback = buildAdminMobileSsoRedirect(
      ADMIN_SSO_KWICORE_CALLBACK,
      token,
    );
    const parsed = new URL(callback);

    expect(parsed.searchParams.get('ktAccessToken')).toBe(token);
    expect([...parsed.searchParams.keys()]).toEqual(['ktAccessToken']);
    expect(buildAdminMobileSsoRedirect('/blog/article', token)).toBe('');
  });

  it.each([
    'https://evil.example/',
    'https%3A%2F%2Fevil.example%2F',
    '//evil.example/',
    '%2F%2Fevil.example%2F',
    '/bot/account',
    '/blog/article/61',
    'http://voice.nas4.kwitsukasa.top:52418/auth/callback',
    'https://voice.nas4.kwitsukasa.top/auth/callback',
    'https://voice.nas4.kwitsukasa.top:0/auth/callback',
    'https://voice.nas4.kwitsukasa.top:65536/auth/callback',
    'https://voice.nas4.kwitsukasa.top:52418/auth/callback?next=https://evil.example',
    'https://voice.nas4.kwitsukasa.top:52418/auth/callback#token',
    'https://user@voice.nas4.kwitsukasa.top:52418/auth/callback',
    'https://voice.nas4.kwitsukasa.top.evil.example:52418/auth/callback',
    'https://voice.nas4.kwitsukasa.top:52418/auth/callback/extra',
    'kwicore://evil/callback',
    'kwicore://admin-sso/other',
    'kwicore://admin-sso/callback?next=evil',
    'kwicore://admin-sso/callback#token',
    'kwicore://user@admin-sso/callback',
    'ktremote://evil/callback',
    'ktremote://admin-sso/other',
    'ktremote://admin-sso/callback?next=evil',
    'ktremote://admin-sso/callback#token',
    'ktremote://user@admin-sso/callback',
    'broken',
    undefined,
  ])('falls back to the fixed Blog management route for %s', (value) => {
    expect(resolveAdminSsoRedirect(value)).toBe(ADMIN_SSO_DEFAULT_REDIRECT);
  });
});
