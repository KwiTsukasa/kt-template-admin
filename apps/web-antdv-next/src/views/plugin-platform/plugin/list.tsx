import type { TableColumnType } from 'antdv-next';

import type { PluginPlatformDrawerMode } from './components/PluginPlatformStateDrawer';

import type { PluginPlatformApi } from '#/api/plugin-platform/plugin';
import type { KtTableApi, KtTableButton } from '#/components/kt-table';
import type { DictOption } from '#/hooks/useDict';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { message, Tag } from 'antdv-next';

import {
  disablePluginInstallation,
  enablePluginInstallation,
  getPluginHealth,
  getPluginInstallations,
  getPluginList,
  getPluginOperationPage,
  getPluginRuntimeEvents,
  installLocalPluginPackage,
  uninstallPluginInstallation,
  uploadPluginPackage,
  validatePluginManifest,
} from '#/api/plugin-platform/plugin';
import { KtTable, useKtTable } from '#/components/kt-table';
import { useDict } from '#/hooks/useDict';

import PluginManifestModal from './components/PluginManifestModal';
import PluginPlatformStateDrawer from './components/PluginPlatformStateDrawer';
import { loadPluginMetadata } from './metadata';
import {
  isInstallationActionAvailable,
  isInstallationWritePending,
  pendingInstallationIds,
  settleInstallationWrite,
  subscribeInstallationWriteSettled,
} from './usePluginPlatformState';

const AKtTable = KtTable as any;
const PLUGIN_TRIGGER_MODE_DICT = 'PLUGIN_TRIGGER_MODE';
const pluginTriggerModeFallback: Array<
  DictOption<PluginPlatformApi.PluginTriggerMode>
> = [
  { label: '命令', value: 'command' },
  { label: '事件', value: 'event' },
];

