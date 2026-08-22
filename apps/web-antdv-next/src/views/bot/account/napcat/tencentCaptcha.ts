import type { BotNapcatApi } from '#/api/bot/napcat';

type TencentCaptchaResult = {
  appid?: string;
  errorCode?: number;
  errorMessage?: string;
  randstr?: string;
  ret: number;
  ticket?: string;
};

type TencentCaptchaInstance = {
  destroy: () => void;
  show: () => void;
};

declare global {
  interface Window {
    TencentCaptcha?: new (
      appid: string,
      callback: (res: TencentCaptchaResult) => void,
      options?: Record<string, unknown>,
    ) => TencentCaptchaInstance;
  }
}

let tencentCaptchaScriptPromise: Promise<void> | undefined;

/**
 * 加载腾讯验证码并打开验证窗口，成功时返回服务端要求的票据参数。
 *
 * @param proofWaterUrl - NapCat 返回的验证码地址，其中 query 可提供 appid、sid、uin 等腾讯验证参数。
 * @returns 验证码通过时返回票据、随机串等证明参数；用户关闭时返回 undefined。
 */
export function requestTencentCaptcha(
  proofWaterUrl: string,
): Promise<Omit<BotNapcatApi.AccountScanCaptchaBody, 'sessionId'>> {
  const params = parseUrlParams(proofWaterUrl);
  const appid = params.aid || '2081081773';
  const sid = params.sid || '';

  return loadTencentCaptchaScript().then(
    () =>
      new Promise((resolve, reject) => {
        if (!window.TencentCaptcha) {
          reject(new Error('腾讯验证码组件加载失败'));
          return;
        }

        let captcha: TencentCaptchaInstance | undefined;
        let settled = false;
        const finish = (
          error?: Error,
          value?: Omit<BotNapcatApi.AccountScanCaptchaBody, 'sessionId'>,
        ) => {
          if (settled) return;
          settled = true;
          try {
            captcha?.destroy();
          } catch {
            // The captcha SDK may already have cleaned up its popup.
          }
          if (error) {
            reject(error);
            return;
          }
          if (!value) {
            reject(new Error('腾讯验证码未返回验证结果'));
            return;
          }
          resolve(value);
        };

        captcha = new window.TencentCaptcha(
          appid,
          (res) => {
            if (res.ret === 0 && res.ticket && res.randstr) {
              finish(undefined, {
                randstr: res.randstr,
                sid,
                ticket: res.ticket,
              });
              return;
            }
            finish(new Error('已取消安全验证'));
          },
          {
            enableAged: true,
            login_appid: params.login_appid,
            showHeader: false,
            sid: params.sid,
            type: 'popup',
            uin: params.uin,
          },
        );
        captcha.show();
      }),
  );
}

/**
 * 复用进行中的加载任务初始化腾讯验证码脚本，失败后允许下一次重新加载。
 *
 * @throws 两个腾讯验证码脚本源均加载失败时重新抛出加载异常。
 */
async function loadTencentCaptchaScript() {
  if (window.TencentCaptcha) return;
  tencentCaptchaScriptPromise =
    tencentCaptchaScriptPromise ||
    loadScriptWithFallback([
      'https://captcha.gtimg.com/TCaptcha.js',
      'https://ssl.captcha.qq.com/TCaptcha.js',
    ]);
  try {
    await tencentCaptchaScriptPromise;
  } catch (error) {
    tencentCaptchaScriptPromise = undefined;
    throw error;
  }
}

/**
 * 按顺序尝试验证码脚本源，前一地址失败后自动切换到下一地址。
 *
 * @param sources - 按优先级排列的候选脚本地址列表。
 * @throws 所有候选脚本地址都加载失败时抛出最后一次错误。
 */
async function loadScriptWithFallback(sources: string[]) {
  let lastError: unknown;
  for (const source of sources) {
    try {
      await loadScript(source);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('腾讯验证码脚本加载失败');
}

/**
 * 复用页面上已有的同源脚本或新建异步脚本元素，并用 Promise 反馈加载成功或失败。
 *
 * @param source - 要注入 document.head 的腾讯验证码脚本绝对地址。
 * @returns 脚本加载成功时兑现、加载失败时拒绝的 Promise。
 */
function loadScript(source: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${source}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error(`腾讯验证码脚本加载失败：${source}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = source;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error(`腾讯验证码脚本加载失败：${source}`)),
      { once: true },
    );
    document.head.append(script);
  });
}

/**
 * 根据地址格式使用 URL API 解析查询参数；非标准地址回退到手工拆分 query。
 *
 * @param url - 待提取 query 参数的验证码地址；非标准 URL 时退回手工解析问号后的内容。
 * @returns 解析并校验后的根据地址格式使用 URL API 解析查询参数；非标准地址回退到手工拆分 query。
 */
function parseUrlParams(url: string) {
  const params: Record<string, string> = {};
  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    const query = url.split('?')[1] || '';
    query.split('&').forEach((pair) => {
      const [key, value = ''] = pair.split('=');
      if (key) params[key] = decodeURIComponent(value);
    });
    return params;
  }
}
