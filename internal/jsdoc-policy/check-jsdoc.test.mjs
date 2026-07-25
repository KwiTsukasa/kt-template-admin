import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { it } from 'vitest';

import {
  applyJsdocPolicyFix,
  getCodeTokenSignature,
  getTrackedCodeFiles,
  inspectFileSource,
} from './check-jsdoc.mjs';

const CHECKER_PATH = fileURLToPath(new URL('check-jsdoc.mjs', import.meta.url));

function runFixtureGit(repository, args, extraEnvironment = {}) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  execFileSync('git', args, {
    cwd: repository,
    env: { ...environment, ...extraEnvironment },
  });
}

function runStagedChecker(repository, extraEnvironment = {}) {
  return spawnSync(process.execPath, [CHECKER_PATH, '--staged'], {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnvironment },
  });
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

it('rejects English prose hidden by Chinese text while allowing technical terms', () => {
  const source = `
/** 通过 HTTP 连接 MySQL，并按 userId 返回 DTO。 */
function loadValidData() {}

/** 用于获取loading的html模板。 */
function getLoadingTemplate() {}

/**
 * 按用户标识查询。
 * @param {string} userId - 用户 ID。
 * @returns {Promise<Result>} 查询结果。
 * @example
 * const 中文变量 = await loadValidData();
 */
function loadTaggedData() {}

/**
 * 读取二进制内容。
 * @returns RequestResponse<Blob>
 */
function readBlobResponse() {}

/** 中文引子。 Determine whether there is permission from the user role. */
function checkAccess() {}

/**
 * 格式化计数。
 * @param {string} value - The counter value.
 * @param fields record
 * @returns Counter text such as \`7890\` or \`12.3万\`.
 */
function formatCounter() {}

/**
 * Parse the payload.
 * @example
 * const 中文变量 = parsePayload();
 */
function parsePayload() {}

/**
 * 返回载荷。
 * @returns payload
 */
function readPayload() {}
`;

  const result = inspectFileSource('mixed-language.ts', source);

  assert.equal(result.comments.length, 8);
  assert.deepEqual(
    result.violations.map(({ rule, target }) => [rule, target]),
    [
      ['non-chinese-description', 'named-function-declaration'],
      ['non-chinese-description', 'named-function-declaration'],
      ['non-chinese-description', 'named-function-declaration'],
      ['non-chinese-description', 'named-function-declaration'],
    ],
  );
  assert.deepEqual(
    result.violations.map(({ message }) => message),
    [
      'JSDoc 主说明的自然语言描述必须使用中文',
      'JSDoc @param的自然语言描述必须使用中文',
      'JSDoc 主说明的自然语言描述必须使用中文',
      'JSDoc @returns的自然语言描述必须使用中文',
    ],
  );
  assert.equal(
    result.violations[1]?.line,
    source.slice(0, source.indexOf('@param {string} value')).split('\n').length,
  );
});

it('treats inline code as neutral and validates custom tag descriptions', () => {
  const validSource = `
/**
 * 使用 {@code access token} 完成认证。
 * @custom 中文扩展说明。
 * @public
 */
function authenticate() {}
`;
  const invalidSource = `
/**
 * 执行扩展检查。
 * @custom Determine whether the extension is enabled.
 */
function checkExtension() {}
`;
  const codeMaskedSource = `
/**
 * 执行载荷检查。
 * @custom payload {@code 中文变量}
 */
function checkPayload() {}
`;

  assert.deepEqual(
    inspectFileSource('inline-code.ts', validSource).violations,
    [],
  );
  const invalidResult = inspectFileSource('custom-tag.ts', invalidSource);
  assert.equal(invalidResult.violations.length, 1);
  assert.equal(
    invalidResult.violations[0]?.message,
    'JSDoc @custom的自然语言描述必须使用中文',
  );
  assert.equal(
    inspectFileSource('custom-code.ts', codeMaskedSource).violations.length,
    1,
  );
});

it('validates prose after structural tag payloads', () => {
  const validSource = `
/**
 * 创建选项类型。
 * @typedef {object} Options - 选项说明。
 * @extends {Base} - 基类说明。
 */
function createOptions() {}
`;
  const invalidSource = `
/**
 * 创建选项类型。
 * @typedef {object} Options - This is English prose.
 */
function createOptions() {}
`;

  assert.deepEqual(
    inspectFileSource('structural-valid.ts', validSource).violations,
    [],
  );
  const invalidResult = inspectFileSource(
    'structural-invalid.ts',
    invalidSource,
  );
  assert.equal(invalidResult.violations.length, 1);
  assert.equal(
    invalidResult.violations[0]?.message,
    'JSDoc @typedef的自然语言描述必须使用中文',
  );
});

it('does not parse fenced code or example decorators as JSDoc tags', () => {
  const source = `
/**
 * 展示装饰器示例。
 * \`\`\`ts
 * @returns payload
 * \`\`\`
 * @example
 * @Component
 * class Demo {}
 */
function showDecoratorExample() {}
`;

  assert.deepEqual(inspectFileSource('example.ts', source).violations, []);
});

it('does not share a Chinese anchor across main-description paragraphs', () => {
  const invalidSource = `
/**
 * 中文说明。
 *
 * Cache expires tomorrow.
 */
function readCache() {}
`;
  const validSource = `
/**
 * 解析载荷。
 * HTTP payload
 * 并返回结果。
 */
function readPayload() {}
`;

  assert.equal(
    inspectFileSource('paragraph-invalid.ts', invalidSource).violations.length,
    1,
  );
  assert.deepEqual(
    inspectFileSource('paragraph-valid.ts', validSource).violations,
    [],
  );
});