interface DrawerReadState {
  error: string;
  known: boolean;
  loading: boolean;
  revision: number;
}

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
      permissions: ['bot.reply'],
      timeoutMs: 3000,
    },
  ],
  permissions: ['bot.reply'],
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
  name: 'PluginPlatformList',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const drawerMode = ref<PluginPlatformDrawerMode>('installations');
    const drawerOpen = ref(false);
    const drawerIntentRevision = ref(0);
    const drawerRead = reactive<
      Record<PluginPlatformDrawerMode, DrawerReadState>
    >({
      installations: { error: '', known: false, loading: false, revision: 0 },
      events: { error: '', known: false, loading: false, revision: 0 },
    });
    let disposed = false;
    const installations = ref<PluginPlatformApi.Installation[]>([]);
    const manifestMode = ref<'install' | 'upload' | 'validate'>('validate');
    const manifestModalOpen = ref(false);
    const manifestText = ref(JSON.stringify(defaultManifest, null, 2));
    const packageHashText = ref('');
    const packagePathText = ref('');
    const pluginOptions = ref<Array<{ label: string; value: string }>>([]);
    const pluginMap = ref<Record<string, PluginPlatformApi.Plugin>>({});
    const platformLoading = ref(false);
    const runtimeEvents = ref<PluginPlatformApi.RuntimeEvent[]>([]);
    const drawerTitle = computed(() => {
      if (drawerMode.value === 'events') return '插件运行事件';
      return '插件安装记录';
    });
    const activeDrawerRead = computed(() => drawerRead[drawerMode.value]);
    const manifestModalTitle = computed(() => {
      if (manifestMode.value === 'install') return '本地安装插件包';
      if (manifestMode.value === 'upload') return '上传插件包';
      return '校验插件 Manifest';
    });
    const {
      labelOf: getTriggerModeLabel,
      options: triggerModeOptions,
      reload: reloadTriggerModeDict,
    } = useDict<PluginPlatformApi.PluginTriggerMode>(PLUGIN_TRIGGER_MODE_DICT, {
      fallbackOptions: pluginTriggerModeFallback,
      immediate: false,
    });

    const columns: Array<TableColumnType<PluginPlatformApi.PluginOperation>> = [
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
    const api: KtTableApi<PluginPlatformApi.PluginOperation> = {
      list: async (params) => await getPluginOperationPage(params),
    };
    const buttons: Array<KtTableButton<PluginPlatformApi.PluginOperation>> = [
      {
        key: 'manifestValidate',
        label: '校验 Manifest',
        onClick: () => openManifestModal('validate'),
        permissionCodes: ['PluginPlatform:Plugin:Install'],
      },
      {
        key: 'manifestUpload',
        label: '上传插件',
        onClick: () => openManifestModal('upload'),
        permissionCodes: ['PluginPlatform:Plugin:Install'],
      },
      {
        key: 'manifestInstall',
        label: '本地安装',
        onClick: () => openManifestModal('install'),
        permissionCodes: ['PluginPlatform:Plugin:Install'],
      },
      {
        key: 'installations',
        label: '安装记录',
        onClick: () => void loadInstallations(),
        permissionCodes: ['PluginPlatform:Plugin:List'],
      },
      {
        key: 'runtimeEvents',
        label: '运行事件',
        onClick: () => void loadRuntimeEvents(),
        permissionCodes: ['PluginPlatform:Plugin:List'],
      },
      {
        key: 'health',
        label: '健康检查',
        permissionCodes: ['PluginPlatform:Plugin:List'],
        onClick: async () => {
          const health = await getPluginHealth();
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
    const [registerTable] = useKtTable<PluginPlatformApi.PluginOperation>({
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
    const allowedInstallationActions = computed(() => {
      const actions: Array<'disable' | 'enable' | 'uninstall'> = [];
      if (hasAccessByCodes(['PluginPlatform:Plugin:Enable'])) {
        actions.push('enable');
      }
      if (hasAccessByCodes(['PluginPlatform:Plugin:Disable'])) {
        actions.push('disable');
      }
      if (hasAccessByCodes(['PluginPlatform:Plugin:Uninstall'])) {
        actions.push('uninstall');
      }
      return actions;
    });

    onMounted(() => {
      void loadMetadata();
    });

    const unsubscribeWrites = subscribeInstallationWriteSettled(() => {
      if (disposed || !drawerOpen.value || drawerMode.value !== 'installations')
        return;
      void readDrawerMode('installations');
    });

    onBeforeUnmount(() => {
      disposed = true;
      drawerRead.installations.revision += 1;
      drawerRead.events.revision += 1;
      unsubscribeWrites();
    });

    /**
     * 加载 Bot 插件及触发模式字典，并建立插件键到记录和下拉选项的映射。
     */
    async function loadMetadata() {
      const metadata = await loadPluginMetadata({
        labelOf: getTriggerModeLabel,
        loadPlugins: () => getPluginList(),
        reloadTriggerModes: () => reloadTriggerModeDict(),
      });
      if (disposed) return;
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
          const result = await uploadPluginPackage(body);
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
          await installLocalPluginPackage(body);
          message.success('插件已安装');
          await loadInstallations(false);
        } else {
          const manifest = parseManifestText();
          if (!manifest) return;
          await validatePluginManifest(manifest);
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
    function parsePackageBody(): PluginPlatformApi.PackageBody | undefined {
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
     * 固定用户当前抽屉意图并失效旧模式在途读取，数据是否成功由本模式单独维护。
     * @param mode - 用户明确打开的安装记录或运行事件视图。
     */
    function openDrawerMode(mode: PluginPlatformDrawerMode) {
      drawerRead[drawerMode.value].revision += 1;
      drawerRead[drawerMode.value].loading = false;
      drawerIntentRevision.value += 1;
      drawerMode.value = mode;
      drawerOpen.value = true;
    }

    /**
     * 关闭当前抽屉并使已发读取和未确认操作失去展示会话。
     */
    function closeDrawer() {
      drawerOpen.value = false;
      drawerIntentRevision.value += 1;
      drawerRead[drawerMode.value].revision += 1;
      drawerRead[drawerMode.value].loading = false;
    }

    /**
     * 仅把当前打开模式的最新完整读取提交为已知列表；失败保留错误供同模式重试。
     * @param mode - 本次读取固定归属的安装记录或运行事件。
     */
    async function readDrawerMode(mode: PluginPlatformDrawerMode) {
      const state = drawerRead[mode];
      const request = ++state.revision;
      state.known = false;
      state.loading = true;
      state.error = '';
      const isCurrent = () =>
        !disposed &&
        drawerOpen.value &&
        drawerMode.value === mode &&
        state.revision === request;
      try {
        if (mode === 'installations') {
          const rows = await getPluginInstallations();
          if (!isCurrent()) return;
          if (!Array.isArray(rows)) {
            state.error = '安装记录读取失败，请重试。';
            return;
          }
          installations.value = rows;
        } else {
          const rows = await getPluginRuntimeEvents();
          if (!isCurrent()) return;
          if (!Array.isArray(rows)) {
            state.error = '运行事件读取失败，请重试。';
            return;
          }
          runtimeEvents.value = rows;
        }
        state.known = true;
      } catch {
        if (!isCurrent()) return;
        if (mode === 'installations') {
          state.error = '安装记录读取失败，请重试。';
        } else {
          state.error = '运行事件读取失败，请重试。';
        }
      } finally {
        if (isCurrent()) state.loading = false;
      }
    }

    /**
     * 用户点击时立即打开安装视图；写后静默调用只在当前仍打开安装视图时回读。
     * @param openDrawer - 是否属于用户打开意图，省略时为 true。
     */
    async function loadInstallations(openDrawer = true) {
      if (openDrawer) openDrawerMode('installations');
      if (!drawerOpen.value || drawerMode.value !== 'installations') return;
      await readDrawerMode('installations');
    }

    /**
     * 用户点击时立即打开事件视图并启动仅属于该视图的读取。
     */
    async function loadRuntimeEvents() {
      openDrawerMode('events');
      await readDrawerMode('events');
    }

    /**
     * 拒绝抽屉已关闭、模式已切换或安装记录已变化的确认意图。
     * @param row - 打开操作时显示的安装记录。
     * @param action - 用户确认的安装操作。
     * @param intentRevision - 打开操作时的抽屉会话序号。
     * @returns 当前仍在同一安装视图且该条目状态未改变时为 true。
     */
    function hasCurrentInstallationIntent(
      row: PluginPlatformApi.Installation,
      action: 'disable' | 'enable' | 'uninstall',
      intentRevision: number,
    ) {
      if (disposed || !drawerOpen.value || drawerMode.value !== 'installations')
        return false;
      if (
        drawerIntentRevision.value !== intentRevision ||
        !drawerRead.installations.known
      )
        return false;
      if (!allowedInstallationActions.value.includes(action)) return false;
      const current = installations.value.find((item) => item.id === row.id);
      return !!current && current.status === row.status;
    }

    /**
     * 只按当前已确认安装视图与精确条目提交一次操作，结算后仅回读仍打开的安装视图。
     * @param row - 要启用、停用或卸载的 Bot 插件安装记录。
     * @param action - 要执行的 enable、disable 或 uninstall 安装操作。
     * @param intentRevision - 打开确认框时捕获的抽屉会话序号。
     */
    async function updateInstallationStatus(
      row: PluginPlatformApi.Installation,
      action: 'disable' | 'enable' | 'uninstall',
      intentRevision: number,
    ) {
      if (!hasCurrentInstallationIntent(row, action, intentRevision)) {
        message.warning('安装记录已变化，请重新确认');
        return;
      }
      if (!isInstallationActionAvailable(row.status, action)) return;
      if (isInstallationWritePending(row.id)) return;
      const outcome = await settleInstallationWrite(row.id, async () => {
        if (action === 'enable') {
          await enablePluginInstallation(row.id);
        } else if (action === 'disable') {
          await disablePluginInstallation(row.id);
        } else {
          await uninstallPluginInstallation(row.id);
        }
      });
      if (disposed) return;
      if (outcome === 'saved') {
        if (action === 'enable') message.success('插件已启用');
        else if (action === 'disable') message.success('插件已禁用');
        else message.success('插件已卸载');
      } else if (outcome === 'failed') {
        message.warning('安装操作请求失败，实际状态待确认；正在重新读取');
      }
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as PluginPlatformApi.PluginOperation;
              if (column.key === 'pluginKey') {
                const plugin = pluginMap.value[row.pluginKey];
                if (plugin) {
                  return (
                    <Tag color="processing">
                      {`${plugin.name} v${plugin.version}`}
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
          allowedInstallationActions={allowedInstallationActions.value}
          error={activeDrawerRead.value.error}
          installations={installations.value}
          intentRevision={drawerIntentRevision.value}
          known={activeDrawerRead.value.known}
          loading={activeDrawerRead.value.loading}
          mode={drawerMode.value}
          onClose={closeDrawer}
          onInstallationAction={(
            row: PluginPlatformApi.Installation,
            action: 'disable' | 'enable' | 'uninstall',
            intentRevision: number,
          ) => void updateInstallationStatus(row, action, intentRevision)}
          onRetry={(mode: PluginPlatformDrawerMode) => {
            if (drawerOpen.value && drawerMode.value === mode)
              void readDrawerMode(mode);
          }}
          open={drawerOpen.value}
          pendingInstallationIds={pendingInstallationIds.value}
          runtimeEvents={runtimeEvents.value}
          title={drawerTitle.value}
        />
      </Page>
    );
  },
});
