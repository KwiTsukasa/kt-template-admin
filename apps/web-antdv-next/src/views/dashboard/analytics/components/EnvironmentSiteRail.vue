<script lang="ts" setup>
import type { EnvironmentSite } from '../types';

import { Badge, Tag } from 'antdv-next';

const props = defineProps<{
  selectedSiteId?: string;
  sites: EnvironmentSite[];
}>();

defineEmits<{
  selectSite: [siteId: string];
}>();

function countSignals(site: EnvironmentSite) {
  return site.nodes.reduce(
    (count, node) =>
      count +
      node.services.reduce(
        (serviceCount, service) => serviceCount + service.signals.length,
        0,
      ),
    0,
  );
}

function countUnwiredSignals(site: EnvironmentSite) {
  return site.nodes.reduce(
    (count, node) =>
      count +
      node.services.reduce(
        (serviceCount, service) =>
          serviceCount +
          service.signals.filter((signal) => signal.status === 'unwired')
            .length,
        0,
      ),
    0,
  );
}

function getBadgeStatus(site: EnvironmentSite) {
  if (site.status === 'online') return 'success';
  if (site.status === 'degraded') return 'warning';
  if (site.status === 'isolated') return 'error';
  return 'default';
}
</script>

<template>
  <aside class="environment-site-rail">
    <button
      v-for="site in props.sites"
      :key="site.id"
      class="environment-site-rail__item"
      :class="[{ 'is-selected': site.id === selectedSiteId }]"
      type="button"
      @click="$emit('selectSite', site.id)"
    >
      <span class="environment-site-rail__topline">
        <strong>{{ site.label }}</strong>
        <Badge :status="getBadgeStatus(site)" :text="site.status" />
      </span>
      <span class="environment-site-rail__summary">{{ site.summary }}</span>
      <span class="environment-site-rail__meta">
        <Tag>{{ countSignals(site) }} signals</Tag>
        <Tag v-if="countUnwiredSignals(site) > 0">
          {{ countUnwiredSignals(site) }} unwired
        </Tag>
      </span>
    </button>
  </aside>
</template>

<style scoped>
.environment-site-rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.environment-site-rail__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding: 12px;
  overflow: hidden;
  color: hsl(var(--card-foreground));
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.environment-site-rail__item.is-selected {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary));
  box-shadow: inset 3px 0 0 hsl(var(--primary));
}

.environment-site-rail__topline,
.environment-site-rail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.environment-site-rail__summary {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}
</style>
