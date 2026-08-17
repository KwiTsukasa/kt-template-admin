import type { Ora } from 'ora';

import ora from 'ora';

interface SpinnerOptions {
  failedText?: string;
  successText?: string;
  title: string;
}
/**
 * 在异步任务执行期间展示终端加载状态，并按成功或失败更新提示。
 *
 * @param callback - 在加载状态期间执行的异步任务回调。
 * @returns 异步回调成功解析出的原始结果。
 * @throws 异步回调失败时更新失败提示并重新抛出原始异常。
 */
export async function spinner<T>(
  { failedText, successText, title }: SpinnerOptions,
  callback: () => Promise<T>,
): Promise<T> {
  const loading: Ora = ora(title).start();

  try {
    const result = await callback();
    loading.succeed(successText || 'Success!');
    return result;
  } catch (error) {
    loading.fail(failedText || 'Failed!');
    throw error;
  } finally {
    loading.stop();
  }
}
