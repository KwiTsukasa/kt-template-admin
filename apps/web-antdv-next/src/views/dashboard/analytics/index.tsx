import type {
  EnvironmentDashboard,
  EnvironmentEvent,
  EnvironmentHealthStatus,
  EnvironmentNode,
  EnvironmentService,
  EnvironmentSignal,
  EnvironmentSite,
} from './types';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';

import { Drawer, Empty, Select } from 'antdv-next';

import {
  getEnvironmentDashboard,
  runEnvironmentSelfCheck,
} from '#/api/system/environment';

import EnvironmentEventStream from './components/EnvironmentEventStream.vue';
import EnvironmentEvidencePanel from './components/EnvironmentEvidencePanel.vue';
import EnvironmentStatusBar from './components/EnvironmentStatusBar.vue';
import EnvironmentTopology from './components/EnvironmentTopology.vue';
import { useEnvironmentDashboardStream } from './composables/useEnvironmentDashboardStream';

import './index.scss';

type SnapshotLoadReason = 'initial' | 'manual' | 'snapshot-required';
const ADrawer = Drawer as any;
const ASelect = Select as any;

export default defineComponent({
  name: 'DashboardAnalytics',
  setup() {
    const dashboard = ref<EnvironmentDashboard>();
    const errorText = ref('');
    const loading = ref(false);
    const filterSiteId = ref('');
    const recentEvents = ref<EnvironmentEvent[]>([]);
    const selectedServiceId = ref<string>();
    const selectedSignalId = ref<string>();
    const selectedSiteId = ref<string>();
    const selfChecking = ref(false);
    const snapshotRequestInFlight = ref(false);
    const detailOpen = ref(false);

    const selectedSite = computed(resolveSelectedSite);
    const selectedService = computed(resolveSelectedService);
    const selectedSignal = computed(resolveSelectedSignal);
    const sortedEvents = computed(resolveSortedEvents);
    const visibleSites = computed(() => {
      const sites = dashboard.value?.sites ?? [];
      if (!filterSiteId.value) return sites;
      return sites.filter((site) => site.id === filterSiteId.value);
    });
    const scopeLabel = computed(() => {
      if (filterSiteId.value) return '当前环境';
      return '全部环境';
    });
    const siteMetrics = computed(() => {
      if (!dashboard.value)
        return [
          ['节点', '—'],
          ['服务', '—'],
          ['正常信号', '—'],
          ['待关注信号', '—'],
        ];
      const nodes = visibleSites.value.flatMap((site) => site.nodes);
      const services = nodes.flatMap((node) => node.services);
      const signals = services.flatMap((service) => service.signals);
      return [
        ['节点', nodes.length],
        ['服务', services.length],
        ['正常信号', signals.filter((signal) => signal.status === 'ok').length],
        [
          '待关注信号',
          signals.filter((signal) => signal.status !== 'ok').length,
        ],
      ];
    });
    const siteEvents = computed(() => {
      if (!filterSiteId.value) return sortedEvents.value;
      return sortedEvents.value.filter(
        (event) => event.siteId === filterSiteId.value,
      );
    });
    const environmentStream = useEnvironmentDashboardStream({
      onEnvironmentEvent: handleEnvironmentEvent,
      onEnvironmentSignal: handleEnvironmentSignal,
      onError: handleStreamError,
      onSnapshotRequired: handleSnapshotRequired,
    });
    const streamState = environmentStream.connectionState;

    onMounted(handleMounted);
    onBeforeUnmount(handleBeforeUnmount);

    /**
     * 当页面挂载后触发环境总览首次快照加载。
     */
    function handleMounted() {
      void loadDashboardSnapshot('initial');
    }

    /**
     * 当页面卸载前关闭环境事件流，释放持续连接。
     */
    function handleBeforeUnmount() {
      environmentStream.close();
    }

    /**
     * 当用户手动刷新时，以明确原因重新加载环境总览快照。
     */
    function handleManualRefresh() {
      void loadDashboardSnapshot('manual');
    }

    /**
     * 执行环境自检并用结果替换总览快照，失败时展示错误且始终恢复按钮加载态。
     */
    async function handleSelfCheck() {
      selfChecking.value = true;
      errorText.value = '';
      try {
        applyDashboard(await runEnvironmentSelfCheck());
      } catch (error) {
        errorText.value = getErrorMessage(error);
      } finally {
        selfChecking.value = false;
      }
    }

    /**
     * 加载环境总览快照并更新页面；初次成功后启动事件流，快照补偿请求会合并并发执行。
     *
     * @param reason - 触发本次刷新或状态变化的原因标识。
     */
    async function loadDashboardSnapshot(reason: SnapshotLoadReason) {
      if (reason === 'snapshot-required') {
        if (snapshotRequestInFlight.value) return;
        snapshotRequestInFlight.value = true;
      }
      loading.value = reason !== 'snapshot-required';
      errorText.value = '';
      try {
        applyDashboard(await getEnvironmentDashboard());
        if (reason === 'initial') {
          environmentStream.start();
        }
      } catch (error) {
        errorText.value = getErrorMessage(error);
      } finally {
        loading.value = false;
        if (reason === 'snapshot-required') {
          snapshotRequestInFlight.value = false;
        }
      }
    }

    /**
     * 把完整环境快照写入页面、复制最近事件，并修正当前站点与服务选择。
     *
     * @param next - 后端返回、即将替换页面状态的完整环境快照。
     */
    function applyDashboard(next: EnvironmentDashboard) {
      dashboard.value = next;
      recentEvents.value = [...(next.events ?? [])];
      ensureSelection(next);
    }

    /**
     * 保留有效的筛选范围和详情归属；筛选环境消失时回到全部，详情服务消失时关闭抽屉。
     * @param next - 用来校验筛选范围及详情身份的最新环境快照。
     */
    function ensureSelection(next: EnvironmentDashboard) {
      if (
        filterSiteId.value &&
        !next.sites.some((site) => site.id === filterSiteId.value)
      ) {
        filterSiteId.value = '';
      }
      const site = next.sites.find((item) => item.id === selectedSiteId.value);
      const service = findService(site, selectedServiceId.value);
      if (service) {
        selectedSignalId.value =
          findSignal(service, selectedSignalId.value)?.id ??
          service.signals[0]?.id;
        return;
      }
      detailOpen.value = false;
      selectedSiteId.value = undefined;
      selectedServiceId.value = undefined;
      selectedSignalId.value = undefined;
    }

    /**
     * 切换展示范围并关闭服务详情，空标识表示显示全部环境。
     * @param siteId - 用户选择的环境标识；空字符串表示全部环境。
     */
    function handleSiteSelect(siteId: string) {
      filterSiteId.value = siteId;
      detailOpen.value = false;
      selectedSiteId.value = undefined;
      selectedServiceId.value = undefined;
      selectedSignalId.value = undefined;
    }

    /**
     * 使用环境与服务的组合身份打开证据，避免不同环境中的同名服务相互覆盖。
     * @param siteId - 被点击服务所属的环境标识。
     * @param serviceId - 在该环境内定位服务的唯一标识。
     */
    function handleServiceSelect(siteId: string, serviceId: string) {
      const site = dashboard.value?.sites.find((item) => item.id === siteId);
      const service = findService(site, serviceId);
      selectedSiteId.value = site?.id;
      selectedServiceId.value = service?.id;
      selectedSignalId.value = service?.signals[0]?.id;
      detailOpen.value = Boolean(service);
    }

    /**
     * 把环境业务事件加入最近事件列表。
     *
     * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
     */
    function handleEnvironmentEvent(event: EnvironmentEvent) {
      addRecentEvent(event);
    }

    /**
     * 记录环境信号事件，并把信号变化合并到当前快照。
     *
     * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
     */
    function handleEnvironmentSignal(event: EnvironmentEvent) {
      addRecentEvent(event);
      applySignalEvent(event);
    }

    /**
     * 记录快照补偿事件，并触发合并并发的完整快照加载。
     *
     * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
     */
    function handleSnapshotRequired(event: EnvironmentEvent) {
      addRecentEvent(event);
      void loadDashboardSnapshot('snapshot-required');
    }

    /**
     * 记录事件流错误，并把事件摘要展示为页面错误文本。
     *
     * @param event - SSE 监听器接收到、需要解析或应用的原始消息事件。
     */
    function handleStreamError(event: EnvironmentEvent) {
      addRecentEvent(event);
      errorText.value = event.summary;
    }

    /**
     * 仅在事件可定位到节点和服务时更新信号、服务、节点与站点健康状态。
     *
     * @param event - 包含站点、服务、信号、严重度和观测时间的环境信号事件。
     */
    function applySignalEvent(event: EnvironmentEvent) {
      const site = dashboard.value?.sites.find(
        (item) => item.id === event.siteId,
      );
      if (!site || !event.serviceId) return;
      const node = findNodeByServiceId(site, event.serviceId);
      const service = (() => {
        if (node) {
          return findServiceInNode(node, event.serviceId);
        }
        return undefined;
      })();
      if (!node || !service) return;

      service.status = event.severity;
      service.summary = event.summary;
      const signal = (() => {
        if (event.signalId) {
          return findSignal(service, event.signalId);
        }
        return service.signals[0];
      })();
      if (signal) {
        signal.status = event.severity;
        signal.summary = event.summary;
        signal.observedAt = event.observedAt;
        signal.sourceKind = mapEventSourceToSignalSource(event.sourceKind);
        if (event.evidence) {
          signal.evidence = event.evidence;
        }
      }
      node.status = pickWorstHealthStatus(
        node.services.map((item) => item.status),
      );
      site.status = mapSiteStatus(site.nodes.map((item) => item.status));
    }

    /**
     * 把新的环境事件插入列表头部，并截断为页面允许的最近记录数。
     *
     * @param event - 要插入最近事件列表头部的环境事件。
     */
    function addRecentEvent(event: EnvironmentEvent) {
      recentEvents.value = [
        event,
        ...recentEvents.value.filter((item) => item.eventId !== event.eventId),
      ].slice(0, 30);
    }

    /**
     * 按当前站点标识从环境快照中查找选中站点，快照未加载时返回 undefined。
     *
     * @returns 已选详情所属的环境；未选服务或环境消失时返回 undefined。
     */
    function resolveSelectedSite() {
      return dashboard.value?.sites.find(
        (site) => site.id === selectedSiteId.value,
      );
    }

    /**
     * 按当前站点与服务标识查找选中服务，任一条件缺失时返回 undefined。
     *
     * @returns 已选详情环境内的服务；未命中时返回 undefined。
     */
    function resolveSelectedService() {
      return findService(selectedSite.value, selectedServiceId.value);
    }

    /**
     * 按当前服务与信号标识查找选中信号，任一条件缺失时返回 undefined。
     *
     * @returns 已选服务内的信号；未命中时返回 undefined。
     */
    function resolveSelectedSignal() {
      return findSignal(selectedService.value, selectedSignalId.value);
    }

    /**
     * 复制最近事件并按观测时间倒序排列，不修改原始响应式数组。
     *
     * @returns 按观测时间倒序排列的环境事件副本。
     */
    function resolveSortedEvents() {
      return recentEvents.value.toSorted(
        (left, right) =>
          Date.parse(right.observedAt) - Date.parse(left.observedAt),
      );
    }

    /**
     * 从站点直属服务和各节点服务中按标识查找，直属记录优先。
     *
     * @param site - 环境总览中当前查询的站点记录。
     * @param serviceId - 用于在站点或节点内定位服务的唯一标识。
     * @returns 站点直属或节点内与标识匹配的服务；未命中时返回 undefined。
     */
    function findService(site?: EnvironmentSite, serviceId?: string) {
      if (!site || !serviceId) return undefined;
      for (const node of site.nodes) {
        const service = findServiceInNode(node, serviceId);
        if (service) return service;
      }
      return undefined;
    }

    /**
     * 从指定节点的服务集合中按标识查找目标记录。
     *
     * @param node - 当前搜索或渲染的树节点。
     * @param serviceId - 用于在站点或节点内定位服务的唯一标识。
     * @returns 指定节点内与服务标识匹配的记录；未命中时返回 undefined。
     */
    function findServiceInNode(node: EnvironmentNode, serviceId: string) {
      return node.services.find((service) => service.id === serviceId);
    }

    /**
     * 从站点节点中查找包含目标服务的节点，找不到时返回 undefined。
     *
     * @param site - 环境总览中当前查询的站点记录。
     * @param serviceId - 用于在站点或节点内定位服务的唯一标识。
     * @returns 包含目标服务的节点；未命中时返回 undefined。
     */
    function findNodeByServiceId(site: EnvironmentSite, serviceId: string) {
      return site.nodes.find((node) =>
        node.services.some((service) => service.id === serviceId),
      );
    }

    /**
     * 从服务信号集合中按标识查找记录，找不到时返回 undefined。
     *
     * @param service - 当前环境节点中需要检查或展示的服务记录。
     * @param signalId - 用于在服务内定位观测信号的唯一标识。
     * @returns 服务内与信号标识匹配的记录；未命中时返回 undefined。
     */
    function findSignal(service?: EnvironmentService, signalId?: string) {
      if (!service || !signalId) return undefined;
      return service.signals.find((signal) => signal.id === signalId);
    }

    /**
     * 把 MQTT 与本地环境事件归并为实时信号来源，其他来源类型保持不变。
     *
     * @param sourceKind - 媒体治理来源的类型标识。
     * @returns 用于信号更新的来源类型；MQTT 与本地来源统一为 `live`。
     */
    function mapEventSourceToSignalSource(
      sourceKind: EnvironmentEvent['sourceKind'],
    ): EnvironmentSignal['sourceKind'] {
      if (sourceKind === 'mqtt' || sourceKind === 'local') return 'live';
      return sourceKind;
    }

    /**
     * 根据健康等级比较两个状态，返回故障程度更高的一个。
     *
     * @param statuses - 用于比较并选出最差健康等级的状态集合。
     * @returns 两个输入中故障等级更高的健康状态。
     */
    function pickWorstHealthStatus(
      statuses: EnvironmentHealthStatus[],
    ): EnvironmentHealthStatus {
      const weights: Record<EnvironmentHealthStatus, number> = {
        blocked: 5,
        degraded: 2,
        down: 4,
        isolated: 3,
        ok: 0,
        unknown: 1,
        unwired: 1,
      };
      let worst: EnvironmentHealthStatus = 'ok';
      for (const status of statuses) {
        if (weights[status] > weights[worst]) {
          worst = status;
        }
      }
      return worst;
    }

    /**
     * 把站点内最差健康状态归并为在线、隔离、降级或未知展示状态。
     *
     * @param statuses - 用于比较并选出最差健康等级的状态集合。
     * @returns 站点展示状态；无可识别健康状态时为 `unknown`。
     */
    function mapSiteStatus(statuses: EnvironmentHealthStatus[]) {
      const worst = pickWorstHealthStatus(statuses);
      if (worst === 'ok') return 'online';
      if (worst === 'isolated') return 'isolated';
      if (worst === 'degraded' || worst === 'down' || worst === 'blocked') {
        return 'degraded';
      }
      return 'unknown';
    }

    /**
     * 从字符串或 Error 对象提取非空消息，无法识别时返回调用方提供的兜底文本。
     *
     * @param error - 可能为 Error、字符串或携带 err、message、msg 字段的异常值。
     * @returns 可展示的错误文本；无法识别输入时回退为“环境总览请求失败”。
     */
    function getErrorMessage(error: unknown) {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object') {
        const record = error as Record<string, unknown>;
        return `${record.err || record.message || record.msg || '环境总览请求失败'}`;
      }
      return '环境总览请求失败';
    }

    /**
     * 首次读取时显示进度，取得快照后同时展示节点服务与站点事件。
     * @returns 初次加载提示、未取得快照提示或完整站点工作台。
     */
    function renderWorkspace() {
      if (!dashboard.value && loading.value)
        return <p role="status">正在读取环境快照…</p>;
      if (!dashboard.value)
        return <p role="status">尚未取得环境快照，请刷新重试。</p>;
      return (
        <div class="environment-dashboard-page__workspace">
          <section class="environment-dashboard-page__group">
            <div class="environment-dashboard-page__sites">
              {visibleSites.value.map((site) => {
                let selectedForSite: string | undefined;
                if (site.id === selectedSiteId.value)
                  selectedForSite = selectedServiceId.value;
                return (
                  <EnvironmentTopology
                    key={site.id}
                    onSelectService={(serviceId: string) =>
                      handleServiceSelect(site.id, serviceId)
                    }
                    selectedServiceId={selectedForSite}
                    site={site}
                  />
                );
              })}
              {visibleSites.value.length === 0 && (
                <Empty description="所选范围暂无环境数据" />
              )}
            </div>
          </section>
          <aside class="environment-dashboard-page__panel">
            <EnvironmentEventStream events={siteEvents.value} />
          </aside>
        </div>
      );
    }

    return () => (
      <div class="environment-dashboard-page">
        <EnvironmentStatusBar
          dashboard={dashboard.value}
          errorText={errorText.value}
          loading={loading.value}
          onRefresh={handleManualRefresh}
          onSelfCheck={handleSelfCheck}
          selfChecking={selfChecking.value}
          streamState={streamState.value}
        >
          <ASelect
            aria-label="站点"
            class="environment-dashboard-page__site"
            onChange={handleSiteSelect}
            options={[
              { label: '全部环境', value: '' },
              ...(dashboard.value?.sites ?? []).map((site) => ({
                label: site.label,
                value: site.id,
              })),
            ]}
            placeholder="选择环境"
            value={filterSiteId.value}
          />
        </EnvironmentStatusBar>
        <section
          aria-label={`${scopeLabel.value}概览`}
          class="environment-dashboard-page__metrics"
        >
          {siteMetrics.value.map(([label, value]) => (
            <article
              class="environment-dashboard-page__metric"
              key={String(label)}
            >
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{scopeLabel.value}</small>
            </article>
          ))}
        </section>
        {renderWorkspace()}
        <ADrawer
          onUpdate:open={(open: boolean) => {
            detailOpen.value = open;
          }}
          open={detailOpen.value}
          size={560}
          title={selectedService.value?.label ?? '服务详情'}
        >
          <EnvironmentEvidencePanel
            loading={loading.value}
            onRefresh={handleManualRefresh}
            onSelectSignal={(signalId: string) => {
              selectedSignalId.value = signalId;
            }}
            onSelfCheck={handleSelfCheck}
            selectedService={selectedService.value}
            selectedSignal={selectedSignal.value}
            selectedSite={selectedSite.value}
            selfChecking={selfChecking.value}
          />
        </ADrawer>
      </div>
    );
  },
});
