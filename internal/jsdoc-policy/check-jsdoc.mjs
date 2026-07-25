#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';
import { parse as parseVueSfc } from 'vue/compiler-sfc';

const CODE_FILE_PATTERN = /\.(?:cjs|js|mjs|ts|tsx|vue)$/u;
const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;
const JSDOC_PREFIX = '/**';
const ENGLISH_FUNCTION_WORDS = new Set([
  'a',
  'after',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'before',
  'by',
  'for',
  'from',
  'if',
  'in',
  'into',
  'is',
  'of',
  'on',
  'or',
  'otherwise',
  'that',
  'the',
  'these',
  'this',
  'those',
  'to',
  'was',
  'when',
  'whether',
  'with',
]);
const ENGLISH_DESCRIPTION_VERBS = new Set([
  'build',
  'check',
  'cleanup',
  'convert',
  'create',
  'delete',
  'determine',
  'ensure',
  'fetch',
  'format',
  'get',
  'handle',
  'initialize',
  'load',
  'parse',
  'read',
  'remove',
  'render',
  'resolve',
  'return',
  'save',
  'send',
  'set',
  'transform',
  'update',
  'use',
  'validate',
  'write',
]);
const DESCRIPTION_TAG_NAMES = new Set([
  'arg',
  'argument',
  'deprecated',
  'description',
  'exception',
  'param',
  'prop',
  'property',
  'remarks',
  'return',
  'returns',
  'see',
  'summary',
  'template',
  'throws',
  'todo',
  'typeparam',
  'yield',
  'yields',
]);
const PARAMETER_TAG_NAMES = new Set([
  'arg',
  'argument',
  'param',
  'prop',
  'property',
  'template',
  'typeparam',
]);
const RETURN_TAG_NAMES = new Set(['return', 'returns', 'yield', 'yields']);
const MARKER_TAG_NAMES = new Set([
  'abstract',
  'async',
  'generator',
  'inheritdoc',
  'internal',
  'override',
  'private',
  'protected',
  'public',
  'readonly',
  'static',
]);
const STRUCTURAL_TAG_NAMES = new Set([
  'alias',
  'author',
  'borrows',
  'callback',
  'constant',
  'constructs',
  'copyright',
  'default',
  'defaultvalue',
  'enum',
  'exports',
  'extends',
  'external',
  'fires',
  'implements',
  'kind',
  'license',
  'link',
  'listens',
  'member',
  'memberof',
  'mixes',
  'module',
  'name',
  'namespace',
  'requires',
  'satisfies',
  'since',
  'this',
  'type',
  'typedef',
  'version',
]);
const TYPE_ONLY_WORDS = new Set([
  'any',
  'bigint',
  'boolean',
  'never',
  'null',
  'number',
  'object',
  'string',
  'symbol',
  'undefined',
  'unknown',
  'void',
]);

const LIFECYCLE_METHOD_NAMES = new Set([
  'activated',
  'beforeCreate',
  'beforeDestroy',
  'beforeMount',
  'beforeRouteEnter',
  'beforeRouteLeave',
  'beforeRouteUpdate',
  'beforeUnmount',
  'beforeUpdate',
  'componentDidCatch',
  'componentDidMount',
  'componentDidUpdate',
  'componentWillMount',
  'componentWillReceiveProps',
  'componentWillUnmount',
  'componentWillUpdate',
  'created',
  'deactivated',
  'destroyed',
  'errorCaptured',
  'getDerivedStateFromError',
  'getDerivedStateFromProps',
  'getSnapshotBeforeUpdate',
  'mounted',
  'renderTracked',
  'renderTriggered',
  'serverPrefetch',
  'shouldComponentUpdate',
  'unmounted',
  'updated',
]);

function getIsolatedGitEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
}

function isPathInside(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

function getStagedGitEnvironment(rootDirectory) {
  const environment = getIsolatedGitEnvironment();
  const indexFile = process.env.GIT_INDEX_FILE;

  if (!indexFile) {
    return environment;
  }

  const gitDirectory = execFileSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-dir'],
    {
      cwd: rootDirectory,
      encoding: 'utf8',
      env: environment,
    },
  ).trim();
  const commonDirectory = execFileSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    {
      cwd: rootDirectory,
      encoding: 'utf8',
      env: environment,
    },
  ).trim();
  const absoluteIndexFile = path.resolve(rootDirectory, indexFile);

  if (
    isPathInside(gitDirectory, absoluteIndexFile) ||
    isPathInside(commonDirectory, absoluteIndexFile)
  ) {
    environment.GIT_INDEX_FILE = absoluteIndexFile;
  }

  return environment;
}

