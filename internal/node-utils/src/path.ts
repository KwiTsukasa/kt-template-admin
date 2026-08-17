import { posix } from 'node:path';

/**
 * 将给定的文件路径转换为 POSIX 风格。
 *
 * @param pathname - 需要把 Windows 分隔符转换为斜杠的文件路径。
 * @returns 把反斜杠替换为正斜杠后的路径。
 */
function toPosixPath(pathname: string) {
  return pathname.split(`\\`).join(posix.sep);
}

export { toPosixPath };
