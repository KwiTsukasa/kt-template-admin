import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const GOVERNANCE_ROOTS = [
  'apps/web-antdv-next/src/api/media-governance',
  'apps/web-antdv-next/src/views/media/governance',
  'apps/web-antdv-next/src/router/routes/modules/media-governance.ts',
];
const CHINESE_CHARACTER_PATTERN = /\p{Script=Han}/u;
const FORBIDDEN_JSDOC_ENTRY_NAMES = new Set([
  'activated',
  'beforeCreate',
  'beforeDestroy',
  'beforeMount',
  'beforeUnmount',
  'beforeUpdate',
  'created',
  'deactivated',
  'destroyed',
  'errorCaptured',
  'mounted',
  'renderTracked',
  'renderTriggered',
  'serverPrefetch',
  'setup',
  'unmounted',
  'updated',
]);

/** 递归收集媒体治理生产面的 TypeScript 和 TSX 文件。 */
function collectGovernanceFiles(targetPath: string): string[] {
  if (statSync(targetPath).isFile()) return [targetPath];
  return readdirSync(targetPath).flatMap((entry) => {
    const childPath = path.join(targetPath, entry);
    if (statSync(childPath).isDirectory()) {
      return collectGovernanceFiles(childPath);
    }
    if (!/\.tsx?$/u.test(childPath) || childPath.endsWith('.d.ts')) return [];
    return [childPath];
  });
}

const GOVERNANCE_FILES = GOVERNANCE_ROOTS.flatMap((root) =>
  collectGovernanceFiles(root),
);

/** 返回允许放置中文 JSDoc 的具名函数名称。 */
function namedDocumentableFunction(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): null | string {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    if (!node.name || !node.body) return null;
    return node.name.getText(sourceFile);
  }
  if (
    !ts.isMethodDeclaration(node) &&
    !ts.isGetAccessorDeclaration(node) &&
    !ts.isSetAccessorDeclaration(node)
  ) {
    return null;
  }
  if (!node.body) return null;
  const name = node.name.getText(sourceFile).replaceAll(/["']/gu, '');
  if (FORBIDDEN_JSDOC_ENTRY_NAMES.has(name)) return null;
  return name;
}

/** 判断具名函数是否带有包含中文说明的合法 JSDoc。 */
function hasChineseJsdoc(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  return ts
    .getJSDocCommentsAndTags(node)
    .some((comment) =>
      CHINESE_CHARACTER_PATTERN.test(comment.getText(sourceFile)),
    );
}

/** 根据文件扩展名选择 TypeScript 解析模式。 */
function resolveScriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('x')) return ts.ScriptKind.TSX;
  return ts.ScriptKind.TS;
}

/** 统计同一个条件中的逻辑判断叶子数量。 */
function countLogicalLeaves(node: ts.Expression): number {
  if (ts.isParenthesizedExpression(node)) {
    return countLogicalLeaves(node.expression);
  }
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return countLogicalLeaves(node.left) + countLogicalLeaves(node.right);
  }
  return 1;
}

/** 按文件和行号收集媒体治理代码的可维护性违规。 */
function collectMaintainabilityViolations() {
  const ternaries: string[] = [];
  const missingJsdocs: string[] = [];
  const longConditions: string[] = [];

  for (const file of GOVERNANCE_FILES) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      resolveScriptKind(file),
    );
    const visit = (node: ts.Node) => {
      const line =
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      if (ts.isConditionalExpression(node)) ternaries.push(`${file}:${line}`);
      if (ts.isIfStatement(node) && countLogicalLeaves(node.expression) >= 6) {
        longConditions.push(`${file}:${line}`);
      }
      const functionName = namedDocumentableFunction(node, source);
      if (functionName && !hasChineseJsdoc(node, source)) {
        missingJsdocs.push(`${file}:${line} ${functionName}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return { longConditions, missingJsdocs, ternaries };
}

/** 用有界定位信息报告完整违规计数，避免测试输出淹没有效上下文。 */
function expectNoViolations(label: string, violations: string[]): void {
  if (violations.length === 0) return;
  const visibleViolations = violations.slice(0, 20).join('\n');
  throw new Error(`${label}：${violations.length} 项\n${visibleViolations}`);
}

const MAINTAINABILITY_VIOLATIONS = collectMaintainabilityViolations();

describe('media governance task UI maintainability contract', () => {
  it('uses explicit branches or named projections instead of conditional expressions', () => {
    expectNoViolations('条件三元表达式', MAINTAINABILITY_VIOLATIONS.ternaries);
  });

  it('documents every legal named function with meaningful Chinese JSDoc', () => {
    expectNoViolations(
      '缺失中文 JSDoc',
      MAINTAINABILITY_VIOLATIONS.missingJsdocs,
    );
  });

  it('splits heterogeneous long condition chains into named checks', () => {
    expectNoViolations('超长条件链', MAINTAINABILITY_VIOLATIONS.longConditions);
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
