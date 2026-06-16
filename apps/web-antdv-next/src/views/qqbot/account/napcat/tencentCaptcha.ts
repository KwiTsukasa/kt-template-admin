import type { QqbotNapcatApi } from '#/api/qqbot/napcat';

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

export function requestTencentCaptcha(
  proofWaterUrl: string,
): Promise<Omit<QqbotNapcatApi.AccountScanCaptchaBody, 'sessionId'>> {
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
          value?: Omit<QqbotNapcatApi.AccountScanCaptchaBody, 'sessionId'>,
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
  throw lastError instanceof Error
    ? lastError
    : new Error('腾讯验证码脚本加载失败');
}

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