function getLineStarts(source) {
  const starts = [0];

  for (let index = 0; index < source.length; index += 1) {
    const character = source.codePointAt(index);
    if (character === 13) {
      if (source.codePointAt(index + 1) === 10) {
        index += 1;
      }
      starts.push(index + 1);
    } else if (character === 10) {
      starts.push(index + 1);
    }
  }

  return starts;
}

function getLineAndColumn(lineStarts, position) {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lineStarts[middle] <= position) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const lineIndex = Math.max(0, high);
  return {
    column: position - lineStarts[lineIndex] + 1,
    line: lineIndex + 1,
  };
}

function stripLeadingTypeExpression(value) {
  const trimmedValue = value.trimStart();
  if (!trimmedValue.startsWith('{')) {
    return trimmedValue;
  }

  let depth = 0;
  for (let index = 0; index < trimmedValue.length; index += 1) {
    const character = trimmedValue[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return trimmedValue.slice(index + 1).trimStart();
      }
    }
  }

  return trimmedValue;
}

function isTypeOnlyDescription(value) {
  const normalizedValue = value.trim();
  if (normalizedValue === '') {
    return true;
  }

  const typeParts = normalizedValue.split(/\s*[|&]\s*/u);
  return typeParts.every((part) => {
    const arraylessPart = part.replaceAll(/\[\]$/gu, '');
    if (TYPE_ONLY_WORDS.has(arraylessPart)) {
      return true;
    }
    return /^[A-Z_$][\w$]*(?:<.+>)?$/u.test(arraylessPart);
  });
}

function getTagDescription(tagName, rawValue) {
  if (tagName === 'example') {
    return null;
  }
  if (STRUCTURAL_TAG_NAMES.has(tagName)) {
    const separatorIndex = rawValue.indexOf(' - ');
    return separatorIndex === -1
      ? null
      : rawValue.slice(separatorIndex + 3).trim() || null;
  }
  if (tagName === 'see') {
    const separatorIndex = rawValue.indexOf(' - ');
    return separatorIndex === -1
      ? null
      : rawValue.slice(separatorIndex + 3).trim() || null;
  }
  if (!DESCRIPTION_TAG_NAMES.has(tagName) && !MARKER_TAG_NAMES.has(tagName)) {
    return rawValue.trim() || null;
  }

  let value = stripLeadingTypeExpression(rawValue);
  if (PARAMETER_TAG_NAMES.has(tagName)) {
    value = value
      .replace(/^(?:\[[^\]]+\]|[^\s-]+)\s*/u, '')
      .replace(/^-\s*/u, '');
  } else if (RETURN_TAG_NAMES.has(tagName) && isTypeOnlyDescription(value)) {
    return null;
  } else if (
    (tagName === 'throws' || tagName === 'exception') &&
    isTypeOnlyDescription(value)
  ) {
    return null;
  }

  const description = value.trim();
  return description === '' ? null : description;
}

