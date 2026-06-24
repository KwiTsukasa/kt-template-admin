import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

import { describe, expect, it } from 'vitest';

const accountRoot = resolve(
  cwd(),
  'apps/web-antdv-next/src/views/qqbot/account',
);

const readAccountSource = (relativePath: string) =>
  readFileSync(resolve(accountRoot, relativePath), 'utf8');

/**
 * Reads QQBot router module source for route boundary assertions.
 */
const readRouteSource = (relativePath: string) =>
  readFileSync(
    resolve(
      cwd(),
      'apps/web-antdv-next/src/router/routes/modules',
      relativePath,
    ),
    'utf8',
  );

describe('qqbot account NapCat login view boundary', () => {
  it('keeps login session state out of account/list.tsx', () => {
    const source = readAccountSource('list.tsx');

    expect(source).toContain('NapcatLoginModal');
    expect(source).not.toContain('EventSource');
    expect(source).not.toContain('TencentCaptcha');
    expect(source).not.toContain('useQRCode');
    expect(source).not.toContain('/qqbot/account/scan');
    expect(source).not.toContain('startQqbotAccountScan');
    expect(source).not.toContain('submitQqbotAccountScanCaptcha');
  });

  it('keeps NapCat login modal and session helpers in the napcat package', () => {
    expect(
      existsSync(resolve(accountRoot, 'napcat/NapcatLoginModal.tsx')),
    ).toBe(true);
    expect(
      existsSync(resolve(accountRoot, 'napcat/useNapcatLoginSession.ts')),
    ).toBe(true);
    expect(existsSync(resolve(accountRoot, 'napcat/tencentCaptcha.ts'))).toBe(
      true,
    );
    expect(existsSync(resolve(accountRoot, 'napcat/qrcode.ts'))).toBe(true);
  });

  it('keeps WebUI gateway lifecycle logic out of account/list.tsx', () => {
    const source = readAccountSource('list.tsx');

    expect(source).toContain('QqBotAccountNapcatWebui');
    expect(source).toContain('QqBot:Account:WebUI');
    expect(source).not.toContain('createQqbotNapcatWebuiSession');
    expect(source).not.toContain('heartbeatQqbotNapcatWebuiSession');
    expect(source).not.toContain('revokeQqbotNapcatWebuiSession');
    expect(source).not.toContain('<iframe');
    expect(source).not.toContain('iframe');
  });

  it('registers the hidden NapCat WebUI page route under QQBot account', () => {
    const source = readRouteSource('qqbot.ts');

    expect(source).toContain('QqBotAccountNapcatWebui');
    expect(source).toContain('/qqbot/account/:accountId/napcat-webui');
    expect(source).toContain('hideInMenu: true');
    expect(source).toContain("activePath: '/qqbot/account'");
  });
});
