import { readFileSync } from 'node:fs';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const GOVERNANCE_FILES = [
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceSourceFormDrawer.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceSourceMappingDrawer.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskAgentPanel.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskDrawer.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskEvidencePanel.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskMappingsPanel.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskMetadataPanel.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskOverviewPanel.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskRunPanel.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskSourcesPanel.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskSubtitlesPanel.tsx',
  'apps/web-antdv-next/src/views/media/governance/tasks/source-selection-contract.ts',
  'apps/web-antdv-next/src/views/media/governance/tasks/task-operation-contract.ts',
];

describe('media governance task UI maintainability contract', () => {
  it('uses explicit branches or named projections instead of conditional expressions', () => {
    const violations = GOVERNANCE_FILES.flatMap((file) => {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const lines: number[] = [];
      function visit(node: ts.Node) {
        if (ts.isConditionalExpression(node)) {
          lines.push(
            source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          );
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
      return lines.map((line) => `${file}:${line}`);
    });

    expect(violations).toEqual([]);
  });

  it('keeps business form controls on the shared antdv-next and Vben wrappers', () => {
    const componentFiles = GOVERNANCE_FILES.filter((file) =>
      file.endsWith('.tsx'),
    );
    const violations = componentFiles.filter((file) =>
      /<(?:button|input|select|textarea)\b/iu.test(readFileSync(file, 'utf8')),
    );

    expect(violations).toEqual([]);
  });
});
