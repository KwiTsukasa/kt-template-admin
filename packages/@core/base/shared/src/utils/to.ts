/**
 * 把 Promise 结果转换为错误优先元组，调用失败时无需额外 try/catch。
 *
 * @param promise - 需要转换为错误优先元组的 Promise。
 * @param errorExt - 附加到基础错误信息后的扩展说明。
 * @returns 成功时为 `[undefined, data]`，失败时为 `[error, undefined]` 的错误优先元组。
 */
export async function to<T, U = Error>(
  promise: Readonly<Promise<T>>,
  errorExt?: object,
): Promise<[null, T] | [U, undefined]> {
  try {
    const data = await promise;
    const result: [null, T] = [null, data];
    return result;
  } catch (error) {
    if (errorExt) {
      const parsedError = Object.assign({}, error, errorExt);
      return [parsedError as U, undefined];
    }
    return [error as U, undefined];
  }
}
