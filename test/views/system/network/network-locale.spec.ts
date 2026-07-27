import { i18n } from '@vben/locales';

import { afterEach, describe, expect, it, vi } from 'vitest';

import enSystem from '#/locales/langs/en-US/system.json';
import zhSystem from '#/locales/langs/zh-CN/system.json';

const testLocales = ['network-en-US', 'network-zh-CN'];

afterEach(() => {
  vi.restoreAllMocks();
  for (const locale of testLocales) {
    i18n.global.setLocaleMessage(locale, {});
  }
});

describe.each([
  ['network-en-US', enSystem.network],
  ['network-zh-CN', zhSystem.network],
])('network locale message syntax: %s', (locale, networkMessages) => {
  it('compiles every message through the production i18n runtime', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    i18n.global.setLocaleMessage(locale, {
      system: { network: networkMessages },
    });
    i18n.global.locale.value = locale;

    for (const key of Object.keys(networkMessages)) {
      i18n.global.t(`system.network.${key}`);
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('contains the complete group, channel, DDNS endpoint and validation labels', () => {
    expect(networkMessages).toMatchObject({
      accessEndpoint: expect.any(String),
      appliedProtocolMode: expect.any(String),
      ddnsDomainRequired: expect.any(String),
      ddnsNameRequired: expect.any(String),
      ddnsSubDomainRequired: expect.any(String),
      disableMechanismsBeforeEdit: expect.any(String),
      dnsAddress: expect.any(String),
      natmapState: expect.any(String),
      portRequired: expect.any(String),
      protocolMode: expect.any(String),
      protocolModeRequired: expect.any(String),
      rawEndpoint: expect.any(String),
      tcpStaticState: expect.any(String),
      udpStaticState: expect.any(String),
    });
    expect(Object.values(networkMessages)).not.toContain('required');
  });
});