function getJsdocDescriptionUnits(rawComment) {
  const bodyLines = rawComment
    .replace(/^\/\*\*/u, '')
    .replace(/\*\/$/u, '')
    .split(/\r\n|\r|\n/gu)
    .map((line) => line.replace(/^\s*\*\s?/u, '').trimEnd());
  const units = [];
  let current = {
    context: '主说明',
    lines: [],
    startLineOffset: 0,
    tagName: null,
  };
  let insideFence = false;

  function flushCurrent() {
    const firstContentLine = current.lines.findIndex(
      (line) => line.trim() !== '',
    );
    if (firstContentLine === -1) {
      return;
    }
    const rawValue = current.lines.slice(firstContentLine).join('\n').trim();
    if (rawValue === '') {
      return;
    }
    const lineOffset = current.startLineOffset + firstContentLine;

    if (current.tagName === null) {
      units.push({ context: current.context, lineOffset, text: rawValue });
      return;
    }

    const description = getTagDescription(current.tagName, rawValue);
    if (description !== null) {
      units.push({ context: current.context, lineOffset, text: description });
    }
  }

  for (const [lineOffset, line] of bodyLines.entries()) {
    const fenceCount = line.match(/```/gu)?.length ?? 0;
    if (insideFence) {
      current.lines.push(line);
      if (fenceCount % 2 === 1) {
        insideFence = false;
      }
      continue;
    }
    if (fenceCount > 0) {
      current.lines.push(line);
      if (fenceCount % 2 === 1) {
        insideFence = true;
      }
      continue;
    }
    if (current.tagName === null && line.trim() === '') {
      flushCurrent();
      current = {
        context: '主说明',
        lines: [],
        startLineOffset: lineOffset + 1,
        tagName: null,
      };
      continue;
    }

    const tagMatch = line.match(/^@([A-Za-z][\w-]*)(?:\s(.*))?$/u);
    if (tagMatch) {
      if (current.tagName === 'example' && /^[A-Z]/u.test(tagMatch[1])) {
        continue;
      }
      flushCurrent();
      const tagName = tagMatch[1].toLowerCase();
      current = {
        context: `@${tagName}`,
        lines: tagName === 'example' ? [] : [tagMatch[2] ?? ''],
        startLineOffset: lineOffset,
        tagName,
      };
      continue;
    }

    if (current.tagName !== 'example') {
      current.lines.push(line);
    }
  }
  flushCurrent();

  return units;
}

function maskNeutralDescriptionFragments(value) {
  return value
    .replaceAll(/```[\s\S]*?```/gu, ' ')
    .replaceAll(/`[^`\r\n]*`/gu, ' ')
    .replaceAll(/\{@(?:code|link|linkcode|linkplain)\s[^}]+\}/giu, ' ')
    .replaceAll(/\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/gu, '$1')
    .replaceAll(/\bhttps?:\/\/[^\s)]+/giu, ' ')
    .replaceAll(/\{[A-Za-z_$][^{}\r\n]*\}/gu, ' ');
}

function getEnglishWords(value) {
  return value.match(/[A-Za-z][\w$-]*/gu) ?? [];
}

function isStrongTechnicalWord(word) {
  return (
    /^[A-Z]{2}[A-Z0-9]*$/u.test(word) ||
    /[0-9_$]/u.test(word) ||
    /[a-z][A-Z]/u.test(word) ||
    /[A-Z].*[A-Z]/u.test(word)
  );
}

function normalizeDescriptionVerb(word) {
  const normalizedWord = word.toLowerCase();
  const withoutIng = normalizedWord.replace(/ing$/u, '');
  const withoutEd = normalizedWord.replace(/ed$/u, '');
  const candidates = [
    normalizedWord,
    normalizedWord.replace(/ies$/u, 'y'),
    withoutIng,
    `${withoutIng}e`,
    withoutEd,
    `${withoutEd}e`,
    normalizedWord.replace(/es$/u, ''),
    normalizedWord.replace(/s$/u, ''),
  ];
  return candidates.find((candidate) =>
    ENGLISH_DESCRIPTION_VERBS.has(candidate),
  );
}

function hasEnglishClause(value) {
  const ordinaryWords = getEnglishWords(value).filter(
    (word) => !isStrongTechnicalWord(word),
  );
  const normalizedWords = ordinaryWords.map((word) => word.toLowerCase());

  if (
    ordinaryWords.length >= 2 &&
    normalizedWords.some((word) => ENGLISH_FUNCTION_WORDS.has(word))
  ) {
    return true;
  }
  if (
    ordinaryWords.length >= 2 &&
    normalizeDescriptionVerb(ordinaryWords[0]) !== undefined
  ) {
    const verbIndex = value.indexOf(ordinaryWords[0]);
    const prefix = verbIndex === -1 ? '' : value.slice(0, verbIndex);
    const prefixHanCount = prefix.match(/\p{Script=Han}/gu)?.length ?? 0;
    if (
      prefix.trim() === '' ||
      prefixHanCount <= 2 ||
      /[,，:：]\s*$/u.test(prefix)
    ) {
      return true;
    }
  }

  const hanCount = value.match(/\p{Script=Han}/gu)?.length ?? 0;
  return ordinaryWords.length >= 4 && ordinaryWords.length > hanCount;
}

