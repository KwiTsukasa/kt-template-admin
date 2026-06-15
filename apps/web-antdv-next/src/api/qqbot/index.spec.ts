import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const readApiFile = (name: string) =>
  readFileSync(new URL(name, import.meta.url), 'utf8');

describe('qqbot core API caller boundary', () => {
  it('keeps plugin platform and NapCat scan routes out of the core caller', () => {
    const source = readApiFile('index.ts');

    expect(source).not.toContain('/qqbot/plugin');
    expect(source).not.toContain('/qqbot/plugin-platform');
    expect(source).not.toContain('/qqbot/account/scan');
  });

  it('keeps domain-specific caller routes in plugin and napcat callers', () => {
    expect(readApiFile('plugin.ts')).toEqual(
      expect.stringContaining('/qqbot/plugin/operation/page'),
    );
    expect(readApiFile('plugin.ts')).toEqual(
      expect.stringContaining('/qqbot/plugin-platform/runtime-events'),
    );
    expect(readApiFile('napcat.ts')).toEqual(
      expect.stringContaining('/qqbot/account/scan/events'),
    );
  });
});
