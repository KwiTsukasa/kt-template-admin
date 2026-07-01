import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(dirname, 'KtMilkdownEditor.tsx'), 'utf8');
const styleSource = readFileSync(
  path.join(dirname, 'KtMilkdownEditor.scss'),
  'utf8',
);

describe('ktMilkdownEditor styles', () => {
  it('loads Crepe base layout styles before the selected theme variables', () => {
    const commonStyleIndex = source.indexOf(
      "import '@milkdown/crepe/theme/common/style.css';",
    );
    const frameThemeIndex = source.indexOf(
      "import '@milkdown/crepe/theme/frame.css';",
    );

    expect(commonStyleIndex).toBeGreaterThanOrEqual(0);
    expect(frameThemeIndex).toBeGreaterThan(commonStyleIndex);
  });

  it('maps Crepe theme variables to Admin design tokens', () => {
    expect(styleSource).toContain(
      '--crepe-color-background: hsl(var(--background));',
    );
    expect(styleSource).toContain('--crepe-color-surface: hsl(var(--card));');
    expect(styleSource).toContain(
      '--crepe-color-primary: hsl(var(--primary));',
    );
  });

  it('keeps the first empty editor render from creating an internal scrollbar', () => {
    expect(styleSource).toMatch(
      /\.kt-milkdown-editor\s*\{[\s\S]*?height:\s*var\(--kt-milkdown-min-height,\s*360px\);/,
    );
    expect(styleSource).toMatch(/&__root\s*\{[\s\S]*?overflow:\s*hidden;/);
    expect(styleSource).toMatch(
      /\.milkdown \.editor\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?flex:\s*1;[\s\S]*?overflow:\s*auto;/,
    );
    expect(styleSource).toMatch(
      /\.milkdown \.ProseMirror\s*\{[\s\S]*?padding:\s*18px 22px;/,
    );
  });
});