function isPureTechnicalContinuation(value) {
  const words = getEnglishWords(value);
  if (words.length === 0 || words.length > 3) {
    return false;
  }
  if (
    words.some((word) => ENGLISH_FUNCTION_WORDS.has(word.toLowerCase())) ||
    normalizeDescriptionVerb(words[0]) !== undefined
  ) {
    return false;
  }

  return words.some(
    (word) => isStrongTechnicalWord(word) || /^[A-Z][a-z]+$/u.test(word),
  );
}

function findNonChineseDescription(rawComment) {
  for (const unit of getJsdocDescriptionUnits(rawComment)) {
    const maskedText = maskNeutralDescriptionFragments(unit.text);
    const unitHasHan = HAN_CHARACTER_PATTERN.test(maskedText);
    const lines = maskedText.split(/\r\n|\r|\n/gu);

    for (const [lineOffset, line] of lines.entries()) {
      const segments = line.split(/[。！？!?；;]+|(?<=\.)\s+/gu);
      for (const segment of segments) {
        const normalizedSegment = segment.trim();
        if (!/[\p{L}\p{N}]/u.test(normalizedSegment)) {
          continue;
        }
        const segmentHasHan = HAN_CHARACTER_PATTERN.test(normalizedSegment);
        if (!segmentHasHan) {
          if (unitHasHan && isPureTechnicalContinuation(normalizedSegment)) {
            continue;
          }
          return {
            context: unit.context,
            lineOffset: unit.lineOffset + lineOffset,
          };
        }
        if (hasEnglishClause(normalizedSegment)) {
          return {
            context: unit.context,
            lineOffset: unit.lineOffset + lineOffset,
          };
        }
      }
    }
  }

  return null;
}

