/* @vitest-environment node */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { cwd } from 'node:process';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(cwd(), 'apps/web-antdv-next/src');
const ktTableStylePath = resolve(
  sourceRoot,
  'components/kt-table/styles/table.scss',
);
const deprecatedProps = new Map<string, Set<string>>([
  ['Alert', new Set(['message'])],
  ['Card', new Set(['bodyStyle', 'bordered'])],
  [
    'Cascader',
    new Set([
      'bordered',
      'dropdownClassName',
      'dropdownMenuColumnStyle',
      'dropdownRender',
      'dropdownStyle',
      'popupClassName',
      'showArrow',
    ]),
  ],
  [
    'DatePicker',
    new Set(['bordered', 'dropdownClassName', 'popupClassName', 'popupStyle']),
  ],
  ['Divider', new Set(['orientationMargin', 'type'])],
  [
    'Drawer',
    new Set([
      'bodyStyle',
      'contentWrapperStyle',
      'destroyOnClose',
      'drawerStyle',
      'footerStyle',
      'headerStyle',
      'height',
      'maskClosable',
      'maskStyle',
      'width',
    ]),
  ],
  ['FloatButton', new Set(['description'])],
  [
    'Image',
    new Set([
      'maskClassName',
      'onVisibleChange',
      'rootClass',
      'toolbarRender',
      'visible',
      'wrapperStyle',
    ]),
  ],
  ['Modal', new Set(['bodyStyle', 'destroyOnClose', 'maskStyle'])],
  [
    'Popover',
    new Set(['overlayClassName', 'overlayInnerStyle', 'overlayStyle']),
  ],
  ['Progress', new Set(['gapPosition', 'strokeWidth', 'trailColor', 'width'])],
  [
    'Select',
    new Set([
      'bordered',
      'dropdownClassName',
      'dropdownMatchSelectWidth',
      'dropdownRender',
      'dropdownStyle',
      'popupClassName',
      'showArrow',
    ]),
  ],
  ['Slider', new Set(['handleStyle', 'railStyle', 'trackStyle'])],
  ['Space', new Set(['direction', 'split'])],
  ['Splitter', new Set(['layout'])],
  ['Steps', new Set(['direction', 'labelPlacement', 'progressDot'])],
  [
    'Table',
    new Set(['customCell', 'customRender', 'customRow', 'onResizeColumn']),
  ],
  [
    'Tabs',
    new Set([
      'destroyInactiveTabPane',
      'indicatorSize',
      'popupClassName',
      'tabPosition',
    ]),
  ],
  ['Tag', new Set(['bordered'])],
  [
    'Tooltip',
    new Set(['overlayClassName', 'overlayInnerStyle', 'overlayStyle']),
  ],
  [
    'TreeSelect',
    new Set([
      'bordered',
      'dropdownClassName',
      'dropdownMatchSelectWidth',
      'dropdownRender',
      'dropdownStyle',
      'popupClassName',
      'showArrow',
    ]),
  ],
]);

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(entryPath);
    if (extname(entry.name) !== '.tsx') return [];
    return [entryPath];
  });
}

function findDeprecatedVueTemplateProps() {
  const patterns = [
    /<(?:a-?)?alert\b[^>]*\b:?message\s*=/iu,
    /<(?:a-?)?divider\b[^>]*\b:?type\s*=\s*['"]vertical['"]/iu,
    /<(?:a-?)?popover\b[^>]*\b:?overlay-class-name\s*=/iu,
    /<(?:a-?)?space\b[^>]*\b:?direction\s*=/iu,
  ];
  const vueFiles: string[] = [];

  function collectVueFiles(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        collectVueFiles(entryPath);
        continue;
      }
      if (extname(entry.name) === '.vue') vueFiles.push(entryPath);
    }
  }

  collectVueFiles(sourceRoot);
  return vueFiles.flatMap((filePath) => {
    const source = readFileSync(filePath, 'utf8');
    for (const pattern of patterns) {
      if (!pattern.test(source)) continue;
      return [filePath.replace(`${sourceRoot}/`, '')];
    }
    return [];
  });
}

function collectImportedComponents(sourceFile: ts.SourceFile) {
  const components = new Map<string, string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (statement.moduleSpecifier.getText(sourceFile) !== "'antdv-next'") {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      components.set(
        element.name.text,
        element.propertyName?.text || element.name.text,
      );
    }
  }

  let aliasesAdded = true;
  while (aliasesAdded) {
    aliasesAdded = false;
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          continue;
        }
        let expression = declaration.initializer;
        while (ts.isAsExpression(expression))
          expression = expression.expression;
        if (!ts.isIdentifier(expression)) continue;
        const component = components.get(expression.text);
        if (!component || components.has(declaration.name.text)) continue;
        components.set(declaration.name.text, component);
        aliasesAdded = true;
      }
    }
  }

  return components;
}

function findDeprecatedProps() {
  return collectTsxFiles(sourceRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const components = collectImportedComponents(sourceFile);
    const findings: string[] = [];

    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const component = components.get(node.tagName.getText(sourceFile));
        let componentDeprecatedProps: Set<string> | undefined;
        if (component) {
          componentDeprecatedProps = deprecatedProps.get(component);
        }
        if (component && componentDeprecatedProps) {
          for (const attribute of node.attributes.properties) {
            if (!ts.isJsxAttribute(attribute)) continue;
            const prop = attribute.name.getText(sourceFile);
            if (!componentDeprecatedProps.has(prop)) continue;
            const position = sourceFile.getLineAndCharacterOfPosition(
              attribute.getStart(sourceFile),
            );
            findings.push(
              `${filePath.replace(`${sourceRoot}/`, '')}:${position.line + 1} ${component}.${prop}`,
            );
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return findings;
  });
}

describe('antdv-next 1.5 API compatibility', () => {
  it('keeps the table Spin wrapper at full height', () => {
    const source = readFileSync(ktTableStylePath, 'utf8');

    expect(source).toContain('&__ant > .ant-spin,');
  });

  it('does not use deprecated component props in TSX', () => {
    expect(findDeprecatedProps()).toEqual([]);
  });

  it('does not use deprecated template props in remaining Vue components', () => {
    expect(findDeprecatedVueTemplateProps()).toEqual([]);
  });
});
