import type { VNodeChild } from 'vue';

import type { LlmConfigDrawerExposed } from './components/LlmConfigDrawer';

import type { LlmApi } from '#/api/llm';
import type { KtActionGroupItem } from '#/components/kt-table';

import { computed, defineComponent, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import { EyeOutlined, MessageOutlined } from '@antdv-next/icons';
import {
  Button,
  Card,
  Input,
  message,
  Modal,
  Pagination,
  Select,
  Space,
  Tag,
  Tooltip,
} from 'antdv-next';

import {
  deleteLlmConfig,
  getLlmConfigs,
  getLlmConfigSummary,
  getLlmProviders,
  setDefaultLlmConfig,
  setLlmConfigEnabled,
  testLlmConfig,
} from '#/api/llm';
import { KtCardList, KtCardListCard } from '#/components/kt-card-list';
import { KtActionGroup } from '#/components/kt-table';

import LlmConfigDrawer from './components/LlmConfigDrawer';

import './index.scss';

const AButton = Button as any;
const ACard = Card as any;
const AKtCardList = KtCardList as any;
const AKtCardListCard = KtCardListCard as any;
const AInput = Input as any;
const AKtActionGroup = KtActionGroup as any;
const APagination = Pagination as any;
const ASelect = Select as any;
const ASpace = Space as any;
const ATag = Tag as any;
const ATooltip = Tooltip as any;

const EMPTY_SUMMARY: LlmApi.ConfigSummary = {
  connected: 0,
  disabled: 0,
  error: 0,
  total: 0,
};

const STATUS_OPTIONS = [
  { label: '已连接', value: 'connected' },
  { label: '连接异常', value: 'error' },
  { label: '未测试', value: 'untested' },
  { label: '已停用', value: 'disabled' },
];

export default defineComponent({
  name: 'LlmConfigBoard',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const router = useRouter();
    const drawer = ref<LlmConfigDrawerExposed>();
    const items = ref<LlmApi.Config[]>([]);
    const keyword = ref('');
    const loading = ref(true);
    const pageNo = ref(1);
    const pageSize = ref(20);
    const provider = ref<LlmApi.Provider>();
    const providers = ref<LlmApi.ProviderCatalogItem[]>([]);
    const status = ref<LlmApi.ConnectionStatus>();
    const summary = ref<LlmApi.ConfigSummary>({ ...EMPTY_SUMMARY });
    const total = ref(0);
    const canCreate = computed(() => hasAccessByCodes(['Llm:Config:Create']));

    /**
     * 并行加载连接分页与顶部状态汇总。
     */
    async function load() {
      loading.value = true;
      try {
        const [page, nextSummary] = await Promise.all([
          getLlmConfigs({
            keyword: keyword.value || undefined,
            pageNo: pageNo.value,
            pageSize: pageSize.value,
            provider: provider.value,
            status: status.value,
          }),
          getLlmConfigSummary(),
        ]);
        items.value = page.items ?? page.list ?? [];
        total.value = page.total;
        summary.value = nextSummary;
      } finally {
        loading.value = false;
      }
    }

    /**
     * 清空连接筛选并回到第一页重新加载。
     */
    function resetFilters() {
      keyword.value = '';
      provider.value = undefined;
      status.value = undefined;
      pageNo.value = 1;
      void load();
    }

    /**
     * 从配置卡进入绑定该连接的流式对话页。
     * @param config - 用户选择的连接配置。
     */
    function openChat(config: LlmApi.Config) {
      void router.push({
        name: 'LlmChat',
        params: { configId: config.id },
        query: { pageKey: `llm-chat-${config.id}` },
      });
    }

    /**
     * 测试目标连接的真实流式首包并刷新卡片状态。
     * @param config - 需要测试的连接配置。
     */
    async function testConnection(config: LlmApi.Config) {
      const result = await testLlmConfig(config.id);
      message.success(`连接成功，首 Token ${result.firstTokenLatencyMs} ms`);
      await load();
    }

    /**
     * 把目标连接设为全局默认项并刷新看板。
     * @param config - 需要设为默认的连接配置。
     */
    async function makeDefault(config: LlmApi.Config) {
      await setDefaultLlmConfig(config.id);
      message.success('默认大模型连接已更新');
      await load();
    }

    /**
     * 切换连接启用状态并刷新看板。
     * @param config - 需要启用或停用的连接配置。
     */
    async function toggleEnabled(config: LlmApi.Config) {
      await setLlmConfigEnabled(config.id, !config.enabled);
      let successMessage = '连接已启用';
      if (config.enabled) successMessage = '连接已停用';
      message.success(successMessage);
      await load();
    }

    /**
     * 把软删除限制在用户二次确认的 onOk 路径，取消时不触发请求。
     * @param config - 需要软删除的连接配置。
     */
    function confirmDelete(config: LlmApi.Config) {
      Modal.confirm({
        cancelText: '取消',
        content: `删除连接“${config.name}”后，配置看板不再显示它；历史对话审计数据仍保留。`,
        okText: '确认删除',
        okType: 'danger',
        onOk: async () => {
          await deleteLlmConfig(config.id);
          message.success('大模型连接已删除');
          await load();
        },
        title: '删除大模型连接',
      });
    }

    /**
     * 把互斥连接状态计数投影为固定四列标签与色调。
     * @returns 与设计稿一致的四列状态摘要。
     */
    function renderSummary() {
      const cards = [
        { label: '全部配置', tone: 'blue', value: summary.value.total },
        { label: '已连接', tone: 'green', value: summary.value.connected },
        { label: '连接异常', tone: 'orange', value: summary.value.error },
        { label: '已停用', tone: 'default', value: summary.value.disabled },
      ];
      return (
        <div class="llm-config-summary">
          {cards.map((card) => (
            <ACard key={card.label} size="small">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm text-muted-foreground">{card.label}</span>
                <ATag color={card.tone}>{card.value}</ATag>
              </div>
            </ACard>
          ))}
        </div>
      );
    }

    /**
     * 渲染单张连接卡片，整卡打开详情，操作区阻止冒泡。
     * @param config - 当前连接配置。
     * @returns 源码同构的可访问卡片。
     */
    function renderCard(config: LlmApi.Config) {
      const statusView = connectionStatusView(config.connectionStatus);
      const actionGroup = createCardActions(config, {
        canChat: hasAccessByCodes(['Llm:Chat:Use']),
        canDelete: hasAccessByCodes(['Llm:Config:Delete']),
        canTest: hasAccessByCodes(['Llm:Config:Test']),
        canToggle: hasAccessByCodes(['Llm:Config:Toggle']),
        canUpdate: hasAccessByCodes(['Llm:Config:Update']),
        confirmDelete,
        makeDefault,
        openChat,
        openEdit: (row) => drawer.value?.openEdit(row),
        openView: (row) => drawer.value?.openView(row),
        testConnection,
        toggleEnabled,
      });
      return (
        <AKtCardListCard
          class={[
            'llm-config-card',
            { 'llm-config-card--default': config.isDefault },
          ]}
          hoverable
          key={config.id}
          onClick={() => drawer.value?.openView(config)}
          onKeydown={(event: KeyboardEvent) => {
            if (event.key === 'Enter') drawer.value?.openView(config);
          }}
          role="button"
          tabindex={0}
          v-slots={{
            actions: () => (
              <AKtActionGroup
                items={actionGroup.items}
                layout="balanced"
                moreLabel="更多"
                moreTrigger="hover"
                size="small"
                visibleCount={actionGroup.visibleCount}
              />
            ),
            default: () => (
              <>
                <div class="flex min-w-0 items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-semibold">
                      {config.providerLabel}
                    </div>
                    <div class="mt-1 truncate text-xs text-muted-foreground">
                      {config.name}
                    </div>
                  </div>
                  <ATag color={statusView.color}>{statusView.label}</ATag>
                </div>
                <div class="grid gap-2 text-sm">
                  <InfoRow label="端点" value={safeEndpoint(config.baseUrl)} />
                  <div class="grid grid-cols-2 gap-4">
                    <InfoBlock
                      label="首 Token"
                      value={latencyLabel(config.firstTokenLatencyMs)}
                    />
                    <InfoBlock
                      label="最近验证"
                      value={timeLabel(config.lastTestedAt)}
                    />
                  </div>
                </div>
              </>
            ),
          }}
        />
      );
    }

    onMounted(async () => {
      providers.value = await getLlmProviders();
      await load();
    });

    return () => {
      let createButton: VNodeChild = null;
      if (canCreate.value) {
        createButton = (
          <AButton onClick={() => drawer.value?.openCreate()} type="primary">
            新增配置
          </AButton>
        );
      }
      const board = (
        <AKtCardList
          emptyDescription="当前筛选条件下没有大模型连接"
          itemCount={items.value.length}
          loading={loading.value}
        >
          {items.value.map((item) => renderCard(item))}
        </AKtCardList>
      );
      return (
        <Page autoContentHeight>
          <div class="llm-config-page">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h1 class="m-0 text-xl font-semibold">大模型配置</h1>
              {createButton}
            </div>
            {renderSummary()}
            <div class="llm-config-filters">
              <AInput
                allowClear
                onChange={(event: { target: { value: string } }) => {
                  keyword.value = event.target.value;
                }}
                onPressEnter={() => {
                  pageNo.value = 1;
                  void load();
                }}
                placeholder="搜索配置名称或端点"
                value={keyword.value}
              />
              <ASelect
                allowClear
                onChange={(value: LlmApi.Provider | undefined) => {
                  provider.value = value;
                }}
                options={providers.value.map((item) => ({
                  label: item.label,
                  value: item.provider,
                }))}
                placeholder="供应商"
                value={provider.value}
              />
              <ASelect
                allowClear
                onChange={(value: LlmApi.ConnectionStatus | undefined) => {
                  status.value = value;
                }}
                options={STATUS_OPTIONS}
                placeholder="连接状态"
                value={status.value}
              />
              <ASpace>
                <AButton
                  loading={loading.value}
                  onClick={() => {
                    pageNo.value = 1;
                    void load();
                  }}
                  type="primary"
                >
                  查询
                </AButton>
                <AButton onClick={resetFilters}>重置</AButton>
              </ASpace>
            </div>
            <div class="llm-config-board-shell">{board}</div>
            <div class="flex justify-end">
              <APagination
                current={pageNo.value}
                onChange={(nextPage: number, nextPageSize: number) => {
                  pageNo.value = nextPage;
                  pageSize.value = nextPageSize;
                  void load();
                }}
                pageSize={pageSize.value}
                showSizeChanger
                total={total.value}
              />
            </div>
          </div>
          <LlmConfigDrawer
            onSaved={() => void load()}
            providers={providers.value}
            ref={drawer}
          />
        </Page>
      );
    };
  },
});

