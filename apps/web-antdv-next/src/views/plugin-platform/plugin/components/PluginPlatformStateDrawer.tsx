import type { PropType } from 'vue';

import type { BotActionItem } from '../../modules/actions';

import type { PluginPlatformApi } from '#/api/plugin-platform/plugin';

import { computed, defineComponent } from 'vue';

import { Alert, Button, Drawer, Tag } from 'antdv-next';

import { renderBotActions } from '../../modules/actions';
import { getBotStatusColor, getBotStatusLabel } from '../../modules/status';
import { isInstallationActionAvailable } from '../usePluginPlatformState';

const ADrawer = Drawer as any;
const AAlert = Alert as any;
const AButton = Button as any;

export type PluginPlatformDrawerMode = 'events' | 'installations';

export default defineComponent({
  name: 'PluginPlatformStateDrawer',
  props: {
    allowedInstallationActions: {
      default: () => ['disable', 'enable', 'uninstall'],
      type: Array as PropType<Array<'disable' | 'enable' | 'uninstall'>>,
    },
    error: {
      default: '',
      type: String,
    },
    installations: {
      default: () => [],
      type: Array as PropType<PluginPlatformApi.Installation[]>,
    },
    intentRevision: {
      default: 0,
      type: Number,
    },
    known: {
      default: true,
      type: Boolean,
    },
    loading: {
      default: false,
      type: Boolean,
    },
    mode: {
      default: 'installations',
      type: String as PropType<PluginPlatformDrawerMode>,
    },
    open: {
      default: false,
      type: Boolean,
    },
    pendingInstallationIds: {
      default: () => [],
      type: Array as PropType<string[]>,
    },
    runtimeEvents: {
      default: () => [],
      type: Array as PropType<PluginPlatformApi.RuntimeEvent[]>,
    },
    title: {
      default: '',
      type: String,
    },
  },
  emits: ['close', 'installationAction', 'retry'],
  setup(props, { emit }) {
    const pendingIds = computed(() => new Set(props.pendingInstallationIds));
    const renderStatusTag = (status?: string) => {
      if (!status) return <Tag color="default">-</Tag>;
      return (
        <Tag color={getBotStatusColor(status)}>{getBotStatusLabel(status)}</Tag>
      );
    };

    const renderEvents = () => {
      if (props.runtimeEvents.length > 0) {
        return (
          <div class="space-y-3">
            {props.runtimeEvents.map((item) => (
              <div
                class="min-w-0 border-b border-solid border-border pb-3"
                key={item.id}
              >
                <div class="flex flex-wrap items-center gap-2">
                  <Tag
                    color={(() => {
                      if (item.level === 'error') {
                        return 'error';
                      }
                      if (item.level === 'warn') {
                        return 'warning';
                      }
                      return 'processing';
                    })()}
                  >
                    {(() => {
                      if (item.level === 'error') return '错误';
                      if (item.level === 'warn') return '警告';
                      return '信息';
                    })()}
                  </Tag>
                  <span class="min-w-0 break-all text-foreground">
                    {item.eventType}
                  </span>
                </div>
                <details class="mt-2 min-w-0 text-xs">
                  <summary class="cursor-pointer">安全摘要</summary>
                  <pre class="mt-2 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted p-2 text-foreground">
                    {JSON.stringify(item.safeSummary || {}, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        );
      }
      return <span>暂无运行事件</span>;
    };

    const buildInstallationActions = (item: PluginPlatformApi.Installation) => {
      const actions: BotActionItem[] = [];
      const pending = pendingIds.value.has(item.id);
      const intentRevision = props.intentRevision;
      if (props.allowedInstallationActions.includes('enable')) {
        actions.push({
          disabled:
            pending || !isInstallationActionAvailable(item.status, 'enable'),
          key: 'enable',
          label: '启用',
          onClick: () =>
            emit('installationAction', item, 'enable', intentRevision),
        });
      }
      if (props.allowedInstallationActions.includes('disable')) {
        actions.push({
          disabled:
            pending || !isInstallationActionAvailable(item.status, 'disable'),
          key: 'disable',
          label: '禁用',
          onClick: () =>
            emit('installationAction', item, 'disable', intentRevision),
        });
      }
      if (props.allowedInstallationActions.includes('uninstall')) {
        actions.push({
          confirmText: `确认卸载安装 ${item.id}（插件ID ${item.pluginId} / 版本ID ${item.versionId}）吗？`,
          danger: true,
          disabled:
            pending || !isInstallationActionAvailable(item.status, 'uninstall'),
          key: 'uninstall',
          label: '卸载',
          onClick: () =>
            emit('installationAction', item, 'uninstall', intentRevision),
        });
      }
      return actions;
    };

    const renderInstallations = () => {
      if (props.installations.length > 0) {
        return (
          <div class="space-y-3">
            {props.installations.map((item) => (
              <div
                class="min-w-0 border-b border-solid border-border pb-3"
                key={item.id}
              >
                <div class="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                  {renderStatusTag(item.status)}
                  {renderStatusTag(item.runtimeStatus)}
                  {pendingIds.value.has(item.id) && (
                    <Tag color="processing">处理中</Tag>
                  )}
                </div>
                <div class="mb-2 min-w-0 break-all text-foreground">
                  插件ID：{item.pluginId}
                  <br />
                  版本ID：{item.versionId}
                </div>
                {renderBotActions(buildInstallationActions(item))}
              </div>
            ))}
          </div>
        );
      }
      return <span>暂无安装记录</span>;
    };

    const renderContent = () => {
      if (props.loading) return <span role="status">读取中…</span>;
      if (props.error) {
        return (
          <AAlert
            action={
              <AButton onClick={() => emit('retry', props.mode)}>重试</AButton>
            }
            showIcon
            title={props.error}
            type="warning"
          />
        );
      }
      if (!props.known) return <span>尚未读取</span>;
      if (props.mode === 'events') return renderEvents();
      return renderInstallations();
    };

    return () => (
      <ADrawer
        onClose={() => emit('close')}
        open={props.open}
        size="large"
        title={props.title}
      >
        {renderContent()}
      </ADrawer>
    );
  },
});
