import type { TableColumnType } from 'antdv-next';

import type { PluginPlatformDrawerMode } from './components/PluginPlatformStateDrawer';

import type { QqbotApi } from '#/api/qqbot';
import type { QqbotPluginPlatformApi } from '#/api/qqbot/plugin';
import type { KtTableApi, KtTableButton } from '#/components/kt-table';
import type { DictOption } from '#/hooks/useDict';

import { computed, defineComponent, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { message, Tag } from 'antdv-next';

import {
  bindQqbotPluginAccount,
  disableQqbotPluginInstallation,
  enableQqbotPluginInstallation,
  getQqbotPluginAccountBindings,
  getQqbotPluginHealth,
  getQqbotPluginList,
  getQqbotPluginOperationPage,
  getQqbotPluginPlatformInstallations,
  getQqbotPluginRuntimeEvents,
  installLocalQqbotPluginPackage,
  unbindQqbotPluginAccount,
  uninstallQqbotPluginInstallation,
  uploadQqbotPluginPackage,
  validateQqbotPluginManifest,
} from '#/api/qqbot/plugin';
import { KtTable, useKtTable } from '#/components/kt-table';
import { useDict } from '#/hooks/useDict';

import PluginManifestModal from './components/PluginManifestModal';
import PluginPlatformStateDrawer from './components/PluginPlatformStateDrawer';
import { loadQqbotPluginMetadata } from './metadata';

const AKtTable = KtTable as any;
const QQBOT_PLUGIN_TRIGGER_MODE_DICT = 'QQBOT_PLUGIN_TRIGGER_MODE';
const qqbotPluginTriggerModeFallback: Array<
  DictOption<QqbotApi.PluginTriggerMode>
> = [
  { label: '命令', value: 'command' },
  { label: '事件', value: 'event' },
];
const defaultManifest = {
  assets: [],
  configSchema: { type: 'object' },
  entry: 'src/index.ts',
  events: [],
  minApiSdkVersion: '1.0.0',
  name: 'Demo Plugin',
  operations: [
    {
      handlerName: 'echo',
      key: 'demo-plugin.echo',
      name: 'Echo',
      permissions: ['qqbot.send'],
      timeoutMs: 3000,
    },
  ],
  permissions: ['qqbot.send'],
  pluginKey: 'demo-plugin',
  runtime: {
    maxConcurrency: 1,
    memoryMb: 128,
    timeoutMs: 5000,
    workerType: 'node-worker',
  },
  version: '0.1.0',
};

export default defineComponent({
  name: 'QqBotPluginList',
  setup() {
    const accountBindings = ref<QqbotPluginPlatformApi.AccountBinding[]>([]);
    const drawerMode = ref<PluginPlatformDrawerMode>('installations');
    const drawerOpen = ref(false);
    const installations = ref<QqbotPluginPlatformApi.Installation[]>([]);
    const manifestMode = ref<'install' | 'upload' | 'validate'>('validate');
    const manifestModalOpen = ref(false);
    const manifestText = ref(JSON.stringify(defaultManifest, null, 2));
    const packageHashText = ref('');
    const packagePathText = ref('');
    const pluginOptions = ref<Array<{ label: string; value: string }>>([]);
    const pluginMap = ref<Record<string, QqbotApi.Plugin>>({});
    const platformLoading = ref(false);
    const runtimeEvents = ref<QqbotPluginPlatformApi.RuntimeEvent[]>([]);
    const drawerTitle = computed(() => {
      if (drawerMode.value === 'events') return '插件运行事件';
      if (drawerMode.value === 'bindings') return '插件账号绑定';
      return '插件安装记录';
    });
    const manifestModalTitle = computed(() => {
      if (manifestMode.value === 'install') return '本地安装插件包';
      if (manifestMode.value === 'upload') return '上传插件包';
      return '校验插件 Manifest';
    });
    const {
      labelOf: getTriggerModeLabel,
      options: triggerModeOptions,
      reload: reloadTriggerModeDict,
    } = useDict<QqbotApi.PluginTriggerMode>(QQBOT_PLUGIN_TRIGGER_MODE_DICT, {
      fallbackOptions: qqbotPluginTriggerModeFallback,
      immediate: false,
    });

    const columns: Array<TableColumnType<QqbotApi.PluginOperation>> = [
      { dataIndex: 'pluginKey', key: 'pluginKey', title: '插件', width: 160 },
      {
        dataIndex: 'triggerMode',
        key: 'triggerMode',
        title: '触发方式',
        width: 120,
      },
      { dataIndex: 'key', key: 'key', title: '能力 Key', width: 220 },
      { dataIndex: 'name', key: 'name', title: '能力名称', width: 160 },
      {
        dataIndex: 'description',
        key: 'description',
        title: '说明',
        width: 360,
      },
      {
        dataIndex: 'cacheTtlMs',
        key: 'cacheTtlMs',
        title: '建议缓存',
        width: 120,
      },
    ];
    const api: KtTableApi<QqbotApi.PluginOperation> = {
      list: async (params) => await getQqbotPluginOperationPage(params),
    };
    const buttons: Array<KtTableButton<QqbotApi.PluginOperation>> = [
      {
        key: 'manifestValidate',
        label: '校验 Manifest',
        onClick: () => openManifestModal('validate'),
      },
      {
        key: 'manifestUpload',
        label: '上传插件',
        onClick: () => openManifestModal('upload'),
      },
      {
        key: 'manifestInstall',
        label: '本地安装',
        onClick: () => openManifestModal('install'),
      },
      {
        key: 'installations',
        label: '安装记录',
        onClick: () => void loadInstallations(),
      },
      {
        key: 'runtimeEvents',
        label: '运行事件',
        onClick: () => void loadRuntimeEvents(),
      },
      {
        key: 'accountBindings',
        label: '账号绑定',
        onClick: () => void loadAccountBindings(),
      },
      {
        key: 'health',
        label: '健康检查',
        onClick: async () => {
          const health = await getQqbotPluginHealth();
          const content = health
            .map(
              (item) =>
                `${getTriggerModeLabel(item.triggerMode, '-')} ${item.name || item.pluginKey || ''}: ${item.status}${(() => {
                  if (item.message) {
                    return ` ${item.message}`;
                  }
                  return '';
                })()}`,
            )
            .join('；');
          message.success(content || '插件健康检查完成');
        },
      },
    ];
    const [registerTable] = useKtTable<QqbotApi.PluginOperation>({
      api,
      buttons,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Select',
            componentProps: () => ({
              allowClear: true,
              options: triggerModeOptions.value,
            }),
            fieldName: 'triggerMode',
            label: '触发方式',
          },
          {
            component: 'Select',
            componentProps: () => ({
              allowClear: true,
              options: pluginOptions.value,
            }),
            fieldName: 'pluginKey',
            label: '插件',
          },
        ],
      },
      showSelection: false,
      tableTitle: '插件能力',
    });

    onMounted(() => {
      void loadMetadata();
    });

    /**
     * 加载 QQBot 插件及触发模式字典，并建立插件键到记录和下拉选项的映射。
     */
    async function loadMetadata() {
      const metadata = await loadQqbotPluginMetadata({
        labelOf: getTriggerModeLabel,
        loadPlugins: () => getQqbotPluginList(),
        reloadTriggerModes: () => reloadTriggerModeDict(),
      });
      pluginMap.value = metadata.pluginMap;
      pluginOptions.value = metadata.pluginOptions;
    }

    /**
     * 以查看或校验模式打开插件 manifest 弹窗，并传入当前 manifest 内容。
     *
     * @param mode - 决定 manifest 弹窗只读查看或校验行为的模式。
     */
    function openManifestModal(mode: typeof manifestMode.value) {
      manifestMode.value = mode;
      manifestText.value = JSON.stringify(defaultManifest, null, 2);
      packageHashText.value = '';
      packagePathText.value = '';
      manifestModalOpen.value = true;
    }

    /**
     * 解析插件 manifest 编辑文本；JSON 非法时提示用户并返回 undefined。
     *
     * @returns 解析成功的 manifest 对象；JSON 非法时提示用户并返回 undefined。
     */
    function parseManifestText() {
      try {
        return JSON.parse(manifestText.value);
      } catch {
        message.error('Manifest JSON 格式不正确');
        return undefined;
      }
    }

    /**
     * 按当前模式上传校验插件包、从 NAS 路径安装插件或校验 manifest，成功后关闭弹窗。
     */
    async function submitManifest() {
      platformLoading.value = true;
      try {
        if (manifestMode.value === 'upload') {
          const body = parsePackageBody();
          if (!body) return;
          const result = await uploadQqbotPluginPackage(body);
          message.success(
            (() => {
              if (result.packageHash) {
                return `插件包上传校验通过：${result.packageHash.slice(0, 12)}`;
              }
              return '插件包上传校验通过';
            })(),
          );
        } else if (manifestMode.value === 'install') {
          const body = parsePackageBody();
          if (!body) return;
          await installLocalQqbotPluginPackage(body);
          message.success('插件已安装');
          await loadInstallations(false);
        } else {
          const manifest = parseManifestText();
          if (!manifest) return;
          await validateQqbotPluginManifest(manifest);
          message.success('Manifest 校验通过');
        }
        manifestModalOpen.value = false;
      } finally {
        platformLoading.value = false;
      }
    }

    /**
     * 校验受控插件包路径并组合可选摘要，缺少路径时提示并返回 undefined。
     *
     * @returns 包含受控本地包路径和可选摘要的安装请求体；没有包路径时返回 undefined。
     */
    function parsePackageBody():
      | QqbotPluginPlatformApi.PackageBody
      | undefined {
      const packagePath = packagePathText.value.trim();
      const packageHash = packageHashText.value.trim();
      if (!packagePath) {
        message.error('请输入受控插件包路径');
        return undefined;
      }
      return {
        ...(() => {
          if (packageHash) {
            return { packageHash };
          }
          return {};
        })(),
        packagePath,
      };
    }

    /**
     * 加载 QQBot 插件平台安装记录，并按调用选项打开安装记录抽屉。
     *
     * @param openDrawer - 加载完成后是否打开安装记录抽屉；省略时为 true。
     */
    async function loadInstallations(openDrawer = true) {
      installations.value = await getQqbotPluginPlatformInstallations();
      drawerMode.value = 'installations';
      drawerOpen.value = openDrawer || drawerOpen.value;
    }

    /**
     * 加载 QQBot 插件运行事件，并打开事件抽屉。
     */
    async function loadRuntimeEvents() {
      runtimeEvents.value = await getQqbotPluginRuntimeEvents();
      drawerMode.value = 'events';
      drawerOpen.value = true;
    }

    /**
     * 加载 QQBot 插件账号绑定，并打开绑定关系抽屉。
     */
    async function loadAccountBindings() {
      accountBindings.value = await getQqbotPluginAccountBindings();
      drawerMode.value = 'bindings';
      drawerOpen.value = true;
    }

    /**
     * 按绑定或解绑动作更新插件平台账号关系，并刷新包含官方账号的绑定矩阵。
     *
     * @param row - 当前账号与插件组合记录。
     * @param action - 要执行的绑定状态变更。
     */
    async function updateAccountBinding(
      row: QqbotPluginPlatformApi.AccountBinding,
      action: 'bind' | 'unbind',
    ) {
      if (action === 'bind') {
        await bindQqbotPluginAccount(row.accountId, row.pluginId);
        message.success('插件已绑定到当前账号');
      } else {
        await unbindQqbotPluginAccount(row.accountId, row.pluginId);
        message.success('插件已从当前账号解绑');
      }
      await loadAccountBindings();
    }

    /**
     * 按启用、禁用或卸载动作更新 QQBot 插件安装，提示成功后刷新安装记录。
     *
     * @param row - 要启用、停用或卸载的 QQBot 插件安装记录。
     * @param action - 要执行的 enable、disable、upgrade 或 uninstall 安装操作。
     */
    async function updateInstallationStatus(
      row: QqbotPluginPlatformApi.Installation,
      action: 'disable' | 'enable' | 'uninstall',
    ) {
      if (action === 'enable') {
        await enableQqbotPluginInstallation(row.id);
        message.success('插件已启用');
      } else if (action === 'disable') {
        await disableQqbotPluginInstallation(row.id);
        message.success('插件已禁用');
      } else {
        await uninstallQqbotPluginInstallation(row.id);
        message.success('插件已卸载');
      }
      await loadInstallations(false);
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as QqbotApi.PluginOperation;
              if (column.key === 'pluginKey') {
                const plugin = pluginMap.value[row.pluginKey];
                if (plugin) {
                  return (
                    <Tag color="processing">
                      {plugin.name} v{plugin.version}
                    </Tag>
                  );
                }
                return row.pluginKey;
              }
              if (column.key === 'triggerMode') {
                return (
                  <Tag
                    color={(() => {
                      if (row.triggerMode === 'event') {
                        return 'warning';
                      }
                      return 'blue';
                    })()}
                  >
                    {getTriggerModeLabel(row.triggerMode, '-')}
                  </Tag>
                );
              }
              if (column.key === 'cacheTtlMs') {
                if (row.cacheTtlMs) {
                  return `${row.cacheTtlMs} ms`;
                }
                return '-';
              }
              return undefined;
            },
          }}
        />
        <PluginManifestModal
          loading={platformLoading.value}
          mode={manifestMode.value}
          onClose={() => {
            manifestModalOpen.value = false;
          }}
          onSubmit={() => void submitManifest()}
          onUpdate:packageHash={(value: string) => {
            packageHashText.value = value;
          }}
          onUpdate:packagePath={(value: string) => {
            packagePathText.value = value;
          }}
          onUpdate:value={(value: string) => {
            manifestText.value = value;
          }}
          open={manifestModalOpen.value}
          packageHash={packageHashText.value}
          packagePath={packagePathText.value}
          title={manifestModalTitle.value}
          value={manifestText.value}
        />
        <PluginPlatformStateDrawer
          accountBindings={accountBindings.value}
          installations={installations.value}
          mode={drawerMode.value}
          onAccountBindingAction={(
            row: QqbotPluginPlatformApi.AccountBinding,
            action: 'bind' | 'unbind',
          ) => void updateAccountBinding(row, action)}
          onClose={() => {
            drawerOpen.value = false;
          }}
          onInstallationAction={(
            row: QqbotPluginPlatformApi.Installation,
            action: 'disable' | 'enable' | 'uninstall',
          ) => void updateInstallationStatus(row, action)}
          open={drawerOpen.value}
          runtimeEvents={runtimeEvents.value}
          title={drawerTitle.value}
        />
      </Page>
    );
  },
});
