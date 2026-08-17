import type { Linter } from 'eslint';

/**
 * 将依赖、构建产物、缓存、快照、锁文件和生成声明排除在 ESLint 检查外。
 *
 * @returns 包含构建产物、缓存和生成文件模式的 ESLint 忽略配置数组。
 */
export async function ignores(): Promise<Linter.Config[]> {
  return [
    {
      ignores: [
        '**/node_modules',
        '**/dist',
        '**/dist-*',
        '**/*-dist',
        '**/.husky',
        '**/.nitro',
        '**/.output',
        '**/Dockerfile',
        '**/package-lock.json',
        '**/yarn.lock',
        '**/pnpm-lock.yaml',
        '**/bun.lockb',
        '**/output',
        '**/coverage',
        '**/temp',
        '**/.temp',
        '**/tmp',
        '**/.tmp',
        '**/.history',
        '**/.turbo',
        '**/.nuxt',
        '**/.next',
        '**/.vercel',
        '**/.idea',
        '**/.cache',
        '**/.output',
        '**/.vite-inspect',

        '**/CHANGELOG*.md',
        '**/*.min.*',
        '**/LICENSE*',
        '**/__snapshots__',
        '**/*.snap',
        '**/fixtures/**',
        '**/.vitepress/cache/**',
        '**/auto-import?(s).d.ts',
        '**/components.d.ts',
        '**/vite.config.mts.*',
        '**/*.sh',
        '**/*.ttf',
        '**/*.woff',
        '**/.github',
      ],
    },
  ];
}
