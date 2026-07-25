import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// eslint-disable-next-line n/no-extraneous-import -- TypeScript is the workspace compiler used for source-level contract checks.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type ExpectedMessagePushRoute = {
  componentPath: string;
  name: string;
  path: string;
  title: string;
};

const messagePushRoutes: ExpectedMessagePushRoute[] = [
  {
    componentPath: '#/views/qqbot/message-subscription/list',
    name: 'QqBotMessageSubscription',
    path: '/qqbot/message-subscription',
    title: '消息订阅',
  },
  {
    componentPath: '#/views/qqbot/message-template/list',
    name: 'QqBotMessageTemplate',
    path: '/qqbot/message-template',
    title: '消息模板',
  },
];

function getPropertyName(property: ts.ObjectLiteralElementLike) {
  if (!ts.isPropertyAssignment(property) || property.name === undefined) {
    return undefined;
  }

  return ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
    ? property.name.text
    : undefined;
}

function getProperty(object: ts.ObjectLiteralExpression, name: string) {
  return object.properties.find(
    (property): property is ts.PropertyAssignment =>
      getPropertyName(property) === name && ts.isPropertyAssignment(property),
  );
}

function getStringProperty(object: ts.ObjectLiteralExpression, name: string) {
  const property = getProperty(object, name);

  return property && ts.isStringLiteral(property.initializer)
    ? property.initializer.text
    : undefined;
}

function getLazyComponentPath(object: ts.ObjectLiteralExpression) {
  const component = getProperty(object, 'component');

  expect(component, 'route must declare a lazy component').toBeDefined();
  expect(component?.initializer).toSatisfy(ts.isArrowFunction);

  const body = (component?.initializer as ts.ArrowFunction).body;
  expect(body).toSatisfy(ts.isCallExpression);

  const importCall = body as ts.CallExpression;
  expect(importCall.expression.kind).toBe(ts.SyntaxKind.ImportKeyword);
  expect(importCall.arguments).toHaveLength(1);
  expect(importCall.arguments[0]).toSatisfy(ts.isStringLiteral);

  return (importCall.arguments[0] as ts.StringLiteral).text;
}

function getQqBotChildren(sourceFile: ts.SourceFile) {
  const routesDeclaration = sourceFile.statements.find(
    (statement): statement is ts.VariableStatement => {
      if (!ts.isVariableStatement(statement)) {
        return false;
      }

      return statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === 'routes',
      );
    },
  );
  const routesInitializer =
    routesDeclaration?.declarationList.declarations.find(
      (declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === 'routes',
    )?.initializer;

  expect(routesInitializer).toSatisfy(ts.isArrayLiteralExpression);

  const qqbotRoute = (
    routesInitializer as ts.ArrayLiteralExpression
  ).elements.find(
    (element): element is ts.ObjectLiteralExpression =>
      ts.isObjectLiteralExpression(element) &&
      getStringProperty(element, 'name') === 'QqBot',
  );

  expect(qqbotRoute, 'routes must contain a direct QqBot parent').toBeDefined();

  const children = getProperty(
    qqbotRoute as ts.ObjectLiteralExpression,
    'children',
  );
  expect(children?.initializer).toSatisfy(ts.isArrayLiteralExpression);

  return (children?.initializer as ts.ArrayLiteralExpression).elements.filter(
    (element) => ts.isObjectLiteralExpression(element),
  );
}

function getAllMessagePushRoutes(sourceFile: ts.SourceFile) {
  const routeNames = new Set(messagePushRoutes.map((route) => route.name));
  const matches: ts.ObjectLiteralExpression[] = [];

  function visit(node: ts.Node): void {
    if (ts.isObjectLiteralExpression(node)) {
      const routeName = getStringProperty(node, 'name');
      if (typeof routeName === 'string' && routeNames.has(routeName)) {
        matches.push(node);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return matches;
}

describe('qqbot routes', () => {
  it('adds exactly two flat message-push route children without loading future pages', () => {
    const sourceFile = ts.createSourceFile(
      'qqbot.ts',
      readFileSync(
        resolve('apps/web-antdv-next/src/router/routes/modules/qqbot.ts'),
        'utf8',
      ),
      ts.ScriptTarget.Latest,
      true,
    );
    const directChildren = getQqBotChildren(sourceFile);
    const allMessagePushRouteNodes = getAllMessagePushRoutes(sourceFile);

    expect(allMessagePushRouteNodes).toHaveLength(messagePushRoutes.length);

    for (const expectedRoute of messagePushRoutes) {
      const matchingDirectChildren = directChildren.filter(
        (route) => getStringProperty(route, 'name') === expectedRoute.name,
      );

      expect(matchingDirectChildren).toHaveLength(1);

      const route = matchingDirectChildren[0];
      if (!route) {
        return;
      }

      expect(getStringProperty(route, 'path')).toBe(expectedRoute.path);
      expect(getLazyComponentPath(route)).toBe(expectedRoute.componentPath);
      expect(getProperty(route, 'children')).toBeUndefined();

      const meta = getProperty(route, 'meta');
      expect(meta?.initializer).toSatisfy(ts.isObjectLiteralExpression);
      if (!meta || !ts.isObjectLiteralExpression(meta.initializer)) {
        return;
      }

      expect(getStringProperty(meta.initializer, 'title')).toBe(
        expectedRoute.title,
      );
      expect(getStringProperty(meta.initializer, 'icon')).toMatch(
        /^lucide:\S+$/,
      );
    }
  });
});
