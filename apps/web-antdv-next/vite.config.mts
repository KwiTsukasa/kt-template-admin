import { defineConfig } from '@vben/vite-config';

const config = defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // 后端真实接口代理目标地址
            target: 'http://localhost:48085',
            ws: true,
          },
        },
      },
    },
  };
}) as unknown;

export default config;
