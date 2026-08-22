import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

import { describe, expect, it } from 'vitest';

const accountRoot = resolve(cwd(), 'apps/web-antdv-next/src/views/bot/account');

const readAccountSource = (relativePath: string) =>
  readFileSync(resolve(accountRoot, relativePath), 'utf8');

const readRepoSource = (relativePath: string) =>
  readFileSync(resolve(cwd(), relativePath), 'utf8');

const readRouteSource = (relativePath: string) =>
  readFileSync(
    resolve(
      cwd(),
      'apps/web-antdv-next/src/router/routes/modules',
      relativePath,
    ),
    'utf8',
  );

describe('bot account NapCat login view boundary', () => {
  it('keeps login session state out of account/list.tsx', () => {
    const source = readAccountSource('list.tsx');

    expect(source).toContain('NapcatLoginModal');
    expect(source).not.toContain('EventSource');
    expect(source).not.toContain('TencentCaptcha');
    expect(source).not.toContain('useQRCode');
    expect(source).not.toContain('/bot/account/scan');
    expect(source).not.toContain('startBotAccountScan');
    expect(source).not.toContain('submitBotAccountScanCaptcha');
  });

  it('keeps official WebSocket/Webhook and App credentials out of the NapCat page', () => {
    const source = readAccountSource('list.tsx');

    expect(source).not.toContain('official-websocket');
    expect(source).not.toContain('official-webhook');
    expect(source).not.toContain('getBotOfficialWebhookUrl');
    expect(source).not.toContain('reconnectBotOfficial');
    expect(source).not.toContain("fieldName: 'appId'");
    expect(source).not.toContain("fieldName: 'appSecret'");
    expect(source).not.toContain("label: 'AppID'");
    expect(source).not.toContain("label: 'AppSecret'");
    expect(source).toContain("fieldName: 'accessToken'");
    expect(source).toContain("fieldName: 'loginPassword'");
    expect(source).toContain("connectionMode: 'reverse-ws'");
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

    expect(source).toContain("name: 'BotNapcatWebui'");
    expect(source).toContain('Bot:Account:WebUI');
    expect(source).not.toContain('createBotNapcatWebuiSession');
    expect(source).not.toContain('heartbeatBotNapcatWebuiSession');
    expect(source).not.toContain('revokeBotNapcatWebuiSession');
    expect(source).not.toContain('<iframe');
    expect(source).not.toContain('iframe');
  });

  it('registers separate NapCat and Tencent routes under Bot management', () => {
    const source = readRouteSource('bot.ts');

    expect(source).toContain("name: 'BotNapcatConnection'");
    expect(source).toContain("path: '/bot/napcat'");
    expect(source).toContain("name: 'BotNapcatWebui'");
    expect(source).toContain("path: '/bot/napcat/:accountId/webui'");
    expect(source).toContain('hideInMenu: true');
    expect(source).toContain("activePath: '/bot/napcat'");
    expect(source).toContain("name: 'BotTencentConnection'");
    expect(source).toContain("path: '/bot/tencent'");
    expect(source).not.toContain("name: 'BotAccountNapcatWebui'");
    expect(source).not.toContain(
      "path: '/bot/account/:accountId/napcat-webui'",
    );
  });

  it('exposes the NapCat WebUI gateway through the Admin same-origin dev and nginx routes', () => {
    const viteSource = readRepoSource('apps/web-antdv-next/vite.config.mts');
    const nginxSource = readRepoSource('deploy/nginx-admin.conf');

    expect(viteSource).toContain("'/napcat-webui'");
    expect(viteSource).toContain('http://localhost:48086');
    expect(nginxSource).toContain('location ^~ /napcat-webui/');
    expect(nginxSource).toContain('k3d-kt-nas-server-0:30086');
    expect(nginxSource).toContain('proxy_http_version 1.1');
    expect(nginxSource).toContain('location ^~ /kt-k8s-dashboard/');
  });

  it('publishes the Admin nginx route file during main-branch deployment', () => {
    const jenkinsSource = readRepoSource('Jenkinsfile');

    expect(jenkinsSource).toContain("booleanParam(name: 'DEPLOY_NGINX_CONFIG'");
    expect(jenkinsSource).toContain("string(name: 'NGINX_CONFIG_VOLUME_DIR'");
    expect(jenkinsSource).toContain(
      "string(name: 'NGINX_UPSTREAM_DOCKER_NETWORK'",
    );
    expect(jenkinsSource).toContain("stage('Deploy Nginx Config')");
    expect(jenkinsSource).toContain('docker network connect');
    expect(jenkinsSource).toContain('docker run --rm -i');
    expect(jenkinsSource).toContain('NGINX_CONFIG_SOURCE');
    expect(jenkinsSource).toContain('nginx -t');
    expect(jenkinsSource).toContain('nginx -s reload');
  });
});
