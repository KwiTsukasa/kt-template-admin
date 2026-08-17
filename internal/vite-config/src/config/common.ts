import type { UserConfig } from 'vite';

/**
 * 提供关闭 sourcemap、压缩体积报告并放宽分包警告阈值的通用 Vite 构建配置。
 *
 * @returns 管理端应用与库构建共用的 Vite build 配置。
 */
async function getCommonConfig(): Promise<UserConfig> {
  return {
    build: {
      chunkSizeWarningLimit: 2000,
      reportCompressedSize: false,
      sourcemap: false,
    },
  };
}

export { getCommonConfig };
