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
  emits: ['close', 'installationAction'],
  setup(props, { emit }) {
    const renderStatusTag = (status?: string) => {
      if (!status) return <Tag color="default">-</Tag>;
      const color =
        status === 'uninstalled' ? 'error' : getQqbotStatusColor(status);
      return <Tag color={color}>{getQqbotStatusLabel(status)}</Tag>;
    };

    const renderEvents = () =>
      props.runtimeEvents.length > 0 ? (
        <div class="space-y-3">
          {props.runtimeEvents.map((item) => (
            <div
              class="border-b border-solid border-gray-100 pb-3"
              key={item.id}
            >
              <div>
                <Tag color={item.level === 'error' ? 'error' : 'processing'}>
                  {item.level}
                </Tag>
                <span>{item.eventType}</span>
              </div>
              <pre class="mt-2 whitespace-pre-wrap text-xs">
                {JSON.stringify(item.safeSummary || {}, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <span>暂无运行事件</span>
      );

    const renderBindings = () =>
      props.accountBindings.length > 0 ? (
        <div class="space-y-3">
          {props.accountBindings.map((item) => (
            <div
              class="border-b border-solid border-gray-100 pb-3"
              key={item.id}
            >
              {renderStatusTag(item.enabled ? 'enabled' : 'disabled')}
              <span>
                插件 {item.pluginId} / 账号 {item.accountId}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <span>暂无账号绑定</span>
      );

    const renderInstallations = () =>
      props.installations.length > 0 ? (
        <div class="space-y-3">
          {props.installations.map((item) => (
            <div
              class="border-b border-solid border-gray-100 pb-3"
              key={item.id}
            >
              <div class="mb-2 flex items-center gap-2">
                {renderStatusTag(item.status)}
                <Tag>{item.runtimeStatus || '-'}</Tag>
                <span>
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
                  onClick: () => emit('installationAction', item, 'uninstall'),
                },
              ])}
            </div>
          ))}
        </div>
      ) : (
        <span>暂无安装记录</span>
      );

    const renderContent = () => {
      if (props.mode === 'events') return renderEvents();
      if (props.mode === 'bindings') return renderBindings();
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
