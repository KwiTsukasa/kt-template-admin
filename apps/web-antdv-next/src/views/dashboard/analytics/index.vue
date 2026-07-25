<script lang="ts" setup>
import type {
  EnvironmentDashboard,
  EnvironmentEvent,
  EnvironmentHealthStatus,
  EnvironmentNode,
  EnvironmentService,
  EnvironmentSignal,
  EnvironmentSite,
} from './types';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import {
  getEnvironmentDashboard,
  runEnvironmentSelfCheck,
} from '#/api/system/environment';

import EnvironmentEventStream from './components/EnvironmentEventStream.vue';
import EnvironmentEvidencePanel from './components/EnvironmentEvidencePanel.vue';
import EnvironmentSiteRail from './components/EnvironmentSiteRail.vue';
import EnvironmentStatusBar from './components/EnvironmentStatusBar.vue';
import EnvironmentTopology from './components/EnvironmentTopology.vue';
import { useEnvironmentDashboardStream } from './composables/useEnvironmentDashboardStream';

type SnapshotLoadReason = 'initial' | 'manual' | 'snapshot-required';

const dashboard = ref<EnvironmentDashboard>();
const errorText = ref('');
const loading = ref(false);
const recentEvents = ref<EnvironmentEvent[]>([]);
const selectedServiceId = ref<string>();
const selectedSignalId = ref<string>();
const selectedSiteId = ref<string>();
const selfChecking = ref(false);
const snapshotRequestInFlight = ref(false);

const selectedSite = computed(resolveSelectedSite);
const selectedService = computed(resolveSelectedService);
const selectedSignal = computed(resolveSelectedSignal);
const sortedEvents = computed(resolveSortedEvents);

const environmentStream = useEnvironmentDashboardStream({
  onEnvironmentEvent: handleEnvironmentEvent,
  onEnvironmentSignal: handleEnvironmentSignal,
  onError: handleStreamError,
  onSnapshotRequired: handleSnapshotRequired,
});
const streamState = environmentStream.connectionState;

onMounted(handleMounted);
onBeforeUnmount(handleBeforeUnmount);

function handleMounted() {
  void loadDashboardSnapshot('initial');
}

function handleBeforeUnmount() {
  environmentStream.close();
}

function handleManualRefresh() {
  void loadDashboardSnapshot('manual');
}

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

function applyDashboard(next: EnvironmentDashboard) {
  dashboard.value = next;
  recentEvents.value = [...(next.events ?? [])];
  ensureSelection(next);
}

function ensureSelection(next: EnvironmentDashboard) {
  const existingSite = selectedSiteId.value
    ? next.sites.find((site) => site.id === selectedSiteId.value)
    : undefined;
  const existingService = existingSite
    ? findService(existingSite, selectedServiceId.value)
    : undefined;
  if (existingSite && existingService) {
    selectedSignalId.value =
      findSignal(existingService, selectedSignalId.value)?.id ??
      existingService.signals[0]?.id;
    return;
  }

  const preferred = findFirstAttentionService(next.sites);
  const fallbackSite = preferred?.site ?? next.sites[0];
  const fallbackService = preferred?.service ?? getFirstService(fallbackSite);
  selectedSiteId.value = fallbackSite?.id;
  selectedServiceId.value = fallbackService?.id;
  selectedSignalId.value = fallbackService?.signals[0]?.id;
}

function handleSiteSelect(siteId: string) {
  selectedSiteId.value = siteId;
  const site = dashboard.value?.sites.find((item) => item.id === siteId);
  const service = getFirstService(site);
  selectedServiceId.value = service?.id;
  selectedSignalId.value = service?.signals[0]?.id;
}

function handleServiceSelect(serviceId: string) {
  const service = findService(selectedSite.value, serviceId);
  selectedServiceId.value = service?.id;
  selectedSignalId.value = service?.signals[0]?.id;
}

function handleEnvironmentEvent(event: EnvironmentEvent) {
  addRecentEvent(event);
}

function handleEnvironmentSignal(event: EnvironmentEvent) {
  addRecentEvent(event);
  applySignalEvent(event);
}

function handleSnapshotRequired(event: EnvironmentEvent) {
  addRecentEvent(event);
  void loadDashboardSnapshot('snapshot-required');
}

function handleStreamError(event: EnvironmentEvent) {
  addRecentEvent(event);
  errorText.value = event.summary;
}

function applySignalEvent(event: EnvironmentEvent) {
  const site = dashboard.value?.sites.find((item) => item.id === event.siteId);
  if (!site || !event.serviceId) return;
  const node = findNodeByServiceId(site, event.serviceId);
  const service = node ? findServiceInNode(node, event.serviceId) : undefined;
  if (!node || !service) return;

  service.status = event.severity;
  service.summary = event.summary;
  const signal = event.signalId
    ? findSignal(service, event.signalId)
    : service.signals[0];
  if (signal) {
    signal.status = event.severity;
    signal.summary = event.summary;
    signal.observedAt = event.observedAt;
    signal.sourceKind = mapEventSourceToSignalSource(event.sourceKind);
    if (event.evidence) {
      signal.evidence = event.evidence;
    }
  }
  node.status = pickWorstHealthStatus(node.services.map((item) => item.status));
  site.status = mapSiteStatus(site.nodes.map((item) => item.status));
}

