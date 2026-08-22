import type { PropType } from 'vue';

import type { QqbotPluginPlatformApi } from '#/api/qqbot/plugin';

import { defineComponent } from 'vue';

import { Drawer, Tag } from 'antdv-next';

import { renderQqbotActions } from '../../modules/actions';
import { getQqbotStatusColor, getQqbotStatusLabel } from '../../modules/status';

const ADrawer = Drawer as any;

export type PluginPlatformDrawerMode = 'bindings' | 'events' | 'installations';

export default defineComponent({
  name: 'QqBotPluginPlatformStateDrawer',
  props: {
    accountBindings: {
      default: () => [],
      type: Array as PropType<QqbotPluginPlatformApi.AccountBinding[]>,
    },
    installations: {
      default: () => [],
      type: Array as PropType<QqbotPluginPlatformApi.Installation[]>,
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
      type: Array as PropType<QqbotPluginPlatformApi.RuntimeEvent[]>,
    },
    title: {
      default: '',
      type: String,
    },
  },
  emits: ['accountBindingAction', 'close', 'installationAction'],
  setup(props, { emit }) {
    const renderStatusTag = (status?: string) => {
      if (!status) return <Tag color="default">-</Tag>;
      const color = (() => {
        if (status === 'uninstalled') {
          return 'error';
        }
        return getQqbotStatusColor(status);
      })();
      return <Tag color={color}>{getQqbotStatusLabel(status)}</Tag>;
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

    const renderBindings = () => {
      if (props.accountBindings.length > 0) {
        return (
          <div class="space-y-3">
            {props.accountBindings.map((item) => (
              <div
                class="border-b border-solid border-border pb-3"
                key={`${item.accountId}:${item.pluginId}`}
              >
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  {renderStatusTag(
                    (() => {
                      if (item.bound) {
                        return 'enabled';
                      }
                      return 'disabled';
                    })(),
                  )}
                  <Tag color={getConnectionModeColor(item.connectionMode)}>
                    {getConnectionModeLabel(item.connectionMode)}
                  </Tag>
                  <span class="text-foreground">
                    {item.pluginName || item.pluginKey} →{' '}
                    {item.accountName || item.selfId}
                  </span>
                  <Tag>{item.pluginKey}</Tag>
                  <Tag>{item.selfId}</Tag>
                </div>
                {renderQqbotActions([
                  {
                    disabled: item.bound,
                    key: 'bind',
                    label: '绑定',
                    onClick: () => emit('accountBindingAction', item, 'bind'),
                  },
                  {
                    danger: true,
                    disabled: !item.bound,
                    key: 'unbind',
                    label: '解绑',
                    onClick: () => emit('accountBindingAction', item, 'unbind'),
                  },
                ])}
              </div>
            ))}
          </div>
        );
      }
      return <span>暂无账号绑定</span>;
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
                {renderQqbotActions([
                  {
                    disabled: item.status === 'enabled',
                    key: 'enable',
                    label: '启用',
                    onClick: () => emit('installationAction', item, 'enable'),
                  },
                  {
                    disabled: item.status === 'disabled',
                    key: 'disable',
                    label: '禁用',
                    onClick: () => emit('installationAction', item, 'disable'),
                  },
                  {
                    danger: true,
                    key: 'uninstall',
                    label: '卸载',
                    onClick: () =>
                      emit('installationAction', item, 'uninstall'),
                  },
                ])}
              </div>
            ))}
          </div>
        );
      }
      return <span>暂无安装记录</span>;
    };

    const renderContent = () => {
      if (props.mode === 'events') return renderEvents();
      if (props.mode === 'bindings') return renderBindings();
      return renderInstallations();
    };

    /**
     * 把账号 transport 映射为绑定抽屉中的中文标签。
     *
     * @param connectionMode - QQBot 账号接入方式。
     * @returns NapCat、官方 WebSocket 或官方 Webhook 标签。
     */
    function getConnectionModeLabel(connectionMode: string) {
      if (connectionMode === 'official-websocket') return '官方 WebSocket';
      if (connectionMode === 'official-webhook') return '官方 Webhook';
      return 'NapCat OneBot';
    }

    /**
     * 把账号 transport 映射为容易区分的标签颜色。
     *
     * @param connectionMode - QQBot 账号接入方式。
     * @returns Antdv Tag 可识别的语义颜色。
     */
    function getConnectionModeColor(connectionMode: string) {
      if (connectionMode === 'official-websocket') return 'purple';
      if (connectionMode === 'official-webhook') return 'cyan';
      return 'blue';
    }

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
