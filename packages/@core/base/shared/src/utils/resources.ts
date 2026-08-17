/**
 * 向 document.head 插入脚本并等待加载完成；已有同地址脚本时直接复用。
 *
 * @param src - 需要动态插入页面的脚本地址。
 * @returns 脚本加载成功时兑现、加载失败时拒绝的 Promise；已有同源脚本时立即兑现。
 */
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      // 如果已经加载过，直接 resolve
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () =>
      reject(new Error(`Failed to load script: ${src}`)),
    );
    document.head.append(script);
  });
}

export { loadScript };
