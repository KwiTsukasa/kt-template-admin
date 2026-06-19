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

/**
 * Starts the initial snapshot load when the Vben route component mounts.
 */
function handleMounted() {
  void loadDashboardSnapshot('initial');
}

/**
 * Closes the SSE stream when route transitions remove this page.
 */
function handleBeforeUnmount() {
  environmentStream.close();
}

/**
 * Handles explicit user refresh without creating timer-based polling.
 */
function handleManualRefresh() {
  void loadDashboardSnapshot('manual');
}

/**
 * Runs the read-only backend self-check and replaces visible evidence with its response.
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
 * Loads a dashboard snapshot for first render, manual refresh, or replay gap recovery.
 *
 * @param reason Call origin that controls loading state and snapshot-required de-duping.
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
 * Applies a full dashboard response while preserving still-valid selections.
 *
 * @param next Dashboard response from GET snapshot or POST self-check.
 */
function applyDashboard(next: EnvironmentDashboard) {
  dashboard.value = next;
  recentEvents.value = [...(next.events ?? [])];
  ensureSelection(next);
}

/**
 * Preserves selected service when possible, otherwise selects the first risky service.
 *
 * @param next Dashboard response that becomes the new source of truth.
 */
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

/**
 * Updates selected site and moves service selection to that site's first service.
 *
 * @param siteId Site ID emitted by the left rail.
 */
function handleSiteSelect(siteId: string) {
  selectedSiteId.value = siteId;
  const site = dashboard.value?.sites.find((item) => item.id === siteId);
  const service = getFirstService(site);
  selectedServiceId.value = service?.id;
  selectedSignalId.value = service?.signals[0]?.id;
}

/**
 * Updates selected service inside the active site.
 *
 * @param serviceId Service ID emitted by the topology panel.
 */
function handleServiceSelect(serviceId: string) {
  const service = findService(selectedSite.value, serviceId);
  selectedServiceId.value = service?.id;
  selectedSignalId.value = service?.signals[0]?.id;
}

/**
 * Adds a stream event to the visible bottom event list.
 *
 * @param event SSE event envelope sent by the API stream.
 */
function handleEnvironmentEvent(event: EnvironmentEvent) {
  addRecentEvent(event);
}

/**
 * Merges one signal update into the current dashboard tree without re-fetching.
 *
 * @param event SSE signal envelope sent by the API stream.
 */
function handleEnvironmentSignal(event: EnvironmentEvent) {
  addRecentEvent(event);
  applySignalEvent(event);
}

/**
 * Runs one snapshot load when the API reports a replay buffer gap.
 *
 * @param event Snapshot-required event envelope from the API stream.
 */
function handleSnapshotRequired(event: EnvironmentEvent) {
  addRecentEvent(event);
  void loadDashboardSnapshot('snapshot-required');
}

/**
 * Shows stream errors as evidence without starting a polling fallback.
 *
 * @param event Error event envelope from the API stream.
 */
function handleStreamError(event: EnvironmentEvent) {
  addRecentEvent(event);
  errorText.value = event.summary;
}

/**
 * Applies one service or signal-level update in-place for visible topology state.
 *
 * @param event Parsed SSE environment-signal payload.
 */
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

/**
 * Inserts a recent event newest-first while de-duping by event ID.
 *
 * @param event Event from the initial snapshot or SSE stream.
 */
function addRecentEvent(event: EnvironmentEvent) {
  recentEvents.value = [
    event,
    ...recentEvents.value.filter((item) => item.eventId !== event.eventId),
  ].slice(0, 30);
}

/**
 * Resolves the currently selected site from reactive IDs.
 *
 * @returns Selected site or undefined when the dashboard has not loaded.
 */
function resolveSelectedSite() {
  return dashboard.value?.sites.find(
    (site) => site.id === selectedSiteId.value,
  );
}

/**
 * Resolves the currently selected service from the selected site.
 *
 * @returns Selected service or undefined when no service is selected.
 */
function resolveSelectedService() {
  return findService(selectedSite.value, selectedServiceId.value);
}

/**
 * Resolves the currently selected signal from the selected service.
 *
 * @returns Selected signal or undefined when no signal is selected.
 */
function resolveSelectedSignal() {
  return findSignal(selectedService.value, selectedSignalId.value);
}

/**
 * Sorts events newest-first using their observed time while keeping stable IDs.
 *
 * @returns Event list used by the bottom stream panel.
 */
function resolveSortedEvents() {
  return recentEvents.value.toSorted(
    (left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt),
  );
}

/**
 * Finds the first non-green service as the default operational focus.
 *
 * @param sites Dashboard sites from the latest snapshot.
 * @returns Preferred site/service pair or undefined when all sites are empty.
 */
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

/**
 * Finds the first service under a site.
 *
 * @param site Site selected by route state or fallback selection.
 * @returns First service in the site tree.
 */
function getFirstService(site?: EnvironmentSite) {
  return site?.nodes.flatMap((node) => node.services)[0];
}

/**
 * Finds one service by ID within a site.
 *
 * @param site Site tree to inspect.
 * @param serviceId Service ID from user selection or persisted state.
 * @returns Matching service when still present.
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
 * Finds one service by ID within a single node.
 *
 * @param node Node that owns service records.
 * @param serviceId Service ID from an SSE event or user selection.
 * @returns Matching service when present.
 */
function findServiceInNode(node: EnvironmentNode, serviceId: string) {
  return node.services.find((service) => service.id === serviceId);
}

/**
 * Finds the node that owns a service ID.
 *
 * @param site Site tree to inspect.
 * @param serviceId Service ID from the SSE signal envelope.
 * @returns Owning node when the service exists.
 */
function findNodeByServiceId(site: EnvironmentSite, serviceId: string) {
  return site.nodes.find((node) =>
    node.services.some((service) => service.id === serviceId),
  );
}

/**
 * Finds one signal by ID within a service.
 *
 * @param service Service that owns signal records.
 * @param signalId Signal ID from selection or an SSE event.
 * @returns Matching signal when present.
 */
function findSignal(service?: EnvironmentService, signalId?: string) {
  if (!service || !signalId) return undefined;
  return service.signals.find((signal) => signal.id === signalId);
}

/**
 * Converts event source metadata into signal source kinds supported by node badges.
 *
 * @param sourceKind Event source kind from the SSE envelope.
 * @returns Signal source kind stored on the affected signal.
 */
function mapEventSourceToSignalSource(
  sourceKind: EnvironmentEvent['sourceKind'],
): EnvironmentSignal['sourceKind'] {
  if (sourceKind === 'mqtt' || sourceKind === 'local') return 'live';
  return sourceKind;
}

/**
 * Picks the strongest status for a node after a signal update.
 *
 * @param statuses Service statuses under the same node.
 * @returns Strongest health status according to dashboard severity rules.
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
 * Maps node health back into the coarser site status union.
 *
 * @param statuses Node statuses under the same site.
 * @returns Site-level status that never marks unknown/unwired integrations green.
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
 * Normalizes unknown thrown values from request wrappers into alert text.
 *
 * @param error Error thrown by the request client or runtime code.
 * @returns User-visible error summary.
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