interface CardActionContext {
  canChat: boolean;
  canDelete: boolean;
  canTest: boolean;
  canToggle: boolean;
  canUpdate: boolean;
  confirmDelete: (config: LlmApi.Config) => void;
  makeDefault: (config: LlmApi.Config) => Promise<void>;
  openChat: (config: LlmApi.Config) => void;
  openEdit: (config: LlmApi.Config) => void;
  openView: (config: LlmApi.Config) => void;
  testConnection: (config: LlmApi.Config) => Promise<void>;
  toggleEnabled: (config: LlmApi.Config) => Promise<void>;
}

/**
 * 按权限与连接状态组装纯图标直显动作和文本溢出菜单。
 * @param config - 当前连接配置。
 * @param context - 权限与页面操作回调。
 * @returns KtActionGroup 项及允许直显的语义图标数量。
 */
function createCardActions(config: LlmApi.Config, context: CardActionContext) {
  const inlineItems: KtActionGroupItem[] = [];
  const overflowItems: KtActionGroupItem[] = [];
  if (context.canChat && config.enabled) {
    inlineItems.push(
      iconAction(
        'chat',
        '进入对话',
        () => context.openChat(config),
        <MessageOutlined />,
      ),
    );
  }
  inlineItems.push(
    iconAction(
      'view',
      '查看详情',
      () => context.openView(config),
      <EyeOutlined />,
    ),
  );
  if (context.canUpdate) {
    overflowItems.push(
      textAction('edit', '编辑', () => context.openEdit(config)),
    );
  }
  if (context.canTest && config.enabled) {
    overflowItems.push(
      textAction('test', '测试连接', () => void context.testConnection(config)),
    );
  }
  if (context.canUpdate && config.enabled && !config.isDefault) {
    overflowItems.push(
      textAction('default', '设为默认', () => void context.makeDefault(config)),
    );
  }
  if (context.canToggle) {
    let label = '停用';
    if (!config.enabled) label = '启用';
    overflowItems.push(
      textAction('toggle', label, () => void context.toggleEnabled(config)),
    );
  }
  if (context.canDelete && !config.enabled) {
    overflowItems.push(
      textAction(
        'delete',
        '删除配置',
        () => context.confirmDelete(config),
        true,
      ),
    );
  }
  return {
    items: [...inlineItems, ...overflowItems],
    visibleCount: inlineItems.length,
  };
}

