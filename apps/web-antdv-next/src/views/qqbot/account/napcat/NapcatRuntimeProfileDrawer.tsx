import type { PropType } from 'vue';

import type { QqbotApi } from '#/api/qqbot';
import type { QqbotNapcatApi } from '#/api/qqbot/napcat';

import { defineComponent, ref, watch } from 'vue';

import { Drawer, Spin, Tag } from 'antdv-next';

import { getQqbotNapcatRuntimeDetail } from '#/api/qqbot/napcat';

import { getQqbotStatusColor, getQqbotStatusLabel } from '../../modules/status';

const ADrawer = Drawer as any;
const ASpin = Spin as any;

export default defineComponent({
  name: 'NapcatRuntimeProfileDrawer',
  props: {
    account: {
      default: undefined,
      type: Object as PropType<QqbotApi.Account | undefined>,
    },
    open: {
      default: false,
      type: Boolean,
    },
  },
  emits: ['close', 'update:open'],
  setup(props, { emit }) {
    const detail = ref<QqbotNapcatApi.RuntimeProfileDetail>();
    const loading = ref(false);

    watch(
      () => [props.open, props.account?.id] as const,
      () => {
        if (props.open && props.account?.id) void loadDetail();
      },
      { immediate: true },
    );

    /**
     * Loads sanitized runtime profile evidence for the selected account.
     */
    async function loadDetail() {
      if (!props.account?.id) return;
      loading.value = true;
      try {
        detail.value = await getQqbotNapcatRuntimeDetail(props.account.id);
      } finally {
        loading.value = false;
      }
    }

    /**
     * Emits both drawer close contracts used by existing QQBot views.
     */
    function closeDrawer() {
      emit('update:open', false);
      emit('close');
    }

    /**
     * Renders compact key/value evidence rows without exposing interactive controls.
     * @param label - Human readable field label.
     * @param value - Runtime evidence value already sanitized by the API.
     */
    const renderField = (label: string, value: unknown) => {
      return (
        <div class="grid grid-cols-[120px_1fr] gap-3 border-b border-solid border-border py-2 text-sm">
          <span class="text-muted-foreground">{label}</span>
          <span class="break-all text-foreground">{formatValue(value)}</span>
        </div>
      );
    };

    /**
     * Renders a JSON evidence block for profile sections.
     * @param title - Section title shown above the evidence block.
     * @param value - Sanitized profile object returned by the API.
     */
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
     * Converts scalar runtime evidence into stable display text.
     * @param value - Sanitized value from profile detail.
     * @returns Display text for compact rows.
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
            <Tag color={getQqbotStatusColor(napcat?.profileStatus)}>
              Profile {getQqbotStatusLabel(napcat?.profileStatus)}
            </Tag>
            <Tag color={getQqbotStatusColor(napcat?.riskMode)}>
              风险 {getQqbotStatusLabel(napcat?.riskMode)}
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
