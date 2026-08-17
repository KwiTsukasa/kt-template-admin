import type { BlogApi } from '#/api/blog';

import { computed, defineComponent, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { Button, message, Space, Tag } from 'antdv-next';

import { getThemeConfig, saveThemeConfig } from '#/api/blog';

const AButton = Button as any;

export default defineComponent({
  name: 'BlogThemeConfig',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const config = ref<BlogApi.ThemeConfig>({});
    const jsonText = ref('');
    const loading = ref(false);
    const saving = ref(false);
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

    /**
     * 加载博客主题配置并应用到表单状态，请求期间保持加载指示。
     */
    async function loadConfig() {
      loading.value = true;
      try {
        const nextConfig = await getThemeConfig();
        applyConfig(nextConfig);
      } finally {
        loading.value = false;
      }
    }

    /**
     * 将主题配置及其格式化 JSON 文本同步到编辑区；空值回退为空对象。
     *
     * @param nextConfig - 要同步到主题编辑区的配置；空值按空对象处理。
     */
    function applyConfig(nextConfig: BlogApi.ThemeConfig) {
      config.value = nextConfig || {};
      jsonText.value = JSON.stringify(config.value, null, 2);
    }

    /**
     * 解析博客主题 JSON 配置；格式错误时提示用户并返回 null。
     *
     * @returns 解析成功时返回主题配置对象；空文本或非法 JSON 提示用户后返回 null。
     */
    function parseJsonConfig() {
      try {
        return JSON.parse(jsonText.value || '{}') as BlogApi.ThemeConfig;
      } catch {
        message.warning('主题配置 JSON 格式不正确');
        return null;
      }
    }

    /**
     * 解析并保存主题 JSON，成功后用服务端配置刷新编辑区并提示用户。
     */
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
                {(() => {
                  if (canSave.value) {
                    return (
                      <AButton
                        loading={saving.value}
                        onClick={saveConfig}
                        type="primary"
                      >
                        保存配置
                      </AButton>
                    );
                  }
                  return null;
                })()}
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