/**
 * 将卡片主操作包装为阻止冒泡的可访问按钮，避免同时打开整卡详情。
 * @param key - 操作稳定键。
 * @param label - Tooltip 与 aria-label 文案。
 * @param onClick - 点击后执行的页面动作。
 * @param icon - Antdv Next 语义图标。
 * @returns 可交给 KtActionGroup 的图标操作项。
 */
function iconAction(
  key: string,
  label: string,
  onClick: () => void,
  icon: VNodeChild,
): KtActionGroupItem {
  return {
    content: (
      <ATooltip title={label}>
        <AButton
          aria-label={label}
          block
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            onClick();
          }}
          size="small"
          type="text"
        >
          {icon}
        </AButton>
      </ATooltip>
    ),
    key,
  };
}

/**
 * 将次要操作固定放入溢出菜单，并按需保留危险操作样式。
 * @param key - 操作稳定键。
 * @param label - 菜单文案。
 * @param onClick - 点击后执行的页面动作。
 * @param danger - 是否使用危险操作样式；省略时为 false。
 * @returns 可交给 KtActionGroup 的溢出操作项。
 */
function textAction(
  key: string,
  label: string,
  onClick: () => void,
  danger = false,
): KtActionGroupItem {
  const content = (
    <AButton
      block
      danger={danger}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onClick();
      }}
      size="small"
      type="text"
    >
      {label}
    </AButton>
  );
  return { content, key, overflowContent: content };
}