function getScriptKind(filePath, language) {
  const normalizedLanguage = language?.toLowerCase();

  if (normalizedLanguage === 'tsx' || filePath.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }
  if (normalizedLanguage === 'jsx') {
    return ts.ScriptKind.JSX;
  }
  if (
    normalizedLanguage === 'ts' ||
    filePath.endsWith('.ts') ||
    filePath.endsWith('.mts') ||
    filePath.endsWith('.cts')
  ) {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.JS;
}

function getVueScriptBlocks(filePath, source) {
  const { descriptor, errors } = parseVueSfc(source, {
    filename: filePath,
    sourceMap: false,
  });

  if (errors.length > 0) {
    const message = errors
      .map((error) => (error instanceof Error ? error.message : String(error)))
      .join('; ');
    throw new Error(`Vue SFC 解析失败：${message}`);
  }

  return [
    descriptor.script
      ? {
          content: descriptor.script.content,
          label: '<script>',
          language: descriptor.script.lang,
          offset: descriptor.script.loc.start.offset,
        }
      : null,
    descriptor.scriptSetup
      ? {
          content: descriptor.scriptSetup.content,
          label: '<script setup>',
          language: descriptor.scriptSetup.lang,
          offset: descriptor.scriptSetup.loc.start.offset,
        }
      : null,
  ]
    .filter(Boolean)
    .toSorted((left, right) => left.offset - right.offset);
}

function getScriptBlocks(filePath, source) {
  if (filePath.endsWith('.vue')) {
    return getVueScriptBlocks(filePath, source);
  }

  return [
    {
      content: source,
      label: null,
      language: path.extname(filePath).slice(1),
      offset: 0,
    },
  ];
}

function getNodeName(node, sourceFile) {
  if (!node.name) {
    return null;
  }
  if (
    ts.isIdentifier(node.name) ||
    ts.isPrivateIdentifier(node.name) ||
    ts.isStringLiteralLike(node.name) ||
    ts.isNumericLiteral(node.name)
  ) {
    return node.name.text;
  }
  if (ts.isComputedPropertyName(node.name)) {
    const expression = node.name.expression;
    if (ts.isStringLiteralLike(expression) || ts.isNumericLiteral(expression)) {
      return expression.text;
    }
  }
  return node.name.getText(sourceFile);
}

function getFunctionExpressionRole(node, sourceFile) {
  let expression = node;
  while (
    (ts.isParenthesizedExpression(expression.parent) ||
      ts.isAsExpression(expression.parent) ||
      ts.isTypeAssertionExpression(expression.parent) ||
      ts.isNonNullExpression(expression.parent) ||
      ts.isSatisfiesExpression(expression.parent)) &&
    expression.parent.expression === expression
  ) {
    expression = expression.parent;
  }

  const parent = expression.parent;
  if (
    (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) &&
    parent.initializer === expression
  ) {
    return getNodeName(parent, sourceFile);
  }

  return null;
}

function classifyTarget(node, sourceFile) {
  if (!node) {
    return { allowed: false, target: 'unattached' };
  }

  if (ts.isFunctionDeclaration(node)) {
    const name = getNodeName(node, sourceFile);
    if (!name) {
      return { allowed: false, target: 'anonymous-function-declaration' };
    }
    return { allowed: true, target: 'named-function-declaration' };
  }

  if (ts.isFunctionExpression(node)) {
    const name = getNodeName(node, sourceFile);
    if (!name) {
      return { allowed: false, target: 'anonymous-function-expression' };
    }
    const role = getFunctionExpressionRole(node, sourceFile);
    if (role === 'setup') {
      return { allowed: false, target: 'setup' };
    }
    if (role && LIFECYCLE_METHOD_NAMES.has(role)) {
      return { allowed: false, target: 'lifecycle-entry' };
    }
    return { allowed: true, target: 'named-function-expression' };
  }

  if (
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  ) {
    const name = getNodeName(node, sourceFile);
    if (name === 'setup') {
      return { allowed: false, target: 'setup' };
    }
    if (name && LIFECYCLE_METHOD_NAMES.has(name)) {
      return { allowed: false, target: 'lifecycle-entry' };
    }
    return {
      allowed: Boolean(name),
      target: ts.isMethodDeclaration(node) ? 'named-method' : 'accessor',
    };
  }

  if (ts.isConstructorDeclaration(node)) {
    return { allowed: false, target: 'constructor' };
  }
  if (ts.isArrowFunction(node)) {
    return { allowed: false, target: 'arrow-function' };
  }
  if (ts.isInterfaceDeclaration(node)) {
    return { allowed: false, target: 'interface' };
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return { allowed: false, target: 'type' };
  }
  if (
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isShorthandPropertyAssignment(node)
  ) {
    return { allowed: false, target: 'property' };
  }
  if (
    ts.isVariableDeclaration(node) ||
    ts.isVariableDeclarationList(node) ||
    ts.isVariableStatement(node)
  ) {
    return { allowed: false, target: 'variable' };
  }
  if (
    ts.isMethodSignature(node) ||
    ts.isCallSignatureDeclaration(node) ||
    ts.isConstructSignatureDeclaration(node) ||
    ts.isFunctionTypeNode(node)
  ) {
    return { allowed: false, target: 'type' };
  }

  return {
    allowed: false,
    target: ts.SyntaxKind[node.kind] ?? 'unknown',
  };
}

function getLeafTokens(sourceFile) {
  const tokens = [];

  function visit(node) {
    if (
      node.kind >= ts.SyntaxKind.FirstJSDocNode &&
      node.kind <= ts.SyntaxKind.LastJSDocNode
    ) {
      return;
    }
    if (
      node.kind >= ts.SyntaxKind.FirstToken &&
      node.kind <= ts.SyntaxKind.LastToken
    ) {
      tokens.push(node);
      return;
    }
    for (const child of node.getChildren(sourceFile)) {
      visit(child);
    }
  }

  visit(sourceFile);
  return tokens.toSorted(
    (left, right) => left.getStart(sourceFile) - right.getStart(sourceFile),
  );
}

function scanTriviaGap(content, start, end) {
  if (start >= end) {
    return [];
  }

  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    content.slice(start, end),
  );
  const comments = [];

  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (token !== ts.SyntaxKind.MultiLineCommentTrivia) {
      continue;
    }

    const commentStart = start + scanner.getTokenPos();
    const commentEnd = start + scanner.getTextPos();
    const text = content.slice(commentStart, commentEnd);
    if (!text.startsWith(JSDOC_PREFIX)) {
      continue;
    }

    comments.push({ end: commentEnd, start: commentStart, text });
  }

  return comments;
}

