import type { WordpressBlogApi } from '#/api/blog';

import { computed, defineComponent, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { Button, message, Modal, Space, Tag } from 'antdv-next';

import {
  getThemeConfig,
  importWordpressThemeConfig,
  saveThemeConfig,
} from '#/api/blog';

const AButton = Button as any;

export default defineComponent({
  name: 'BlogThemeConfig',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const config = ref<WordpressBlogApi.ThemeConfig>({});
    const jsonText = ref('');
    const loading = ref(false);
    const saving = ref(false);
    const importing = ref(false);
    const canImport = computed(() => hasAccessByCodes(['Blog:Theme:Import']));
    const canSave = computed(() => hasAccessByCodes(['Blog:Theme:Save']));
    const summaryItems = computed(() => [
      { label: '站点标题', value: config.value.site?.title || '-' },
      { label: '作者', value: config.value.site?.authorName || '-' },
      { label: '主题色', value: config.value.themeColor || '-' },
      { label: '圆角', value: config.value.themeCardRadius ?? '-' },
      { label: '版本', value: config.value.themeVersion || '-' },
      { label: '深色模式', value: config.value.darkmodeAutoSwitch || '-' },
      {
        label: '菜单',
        value: `${config.value.headerMenu?.length || 0}/${config.value.sidebarMenu?.length || 0}`,
      },
      {
        label: '背景',
        value: config.value.backgroundImage || '-',
      },
    ]);

    async function loadConfig() {
      loading.value = true;
      try {
        const nextConfig = await getThemeConfig();
        applyConfig(nextConfig);
      } finally {
        loading.value = false;
      }
    }

    function applyConfig(nextConfig: WordpressBlogApi.ThemeConfig) {
      config.value = nextConfig || {};
      jsonText.value = JSON.stringify(config.value, null, 2);
    }

    function parseJsonConfig() {
      try {
        return JSON.parse(
          jsonText.value || '{}',
        ) as WordpressBlogApi.ThemeConfig;
      } catch {
        message.warning('主题配置 JSON 格式不正确');
        return null;
      }
    }

    async function saveConfig() {
      const nextConfig = parseJsonConfig();
      if (!nextConfig) return;

      saving.value = true;
      try {
        const savedConfig = await saveThemeConfig({
          config: nextConfig,
          source: 'admin',
        });
        applyConfig(savedConfig);
        message.success('主题配置保存成功');
      } finally {
        saving.value = false;
      }
    }

    function confirmImportWordpress() {
      Modal.confirm({
        cancelText: '取消',
        content: '将读取已配置 WordPress 站点的 Argon 主题配置并保存到本地。',
        okText: '开始导入',
        title: '导入 WordPress 主题配置',
        async onOk() {
          importing.value = true;
          try {
            const importedConfig = await importWordpressThemeConfig();
            applyConfig(importedConfig);
            message.success('主题配置导入成功');
          } finally {
            importing.value = false;
          }
        },
      });
    }

    onMounted(() => {
      void loadConfig();
    });

    return () => (
      <Page autoContentHeight>
        <div class="flex h-full min-h-0 flex-col gap-4">
          <div class="rounded-md bg-background p-4 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="m-0 text-base font-medium">主题配置</h2>
                <div class="mt-2 flex flex-wrap gap-2">
                  {summaryItems.value.map((item) => (
                    <Tag key={item.label}>
                      {item.label}：{item.value}
                    </Tag>
                  ))}
                </div>
              </div>
              <Space>
                <AButton loading={loading.value} onClick={loadConfig}>
                  刷新
                </AButton>
                {canImport.value ? (
                  <AButton
                    loading={importing.value}
                    onClick={confirmImportWordpress}
                  >
                    导入 WordPress
                  </AButton>
                ) : null}
                {canSave.value ? (
                  <AButton
                    loading={saving.value}
                    onClick={saveConfig}
                    type="primary"
                  >
                    保存配置
                  </AButton>
                ) : null}
              </Space>
            </div>
          </div>

          <textarea
            class="min-h-[520px] flex-1 resize-none rounded-md border border-border bg-background p-4 font-mono text-sm leading-6 outline-none transition-colors focus:border-primary"
            onInput={(event) => {
              jsonText.value = (event.target as HTMLTextAreaElement).value;
            }}
            spellcheck={false}
            value={jsonText.value}
          />
        </div>
      </Page>
    );
  },
});