/**
 * 把端点事实压缩为左右对齐单行，超长值在右侧截断。
 * @param props - 包含左侧事实名称与右侧安全展示值的卡片事实。
 * @param props.label - 左侧显示的事实名称。
 * @param props.value - 右侧显示并在溢出时截断的安全值。
 * @returns 卡片事实信息行。
 */
function InfoRow(props: { label: string; value: string }) {
  return (
    <div class="flex justify-between gap-3">
      <span class="text-muted-foreground">{props.label}</span>
      <span class="min-w-0 truncate text-right">{props.value}</span>
    </div>
  );
}

/**
 * 把延迟或验证时间投影为标签在上、数值在下的双列指标块。
 * @param props - 包含上方指标名称与下方格式化值的卡片指标。
 * @param props.label - 指标上方显示的名称。
 * @param props.value - 指标下方显示的格式化值。
 * @returns 上标签下值的事实块。
 */
function InfoBlock(props: { label: string; value: string }) {
  return (
    <div class="grid gap-1">
      <span class="text-xs text-muted-foreground">{props.label}</span>
      <span>{props.value}</span>
    </div>
  );
}

/**
 * 将连接状态映射为卡片标签和 Antdv 色调。
 * @param status - API 返回的稳定连接状态。
 * @returns 中文标签和 Tag 色调。
 */
function connectionStatusView(status: LlmApi.ConnectionStatus) {
  if (status === 'connected') return { color: 'success', label: '已连接' };
  if (status === 'error') return { color: 'warning', label: '连接异常' };
  if (status === 'disabled') return { color: 'default', label: '已停用' };
  return { color: 'processing', label: '未测试' };
}

/**
 * 从 Base URL 提取安全主机名，解析失败时回退原始文本。
 * @param value - 连接 Base URL。
 * @returns 不含路径、查询串和凭据的主机名。
 */
function safeEndpoint(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

/**
 * 把首 Token 延迟转换为毫秒文本。
 * @param value - 毫秒数或空值。
 * @returns 有值时返回 `N ms`，否则返回短横线。
 */
function latencyLabel(value?: null | number) {
  if (typeof value !== 'number') return '—';
  return `${value} ms`;
}

/**
 * 把 API 时间文本压缩为卡片最近验证显示。
 * @param value - KT 时间文本或空值。
 * @returns 去除秒后的日期时间；无值时返回短横线。
 */
function timeLabel(value?: null | string) {
  if (!value) return '—';
  return value.slice(0, 16);
}