it('rejects setup and lifecycle property function expressions by property role', () => {
  const source = `
const component = {
  mounted: /** 组件挂载入口。 */ function mountedHook() {},
  setup: /** 组件初始化入口。 */ function namedSetup() {},
  ['mounted']: /** 计算属性挂载入口。 */ function computedMountedHook() {},
  ['setup']: /** 计算属性初始化入口。 */ function computedSetup() {},
  updated: (/** 括号包裹的更新入口。 */ function updatedHook() {}),
  task: /** 执行普通任务。 */ function namedTask() {},
  ['computedTask']: /** 执行普通计算属性任务。 */ function computedTask() {},
};

/** 读取普通同名函数。 */
function mounted() {}
`;

  const result = inspectFileSource('lifecycle-expression.ts', source);

  assert.deepEqual(
    result.violations.map(({ rule, target }) => [rule, target]),
    [
      ['invalid-target', 'lifecycle-entry'],
      ['invalid-target', 'setup'],
      ['invalid-target', 'lifecycle-entry'],
      ['invalid-target', 'setup'],
      ['invalid-target', 'lifecycle-entry'],
    ],
  );
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

it('preserves and compares line terminators around restricted productions', () => {
  const source = `function readValue() {
  return /** Remove this English description.
   * It spans multiple lines.
   */ 1;
}`;
  const unsafeSource = source.replace(
    '/** Remove this English description.\n   * It spans multiple lines.\n   */ ',
    '',
  );

  assert.notEqual(
    getCodeTokenSignature('restricted.ts', unsafeSource),
    getCodeTokenSignature('restricted.ts', source),
  );

  const fixed = applyJsdocPolicyFix('restricted.ts', source);

  assert.equal(
    getCodeTokenSignature('restricted.ts', fixed.source),
    getCodeTokenSignature('restricted.ts', source),
  );
  assert.equal(runInNewContext(`${source}; readValue();`), undefined);
  assert.equal(runInNewContext(`${fixed.source}; readValue();`), undefined);
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

it('staged mode checks the actual index including a valid temporary index', () => {
  const repository = mkdtempSync(path.join(tmpdir(), 'admin-jsdoc-staged-'));
  const validSource = '/** 读取配置。 */\nfunction readConfig() {}\n';
  const invalidSource =
    '/** Read the current configuration. */\nfunction readConfig() {}\n';

  try {
    runFixtureGit(repository, ['init', '--quiet']);
    runFixtureGit(repository, ['config', 'user.email', 'fixture@example.com']);
    runFixtureGit(repository, ['config', 'user.name', 'Fixture']);
    writeFileSync(path.join(repository, 'tracked.ts'), validSource);
    writeFileSync(path.join(repository, 'deleted.ts'), validSource);
    runFixtureGit(repository, ['add', 'tracked.ts', 'deleted.ts']);
    runFixtureGit(repository, ['commit', '--quiet', '-m', 'baseline']);

    writeFileSync(path.join(repository, 'tracked.ts'), invalidSource);
    runFixtureGit(repository, ['add', 'tracked.ts']);
    writeFileSync(path.join(repository, 'tracked.ts'), validSource);
    assert.equal(runStagedChecker(repository).status, 1);

    runFixtureGit(repository, ['add', 'tracked.ts']);
    writeFileSync(path.join(repository, 'tracked.ts'), invalidSource);
    assert.equal(runStagedChecker(repository).status, 0);

    writeFileSync(path.join(repository, 'added.ts'), invalidSource);
    runFixtureGit(repository, ['add', 'added.ts']);
    assert.equal(runStagedChecker(repository).status, 1);
    runFixtureGit(repository, ['rm', '--cached', '--quiet', 'added.ts']);
    assert.equal(runStagedChecker(repository).status, 0);

    rmSync(path.join(repository, 'deleted.ts'));
    runFixtureGit(repository, ['add', '--update', 'deleted.ts']);
    assert.equal(runStagedChecker(repository).status, 0);

    writeFileSync(path.join(repository, 'tracked.ts'), validSource);
    runFixtureGit(repository, ['add', 'tracked.ts']);
    const indexPath = path.join(repository, '.git', 'index');
    const temporaryIndexPath = path.join(
      repository,
      '.git',
      'temporary-commit-index',
    );
    copyFileSync(indexPath, temporaryIndexPath);
    writeFileSync(path.join(repository, 'tracked.ts'), invalidSource);
    runFixtureGit(repository, ['add', 'tracked.ts'], {
      GIT_INDEX_FILE: temporaryIndexPath,
    });
    writeFileSync(path.join(repository, 'tracked.ts'), validSource);
    const indexBefore = readFileSync(indexPath);
    const result = runStagedChecker(repository, {
      GIT_COMMON_DIR: path.join(repository, 'hostile-common-dir'),
      GIT_DIR: path.join(repository, 'hostile-git-dir'),
      GIT_INDEX_FILE: temporaryIndexPath,
      GIT_PREFIX: 'hostile-prefix/',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /tracked\.ts/u);
    assert.deepEqual(readFileSync(indexPath), indexBefore);
  } finally {
    rmSync(repository, { force: true, recursive: true });
  }
}, 15_000);
