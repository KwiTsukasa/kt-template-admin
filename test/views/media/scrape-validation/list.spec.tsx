import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

import { describe, expect, it } from 'vitest';

describe('nas scrape validation page contract', () => {
  const source = readFileSync(
    resolve(
      cwd(),
      'apps/web-antdv-next/src/views/media/scrape-validation/list.tsx',
    ),
    'utf8',
  );
  const apiSource = readFileSync(
    resolve(
      cwd(),
      'apps/web-antdv-next/src/api/media-scrape-validation/index.ts',
    ),
    'utf8',
  );

  it('uses an independent list and revision-bound recheck API', () => {
    expect(source).toContain('getMediaScrapeValidationPage');
    expect(source).toContain(
      'recheckMediaScrapeValidation(row.id, row.revision)',
    );
    expect(source).toContain("rowVisible: (row) => row.status !== 'running'");
    expect(apiSource).toContain("'/media-scrape-validation/page'");
    expect(apiSource).toContain('`/media-scrape-validation/');
    expect(apiSource).toContain('/recheck`');
  });

  it('does not expose governance Task mutation or Codex fallback actions', () => {
    expect(source).not.toContain('startMediaGovernance');
    expect(source).not.toContain('MediaGovernanceApi.Task');
    expect(source).not.toMatch(/Codex|Agent|人工治理/u);
  });
});
