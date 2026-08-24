import { globSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = 'apps/web-antdv-next/src';
const SOURCE_FILES = globSync(['**/*.tsx', '**/*.vue'], {
  cwd: SOURCE_ROOT,
}).toSorted();
const SOURCES = SOURCE_FILES.map((file) => ({
  file,
  source: readFileSync(`${SOURCE_ROOT}/${file}`, 'utf8'),
}));
const DIRECT_ANTDV_MODAL_IMPORT =
  /import\s*\{[^}]*\bModal\b[^}]*\}\s*from 'antdv-next';/u;
const DIRECT_ANTDV_FORM_IMPORT =
  /import\s*\{[^}]*(?:\bForm\b|\bFormItem\b)[^}]*\}\s*from 'antdv-next';/u;

describe('vben modal and form project contract', () => {
  it('rejects declarative Antdv Modal and Form containers across Admin source', () => {
    const directModalContainers = SOURCES.filter(
      ({ source }) =>
        DIRECT_ANTDV_MODAL_IMPORT.test(source) &&
        (/<AModal\b/u.test(source) || /<Modal\b/u.test(source)),
    ).map(({ file }) => file);
    const directFormContainers = SOURCES.filter(({ source }) =>
      DIRECT_ANTDV_FORM_IMPORT.test(source),
    ).map(({ file }) => file);

    expect(directModalContainers).toEqual([]);
    expect(directFormContainers).toEqual([]);
  });

  it('keeps every audited business editor on Vben common state contracts', () => {
    const formModalFiles = [
      'components/rich-text/KtTiptapHtmlEditor.tsx',
      'views/media/governance/series/detail.tsx',
      'views/media/governance/series/SeriesWorkCreateModal.tsx',
      'views/plugin-platform/plugin/components/PluginManifestModal.tsx',
      'views/plugin-platform/task/components/TaskCronModal.tsx',
    ];
    for (const file of formModalFiles) {
      const source = readFileSync(`${SOURCE_ROOT}/${file}`, 'utf8');
      expect(source).toContain('useVbenModal');
      expect(source).toContain('useVbenForm');
    }

    const profileSource = readFileSync(
      `${SOURCE_ROOT}/views/_core/profile/index.tsx`,
      'utf8',
    );
    expect(profileSource).toContain('useVbenModal');
    expect(profileSource).not.toContain('<AModal');
  });

  it('allows Antdv Modal only for one-shot confirm calls without JSX containers', () => {
    const confirmationFiles = SOURCES.filter(({ source }) =>
      DIRECT_ANTDV_MODAL_IMPORT.test(source),
    );
    expect(confirmationFiles.length).toBeGreaterThan(0);
    for (const { source } of confirmationFiles) {
      expect(source).toContain('Modal.confirm');
      expect(source).not.toMatch(/<A?Modal\b/u);
    }
  });
});
