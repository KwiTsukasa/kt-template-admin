import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(dirname, 'KtMilkdownEditor.tsx'), 'utf8');

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
});
