import type { PropType } from 'vue';

import type { BotApi } from '#/api/bot';
import type { BotNapcatApi } from '#/api/bot/napcat';

import { defineComponent, ref, watch } from 'vue';

import { Drawer, Spin, Tag } from 'antdv-next';

import { getBotNapcatRuntimeDetail } from '#/api/bot/napcat';

import { getBotStatusColor, getBotStatusLabel } from '../../modules/status';

const ADrawer = Drawer as any;
const ASpin = Spin as any;

export default defineComponent({
  name: 'NapcatRuntimeProfileDrawer',
  props: {
    account: {
      default: undefined,
      type: Object as PropType<BotApi.Account | undefined>,
    },
    open: {
      default: false,
      type: Boolean,
    },
  },
  emits: ['close', 'update:open'],
  setup(props, { emit }) {
    const detail = ref<BotNapcatApi.RuntimeProfileDetail>();
    const loading = ref(false);

    watch(
      () => [props.open, props.account?.id] as const,
      () => {
        if (props.open && props.account?.id) void loadDetail();
      },
      { immediate: true },
    );

    /**
     * 账号存在时加载 NapCat 运行态详情，并在请求期间维护抽屉加载态。
     */
    async function loadDetail() {
      if (!props.account?.id) return;
      loading.value = true;
      try {
        detail.value = await getBotNapcatRuntimeDetail(props.account.id);
      } finally {
        loading.value = false;
      }
    }

    /**
     * 向父组件同步抽屉关闭状态并派发 close 事件。
     */
    function closeDrawer() {
      emit('update:open', false);
      emit('close');
    }

    const renderField = (label: string, value: unknown) => {
      return (
        <div class="grid grid-cols-[120px_1fr] gap-3 border-b border-solid border-border py-2 text-sm">
          <span class="text-muted-foreground">{label}</span>
          <span class="break-all text-foreground">{formatValue(value)}</span>
        </div>
      );
    };

    const renderJsonBlock = (title: string, value: unknown) => {
      if (!value) return null;
      return (
        <section class="mt-4">
          <h3 class="mb-2 text-sm font-medium">{title}</h3>
          <pre class="max-h-72 overflow-auto rounded border border-border bg-muted p-3 text-xs text-foreground">
            {JSON.stringify(value, null, 2)}
          </pre>
        </section>
      );
    };

    /**
     * 把运行态字段转换为可展示文本，对象序列化为 JSON，空值显示短横线。
     *
     * @param value - 运行态字段的原始值；空值统一显示占位符。
     * @returns 可直接展示的运行态文本；null、undefined 与空字符串统一返回占位符。
     */
    function formatValue(value: unknown) {
      if (value === undefined || value === null || value === '') return '-';
      if (typeof value === 'object') return JSON.stringify(value);
      return `${value}`;
    }

    const renderSummary = () => {
      const napcat = props.account?.napcat;
      const runtimeProfile =
        (detail.value?.runtimeProfile as Record<string, unknown> | undefined) ||
        napcat?.runtimeProfile;
      return (
        <div>
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <Tag color={getBotStatusColor(napcat?.profileStatus)}>
              Profile {getBotStatusLabel(napcat?.profileStatus)}
            </Tag>
            <Tag color={getBotStatusColor(napcat?.riskMode)}>
              风险 {getBotStatusLabel(napcat?.riskMode)}
            </Tag>
          </div>
          {renderField('账号', props.account?.selfId)}
          {renderField('镜像', runtimeProfile?.imageRef)}
          {renderField('Locale', runtimeProfile?.locale)}
          {renderField('SHM', runtimeProfile?.shmSize)}
          {renderField('检查超时', detail.value?.inspectionTimeoutMs)}
        </div>
      );
    };

    return () => (
      <ADrawer
        onClose={closeDrawer}
        open={props.open}
        size="large"
        title="NapCat 运行态证据"
      >
        <ASpin spinning={loading.value}>
          {renderSummary()}
          {renderJsonBlock('Runtime Profile', detail.value?.runtimeProfile)}
          {renderJsonBlock('Protocol Profile', detail.value?.protocolProfile)}
          {renderJsonBlock(
            'Session Behavior',
            detail.value?.sessionBehaviorProfile,
          )}
          {renderJsonBlock('Risk Mode', detail.value?.riskMode)}
          {renderJsonBlock('Login Events', detail.value?.loginEvents)}
        </ASpin>
      </ADrawer>
    );
  },
});