function collectRawJsdocComments(sourceFile) {
  const comments = [];
  let cursor = 0;

  for (const token of getLeafTokens(sourceFile)) {
    const tokenStart = token.getStart(sourceFile);
    comments.push(...scanTriviaGap(sourceFile.text, cursor, tokenStart));
    cursor = Math.max(cursor, token.end);
  }
  comments.push(
    ...scanTriviaGap(sourceFile.text, cursor, sourceFile.text.length),
  );

  return comments;
}

function collectJsdocOwners(sourceFile) {
  const owners = new Map();

  function visit(node) {
    for (const jsdoc of node.jsDoc ?? []) {
      owners.set(`${jsdoc.getStart(sourceFile)}:${jsdoc.end}`, node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return owners;
}

function inspectScriptBlock(filePath, block, fullSource, lineStarts) {
  const scriptKind = getScriptKind(filePath, block.language);
  const virtualFilePath = block.label
    ? `${filePath}${block.label.replaceAll(/[<> ]/gu, '-')}`
    : filePath;
  const sourceFile = ts.createSourceFile(
    virtualFilePath,
    block.content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const owners = collectJsdocOwners(sourceFile);
  const rawComments = collectRawJsdocComments(sourceFile);

  return rawComments.map((rawComment) => {
    const owner = owners.get(`${rawComment.start}:${rawComment.end}`);
    const classification = classifyTarget(owner, sourceFile);
    const start = block.offset + rawComment.start;
    const end = block.offset + rawComment.end;
    const location = getLineAndColumn(lineStarts, start);
    let rule = null;
    let message = null;

    if (classification.allowed) {
      const invalidDescription = findNonChineseDescription(rawComment.text);
      if (invalidDescription !== null) {
        rule = 'non-chinese-description';
        message = `JSDoc ${invalidDescription.context}的自然语言描述必须使用中文`;
        location.line += invalidDescription.lineOffset;
        if (invalidDescription.lineOffset > 0) {
          location.column = 1;
        }
      }
    } else {
      rule = 'invalid-target';
      message = `JSDoc 不允许用于 ${classification.target}`;
    }

    return {
      block: block.label,
      column: location.column,
      end,
      filePath,
      line: location.line,
      message,
      ownerKind: owner ? ts.SyntaxKind[owner.kind] : null,
      rule,
      start,
      target: classification.target,
      text: fullSource.slice(start, end),
    };
  });
}

export function inspectFileSource(filePath, source) {
  const normalizedFilePath = filePath.replaceAll(path.sep, '/');
  const lineStarts = getLineStarts(source);
  const blocks = getScriptBlocks(normalizedFilePath, source);
  const comments = blocks.flatMap((block) =>
    inspectScriptBlock(normalizedFilePath, block, source, lineStarts),
  );

  return {
    comments,
    isVue: normalizedFilePath.endsWith('.vue'),
    scriptBlockCount: blocks.length,
    violations: comments.filter((comment) => comment.rule !== null),
  };
}

function collectSyntaxTokens(source, scriptKind, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const tokens = [];

  function visit(node) {
    if (
      node.kind === ts.SyntaxKind.JSDocComment ||
      (node.kind >= ts.SyntaxKind.FirstJSDocNode &&
        node.kind <= ts.SyntaxKind.LastJSDocNode)
    ) {
      return;
    }

    const children = node.getChildren(sourceFile);
    if (children.length > 0) {
      for (const child of children) {
        visit(child);
      }
      return;
    }

    if (node.kind === ts.SyntaxKind.EndOfFileToken) {
      return;
    }
    const text = node.getText(sourceFile);
    if (text.length > 0) {
      tokens.push({
        end: node.end,
        kind: node.kind,
        start: node.getStart(sourceFile),
        text,
      });
    }
  }

  visit(sourceFile);
  const sortedTokens = tokens.toSorted(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  return sortedTokens.map((token, index) => {
    const previousToken = sortedTokens[index - 1];
    const hasLineTerminatorBefore =
      previousToken === undefined
        ? false
        : /[\r\n]/u.test(source.slice(previousToken.end, token.start));
    return [token.kind, token.text, hasLineTerminatorBefore];
  });
}

export function getCodeTokenSignature(filePath, source) {
  const normalizedFilePath = filePath.replaceAll(path.sep, '/');
  const blocks = getScriptBlocks(normalizedFilePath, source);
  const tokenGroups = blocks.map((block) => ({
    block: block.label,
    language: block.language ?? null,
    tokens: collectSyntaxTokens(
      block.content,
      getScriptKind(normalizedFilePath, block.language),
      normalizedFilePath,
    ),
  }));

  return JSON.stringify(tokenGroups);
}

function getRemovalEdit(source, start, end) {
  const lineStart = source.lastIndexOf('\n', start - 1) + 1;
  const nextLineBreak = source.indexOf('\n', end);
  const lineEnd = nextLineBreak === -1 ? source.length : nextLineBreak;
  const prefix = source.slice(lineStart, start);
  const suffix = source.slice(end, lineEnd);

  if (prefix.trim() === '' && suffix.trim() === '') {
    return {
      end: nextLineBreak === -1 ? source.length : nextLineBreak + 1,
      replacement: '',
      start: lineStart,
    };
  }

  if (suffix.trim() === '') {
    let expandedStart = start;
    while (
      expandedStart > lineStart &&
      (source[expandedStart - 1] === ' ' || source[expandedStart - 1] === '\t')
    ) {
      expandedStart -= 1;
    }
    return { end: lineEnd, replacement: '', start: expandedStart };
  }

  if (prefix.trim() === '') {
    let expandedEnd = end;
    while (
      expandedEnd < lineEnd &&
      (source[expandedEnd] === ' ' || source[expandedEnd] === '\t')
    ) {
      expandedEnd += 1;
    }
    return { end: expandedEnd, replacement: '', start: lineStart };
  }

  const newlines = source.slice(start, end).match(/\r\n|\r|\n/gu);
  return {
    end,
    replacement: newlines ? newlines.join('') : ' ',
    start,
  };
}

function applyEdits(source, edits) {
  const sortedEdits = edits.toSorted(
    (left, right) => right.start - left.start || right.end - left.end,
  );
  let result = source;
  let previousStart = source.length + 1;

  for (const edit of sortedEdits) {
    if (edit.end > previousStart) {
      throw new Error('JSDoc 清理范围发生重叠');
    }
    result =
      result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
    previousStart = edit.start;
  }

  return result;
}

export function applyJsdocPolicyFix(filePath, source) {
  const inspection = inspectFileSource(filePath, source);
  const uniqueViolations = [
    ...new Map(
      inspection.violations.map((violation) => [
        `${violation.start}:${violation.end}`,
        violation,
      ]),
    ).values(),
  ];
  const edits = uniqueViolations.map((violation) =>
    getRemovalEdit(source, violation.start, violation.end),
  );
  const beforeTokens = getCodeTokenSignature(filePath, source);
  const fixedSource = applyEdits(source, edits);
  const afterTokens = getCodeTokenSignature(filePath, fixedSource);

  if (beforeTokens !== afterTokens) {
    throw new Error(`${filePath}: 清理前后非注释 token 不一致`);
  }

  return {
    removedCount: uniqueViolations.length,
    source: fixedSource,
  };
}

export function getTrackedCodeFiles(rootDirectory = process.cwd()) {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: rootDirectory,
      encoding: 'utf8',
      env: getIsolatedGitEnvironment(),
    },
  );

  return output
    .split('\0')
    .filter(Boolean)
    .filter((filePath) => CODE_FILE_PATTERN.test(filePath))
    .filter((filePath) => existsSync(path.join(rootDirectory, filePath)))
    .toSorted();
}

export function getStagedCodeFiles(rootDirectory = process.cwd()) {
  const output = execFileSync('git', ['ls-files', '--cached', '-z'], {
    cwd: rootDirectory,
    encoding: 'utf8',
    env: getStagedGitEnvironment(rootDirectory),
  });

  return output
    .split('\0')
    .filter(Boolean)
    .map((filePath) => filePath.replaceAll('\\', '/'))
    .filter((filePath) => CODE_FILE_PATTERN.test(filePath))
    .toSorted();
}

function summarizeInspections(inspections) {
  const summary = {
    'invalid-target': 0,
    'non-chinese-description': 0,
    fileCount: 0,
    jsdocCount: 0,
    scriptBlockCount: 0,
    violationCount: 0,
    vueFileCount: 0,
  };

  for (const inspection of inspections) {
    summary.fileCount += 1;
    summary.jsdocCount += inspection.result.comments.length;
    summary.scriptBlockCount += inspection.result.scriptBlockCount;
    summary.violationCount += inspection.result.violations.length;
    if (inspection.result.isVue) {
      summary.vueFileCount += 1;
    }
    for (const violation of inspection.result.violations) {
      summary[violation.rule] += 1;
    }
  }

  return summary;
}

function inspectTrackedFiles(rootDirectory) {
  return getTrackedCodeFiles(rootDirectory).map((filePath) => {
    const absolutePath = path.join(rootDirectory, filePath);
    const source = readFileSync(absolutePath, 'utf8');
    return {
      absolutePath,
      filePath,
      result: inspectFileSource(filePath, source),
      source,
    };
  });
}

function inspectStagedFiles(rootDirectory) {
  const environment = getStagedGitEnvironment(rootDirectory);
  return getStagedCodeFiles(rootDirectory).map((filePath) => {
    const source = execFileSync('git', ['show', `:${filePath}`], {
      cwd: rootDirectory,
      encoding: 'utf8',
      env: environment,
      maxBuffer: 64 * 1024 * 1024,
    });
    return {
      absolutePath: null,
      filePath,
      result: inspectFileSource(filePath, source),
      source,
    };
  });
}

function formatViolation(violation) {
  const blockSuffix = violation.block ? ` ${violation.block}` : '';
  return `${violation.filePath}:${violation.line}:${violation.column} [${violation.rule}]${blockSuffix} ${violation.message}`;
}

function printSummary(summary, prefix = 'JSDoc 检查') {
  process.stdout.write(
    `${prefix}：${summary.fileCount} 个受控代码文件，` +
      `${summary.vueFileCount} 个 Vue 文件，` +
      `${summary.scriptBlockCount} 个脚本区块，` +
      `${summary.jsdocCount} 个 JSDoc，` +
      `${summary.violationCount} 个违规` +
      `（非法位置 ${summary['invalid-target']}，纯英文 ${summary['non-chinese-description']}）\n`,
  );
}

function runCli() {
  const args = new Set(process.argv.slice(2));
  const fix = args.delete('--fix');
  const staged = args.delete('--staged');
  if (args.size > 0) {
    console.error(`未知参数：${[...args].join(', ')}`);
    process.exitCode = 2;
    return;
  }
  if (fix && staged) {
    console.error('暂存区检查不支持 --fix');
    process.exitCode = 2;
    return;
  }

  const rootDirectory = process.cwd();
  const inspections = staged
    ? inspectStagedFiles(rootDirectory)
    : inspectTrackedFiles(rootDirectory);
  const initialSummary = summarizeInspections(inspections);

  if (!fix) {
    for (const inspection of inspections) {
      for (const violation of inspection.result.violations) {
        console.error(formatViolation(violation));
      }
    }
    printSummary(initialSummary, staged ? 'JSDoc 暂存区检查' : 'JSDoc 检查');
    if (initialSummary.violationCount > 0) {
      process.exitCode = 1;
    }
    return;
  }

  let changedFileCount = 0;
  let removedCount = 0;
  for (const inspection of inspections) {
    if (inspection.result.violations.length === 0) {
      continue;
    }
    const fixed = applyJsdocPolicyFix(inspection.filePath, inspection.source);
    writeFileSync(inspection.absolutePath, fixed.source);
    changedFileCount += 1;
    removedCount += fixed.removedCount;
  }

  const finalInspections = inspectTrackedFiles(rootDirectory);
  const finalSummary = summarizeInspections(finalInspections);
  process.stdout.write(
    `JSDoc 清理：修改 ${changedFileCount} 个文件，删除 ${removedCount} 个违规块\n`,
  );
  printSummary(finalSummary, '清理后检查');
  if (finalSummary.violationCount > 0) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
