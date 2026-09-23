import type { PropType } from 'vue';

import type { BotApi } from '#/api/bot';
import type { BotNapcatApi } from '#/api/bot/napcat';

import {
  defineComponent,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from 'vue';

import { Alert, Button, Drawer, Spin, Tag } from 'antdv-next';

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
    const error = ref('');
    let readRevision = 0;
    let disposed = false;

    watch(
      () => [props.open, props.account?.id] as const,
      () => {
        if (props.open && props.account?.id) {
          void loadDetail();
        } else {
          invalidateDetail();
        }
      },
      { immediate: true },
    );

    onDeactivated(() => {
      invalidateDetail();
    });
    onBeforeUnmount(() => {
      disposed = true;
      invalidateDetail();
    });

    /**
     * 关闭或切换账号时撤销旧详情的展示资格，避免迟到结果与新账号拼接。
     */
    function invalidateDetail() {
      readRevision += 1;
      detail.value = undefined;
      loading.value = false;
      error.value = '';
    }

    /**
     * 固定当前账号和读取轮次；仅响应账号一致且抽屉仍可见时采用详情。
     */
    async function loadDetail() {
      const accountId = props.account?.id;
      if (!props.open || !accountId || disposed) return;
      const revision = ++readRevision;
      detail.value = undefined;
      error.value = '';
      loading.value = true;
      try {
        const result = await getBotNapcatRuntimeDetail(accountId);
        if (!isCurrentDetail(accountId, revision)) return;
        if (result.accountId !== accountId) {
          error.value = '返回账号不匹配，运行态详情未确认';
          return;
        }
        detail.value = result;
      } catch {
        if (isCurrentDetail(accountId, revision)) {
          error.value = '运行态详情读取失败';
        }
      } finally {
        if (isCurrentDetail(accountId, revision)) loading.value = false;
      }
    }

    /**
     * 仅允许当前可见账号的最新读取更新详情，卸载后的结果全部拒绝。
     * @param accountId - 请求发出时固定的账号 id。
     * @param revision - 请求发出时的读取轮次。
     * @returns 账号、可见状态和轮次仍相同才返回 true。
     */
    function isCurrentDetail(accountId: string, revision: number) {
      return (
        !disposed &&
        props.open &&
        props.account?.id === accountId &&
        readRevision === revision
      );
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
          <pre class="whitespace-pre-wrap break-all rounded border border-border bg-muted p-3 text-xs text-foreground">
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

    /**
     * 只从本次已确认详情映射 Profile 同步状态，未读取或未知原值保持未知。
     * @returns 与 Inspector 的 synced、drifted、failed 映射一致的展示状态。
     */
    function getDetailProfileStatus() {
      const status = detail.value?.runtimeProfile?.profileStatus;
      if (status === 'synced') return 'ok';
      if (status === 'drifted') return 'drift';
      if (status === 'failed') return 'failed';
      return 'unknown';
    }

    /**
     * 只展示本次详情明确提供的风险模式，列表旧值不能充当当前读取结果。
     * @returns 当前详情的受支持风险模式；未提供或未知时为 unknown。
     */
    function getDetailRiskMode() {
      const mode = detail.value?.riskMode?.riskMode;
      if (mode === 'normal' || mode === 'cooldown' || mode === 'manual_only') {
        return mode;
      }
      return 'unknown';
    }

    const renderSummary = () => {
      const profileStatus = getDetailProfileStatus();
      const riskMode = getDetailRiskMode();
      const runtimeProfile = detail.value?.runtimeProfile;
      let timeoutText = '-';
      if (detail.value?.inspectionTimeoutMs !== undefined) {
        timeoutText = `${detail.value.inspectionTimeoutMs} ms`;
      }
      return (
        <div>
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <Tag color={getBotStatusColor(profileStatus)}>
              {`Profile ${getBotStatusLabel(profileStatus)}`}
            </Tag>
            <Tag color={getBotStatusColor(riskMode)}>
              {`风险 ${getBotStatusLabel(riskMode)}`}
            </Tag>
          </div>
          {renderField('账号', props.account?.selfId)}
          {renderField('镜像', runtimeProfile?.imageRef)}
          {renderField('Locale', runtimeProfile?.locale)}
          {renderField('SHM', runtimeProfile?.shmSize)}
          {renderField('检查超时', timeoutText)}
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
          {error.value && (
            <div class="mt-3 flex items-center gap-2">
              <Alert
                class="min-w-0 flex-1"
                showIcon
                title={error.value}
                type="error"
              />
              <Button onClick={() => void loadDetail()} size="small">
                重试
              </Button>
            </div>
          )}
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
