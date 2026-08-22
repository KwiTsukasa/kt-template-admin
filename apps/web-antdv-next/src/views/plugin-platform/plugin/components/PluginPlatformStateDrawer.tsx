import type { PropType } from 'vue';

import type { BotActionItem } from '../../modules/actions';

import type { PluginPlatformApi } from '#/api/plugin-platform/plugin';

import { defineComponent } from 'vue';

import { Drawer, Tag } from 'antdv-next';

import { renderBotActions } from '../../modules/actions';
import { getBotStatusColor, getBotStatusLabel } from '../../modules/status';

const ADrawer = Drawer as any;

export type PluginPlatformDrawerMode = 'events' | 'installations';

export default defineComponent({
  name: 'PluginPlatformStateDrawer',
  props: {
    allowedInstallationActions: {
      default: () => ['disable', 'enable', 'uninstall'],
      type: Array as PropType<Array<'disable' | 'enable' | 'uninstall'>>,
    },
    installations: {
      default: () => [],
      type: Array as PropType<PluginPlatformApi.Installation[]>,
    },
    mode: {
      default: 'installations',
      type: String as PropType<PluginPlatformDrawerMode>,
    },
    open: {
      default: false,
      type: Boolean,
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
  emits: ['close', 'installationAction'],
  setup(props, { emit }) {
    const renderStatusTag = (status?: string) => {
      if (!status) return <Tag color="default">-</Tag>;
      const color = (() => {
        if (status === 'uninstalled') {
          return 'error';
        }
        return getBotStatusColor(status);
      })();
      return <Tag color={color}>{getBotStatusLabel(status)}</Tag>;
    };

    const renderEvents = () => {
      if (props.runtimeEvents.length > 0) {
        return (
          <div class="space-y-3">
            {props.runtimeEvents.map((item) => (
              <div
                class="border-b border-solid border-border pb-3"
                key={item.id}
              >
                <div class="flex flex-wrap items-center gap-2">
                  <Tag
                    color={(() => {
                      if (item.level === 'error') {
                        return 'error';
                      }
                      return 'processing';
                    })()}
                  >
                    {item.level}
                  </Tag>
                  <span class="text-foreground">{item.eventType}</span>
                </div>
                <pre class="mt-2 whitespace-pre-wrap rounded border border-border bg-muted p-2 text-xs text-foreground">
                  {JSON.stringify(item.safeSummary || {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        );
      }
      return <span>暂无运行事件</span>;
    };

    const buildInstallationActions = (item: PluginPlatformApi.Installation) => {
      const actions: BotActionItem[] = [];
      if (props.allowedInstallationActions.includes('enable')) {
        actions.push({
          disabled: item.status === 'enabled',
          key: 'enable',
          label: '启用',
          onClick: () => emit('installationAction', item, 'enable'),
        });
      }
      if (props.allowedInstallationActions.includes('disable')) {
        actions.push({
          disabled: item.status === 'disabled',
          key: 'disable',
          label: '禁用',
          onClick: () => emit('installationAction', item, 'disable'),
        });
      }
      if (props.allowedInstallationActions.includes('uninstall')) {
        actions.push({
          danger: true,
          key: 'uninstall',
          label: '卸载',
          onClick: () => emit('installationAction', item, 'uninstall'),
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
                class="border-b border-solid border-border pb-3"
                key={item.id}
              >
                <div class="mb-2 flex items-center gap-2">
                  {renderStatusTag(item.status)}
                  <Tag>{item.runtimeStatus || '-'}</Tag>
                  <span class="text-foreground">
                    插件 {item.pluginId} / 版本 {item.versionId}
                  </span>
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