function addRecentEvent(event: EnvironmentEvent) {
  recentEvents.value = [
    event,
    ...recentEvents.value.filter((item) => item.eventId !== event.eventId),
  ].slice(0, 30);
}

function resolveSelectedSite() {
  return dashboard.value?.sites.find(
    (site) => site.id === selectedSiteId.value,
  );
}

function resolveSelectedService() {
  return findService(selectedSite.value, selectedServiceId.value);
}

function resolveSelectedSignal() {
  return findSignal(selectedService.value, selectedSignalId.value);
}

function resolveSortedEvents() {
  return recentEvents.value.toSorted(
    (left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt),
  );
}

function findFirstAttentionService(sites: EnvironmentSite[]) {
  for (const site of sites) {
    for (const node of site.nodes) {
      const service = node.services.find(
        (item) => item.status !== 'ok' && item.status !== 'unknown',
      );
      if (service) return { service, site };
    }
  }
  for (const site of sites) {
    const service = getFirstService(site);
    if (service) return { service, site };
  }
  return undefined;
}

function getFirstService(site?: EnvironmentSite) {
  return site?.nodes.flatMap((node) => node.services)[0];
}

function findService(site?: EnvironmentSite, serviceId?: string) {
  if (!site || !serviceId) return undefined;
  for (const node of site.nodes) {
    const service = findServiceInNode(node, serviceId);
    if (service) return service;
  }
  return undefined;
}

function findServiceInNode(node: EnvironmentNode, serviceId: string) {
  return node.services.find((service) => service.id === serviceId);
}

function findNodeByServiceId(site: EnvironmentSite, serviceId: string) {
  return site.nodes.find((node) =>
    node.services.some((service) => service.id === serviceId),
  );
}

function findSignal(service?: EnvironmentService, signalId?: string) {
  if (!service || !signalId) return undefined;
  return service.signals.find((signal) => signal.id === signalId);
}

function mapEventSourceToSignalSource(
  sourceKind: EnvironmentEvent['sourceKind'],
): EnvironmentSignal['sourceKind'] {
  if (sourceKind === 'mqtt' || sourceKind === 'local') return 'live';
  return sourceKind;
}

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

function mapSiteStatus(statuses: EnvironmentHealthStatus[]) {
  const worst = pickWorstHealthStatus(statuses);
  if (worst === 'ok') return 'online';
  if (worst === 'isolated') return 'isolated';
  if (worst === 'degraded' || worst === 'down' || worst === 'blocked') {
    return 'degraded';
  }
  return 'unknown';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return `${record.err || record.message || record.msg || '环境总览请求失败'}`;
  }
  return '环境总览请求失败';
}
</script>

<template>
  <div class="environment-dashboard-page">
    <EnvironmentStatusBar
      :dashboard="dashboard"
      :error-text="errorText"
      :loading="loading"
      :self-checking="selfChecking"
      :stream-state="streamState"
      @refresh="handleManualRefresh"
      @self-check="handleSelfCheck"
    />

    <div class="environment-dashboard-page__main">
      <EnvironmentSiteRail
        :selected-site-id="selectedSiteId"
        :sites="dashboard?.sites ?? []"
        @select-site="handleSiteSelect"
      />
      <EnvironmentTopology
        :selected-service-id="selectedServiceId"
        :site="selectedSite"
        @select-service="handleServiceSelect"
      />
      <EnvironmentEvidencePanel
        :actions="dashboard?.actions ?? []"
        :selected-service="selectedService"
        :selected-signal="selectedSignal"
        :selected-site="selectedSite"
        :self-checking="selfChecking"
        @self-check="handleSelfCheck"
      />
    </div>

    <EnvironmentEventStream :events="sortedEvents" />
  </div>
</template>

<style scoped>
.environment-dashboard-page {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) minmax(108px, 0.26fr);
  gap: 12px;
  width: 100%;
  height: var(--vben-content-height, 100%);
  min-height: 0;
  max-height: var(--vben-content-height, 100%);
  padding: 12px;
  overflow: hidden;
  color: hsl(var(--foreground));
  background: hsl(var(--background-deep));
}

.environment-dashboard-page__main {
  display: grid;
  grid-template-columns: minmax(196px, 0.72fr) minmax(0, 1.9fr) minmax(
      248px,
      0.92fr
    );
  gap: 12px;
  align-items: stretch;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

@media (width <= 1180px) {
  .environment-dashboard-page {
    grid-template-rows: auto minmax(0, 1fr) minmax(96px, 0.22fr);
  }

  .environment-dashboard-page__main {
    grid-template-rows: minmax(0, 1fr) minmax(120px, 0.42fr);
    grid-template-columns: minmax(180px, 220px) minmax(0, 1fr);
  }

  .environment-dashboard-page__main > :last-child {
    grid-column: 1 / -1;
  }
}

@media (width <= 760px) {
  .environment-dashboard-page {
    grid-template-rows: auto minmax(0, 1fr) minmax(88px, 0.18fr);
    gap: 8px;
    padding: 8px;
  }

  .environment-dashboard-page__main {
    grid-template-rows: minmax(0, 0.62fr) minmax(0, 1.3fr) minmax(0, 0.9fr);
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .environment-dashboard-page__main > :last-child {
    grid-column: auto;
  }
}
</style>
