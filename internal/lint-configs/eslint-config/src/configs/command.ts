import createCommand from 'eslint-plugin-command/config';

/**
 * 通过 ESLint 配置限制 package scripts 的命令格式。
 *
 * @returns 限制 package scripts 命令写法的 ESLint 扁平配置数组。
 */
export async function command() {
  return [
    {
      ...createCommand(),
    },
  ];
}
