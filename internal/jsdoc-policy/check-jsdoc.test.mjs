import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { it } from 'vitest';

import {
  applyJsdocPolicyFix,
  getCodeTokenSignature,
  getTrackedCodeFiles,
  inspectFileSource,
} from './check-jsdoc.mjs';

function runFixtureGit(repository, args) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  execFileSync('git', args, { cwd: repository, env: environment });
}

it('allows Chinese JSDoc only on explicitly named callable declarations', () => {
  const source = `
/** 读取当前配置。 */
function readConfig() {}

const loadConfig = /** 加载远端配置。 */ function loadRemoteConfig() {};

const service = {
  /** 执行任务。 */
  run() {},

  /** 返回当前状态。 */
  get status() {
    return 'ready';
  },
};
`;

  const result = inspectFileSource('valid.ts', source);

  assert.equal(result.comments.length, 4);
  assert.deepEqual(result.violations, []);
});

it('rejects pure-English JSDoc on an otherwise valid named function', () => {
  const result = inspectFileSource(
    'english.ts',
    '/** Loads the current configuration. */\nfunction loadConfig() {}\n',
  );

  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0]?.rule, 'non-chinese-description');
  assert.equal(result.violations[0]?.target, 'named-function-declaration');
});

it('rejects declarations and callables excluded by the policy', () => {
  const source = `
/** 接口说明。 */
interface Options {
  /** 属性说明。 */
  value: string;
}

/** 类型说明。 */
type Result = string;

/** 变量说明。 */
const count = 1;

const arrow = /** 箭头函数说明。 */ () => count;
items.map(/** 匿名回调说明。 */ function () {});

class Service {
  /** 构造服务。 */
  constructor() {}

  /** 初始化组件。 */
  setup() {}

  /** 组件挂载入口。 */
  mounted() {}
}

/** 即使初始化器具名，注释仍属于变量。 */
const load = function loadConfig() {};
`;

  const result = inspectFileSource('invalid-targets.ts', source);

  assert.deepEqual(
    result.violations.map(({ rule, target }) => [rule, target]),
    [
      ['invalid-target', 'interface'],
      ['invalid-target', 'property'],
      ['invalid-target', 'type'],
      ['invalid-target', 'variable'],
      ['invalid-target', 'arrow-function'],
      ['invalid-target', 'anonymous-function-expression'],
      ['invalid-target', 'constructor'],
      ['invalid-target', 'setup'],
      ['invalid-target', 'lifecycle-entry'],
      ['invalid-target', 'variable'],
    ],
  );
});

it('rejects raw JSDoc blocks that TypeScript does not attach to a node', () => {
  const source = `
consume(/** 表达式内孤立注释。 */ 1);
const stringValue = '/** 字符串内容。 */';
const templateValue = \`/** 模板字符串内容。 */\`;
; /** 文件尾孤立注释。 */
`;

  const result = inspectFileSource('unattached.ts', source);

  assert.equal(result.comments.length, 2);
  assert.deepEqual(
    result.violations.map(({ rule, target }) => [rule, target]),
    [
      ['invalid-target', 'unattached'],
      ['invalid-target', 'unattached'],
    ],
  );
});

it('does not treat string, template, or TSX text content as raw JSDoc', () => {
  const source = `
const stringValue = '/** 字符串内容。 */';
const templateValue = \`/** 模板字符串内容。 */\`;
const view = <div>/** TSX 文本内容。 */</div>;
consume(/** 只有这一块是真实孤立注释。 */ 1);
`;

  const result = inspectFileSource('literal-content.tsx', source);

  assert.equal(result.comments.length, 1);
  assert.equal(result.violations[0]?.target, 'unattached');
});

it('checks Vue script and script-setup blocks without scanning template or style', () => {
  const source = `
<template>
  <div>/** 模板文本不属于 JSDoc。 */</div>
</template>

<script setup lang="ts">
/** setup 变量非法。 */
const count = 1;

/** 返回当前数量。 */
function readCount() {
  return count;
}
</script>

<script lang="tsx">
defineComponent({
  /** TSX 组件 setup 禁止使用 JSDoc。 */
  setup() {
    return () => <span />;
  },

  /** 渲染当前组件。 */
  render() {
    return <span />;
  },
});

/** Loads remote data. */
function loadRemote() {}
</script>

<style>
/** 样式注释不属于脚本 JSDoc。 */
.root {}
</style>
`;

  const result = inspectFileSource('Component.vue', source);

  assert.equal(result.comments.length, 5);
  assert.deepEqual(
    result.violations.map(({ rule, target }) => [rule, target]),
    [
      ['invalid-target', 'variable'],
      ['invalid-target', 'setup'],
      ['non-chinese-description', 'named-function-declaration'],
    ],
  );
});

it('fix mode removes only violations and preserves non-comment tokens', () => {
  const source = `
/** 保留有意义的中文说明。 */
function keepComment() {}

/** Remove this historical English description. */
function removeEnglishComment() {}

/** 删除变量位置的注释。 */
const value = 1;

const named = /** 保留具名函数表达式说明。 */ function namedExpression() {
  return value;
};
`;
  const beforeTokens = getCodeTokenSignature('cleanup.ts', source);

  const fixed = applyJsdocPolicyFix('cleanup.ts', source);

  assert.match(fixed.source, /保留有意义的中文说明/);
  assert.match(fixed.source, /保留具名函数表达式说明/);
  assert.doesNotMatch(fixed.source, /historical English/);
  assert.doesNotMatch(fixed.source, /删除变量位置的注释/);
  assert.equal(fixed.removedCount, 2);
  assert.deepEqual(
    inspectFileSource('cleanup.ts', fixed.source).violations,
    [],
  );
  assert.equal(getCodeTokenSignature('cleanup.ts', fixed.source), beforeTokens);
});

it('tracked-file discovery also includes untracked non-ignored code', () => {
  const repository = mkdtempSync(path.join(tmpdir(), 'admin-jsdoc-policy-'));

  try {
    runFixtureGit(repository, ['init', '--quiet']);
    writeFileSync(path.join(repository, '.gitignore'), 'ignored.ts\n');
    writeFileSync(path.join(repository, 'deleted.ts'), 'export {};\n');
    writeFileSync(path.join(repository, 'tracked.ts'), 'export {};\n');
    writeFileSync(path.join(repository, 'untracked.tsx'), 'export {};\n');
    writeFileSync(path.join(repository, 'ignored.ts'), 'export {};\n');
    writeFileSync(path.join(repository, 'notes.md'), '# Notes\n');
    runFixtureGit(repository, [
      'add',
      '.gitignore',
      'deleted.ts',
      'tracked.ts',
    ]);
    rmSync(path.join(repository, 'deleted.ts'));

    assert.deepEqual(getTrackedCodeFiles(repository), [
      'tracked.ts',
      'untracked.tsx',
    ]);
  } finally {
    rmSync(repository, { force: true, recursive: true });
  }
});
