import { defineConfig } from '@vben/vite-config';

const config = defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/admin/napcat-webui': {
            changeOrigin: true,
            rewrite: (path) =>
              path.replace(/^\/admin\/napcat-webui/, '/napcat-webui'),
            target: 'http://localhost:48086',
            ws: true,
          },
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // 后端真实接口代理目标地址
            target: 'http://localhost:48085',
            ws: true,
          },
          '/napcat-webui': {
            changeOrigin: true,
            target: 'http://localhost:48086',
            ws: true,
          },
        },
      },
    },
  };
}) as unknown;

export default config;
