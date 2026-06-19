<script lang="ts" setup>
import type {
  EnvironmentHealthStatus,
  EnvironmentService,
  EnvironmentSite,
} from '../types';

import { Empty, Tag } from 'antdv-next';

defineProps<{
  selectedServiceId?: string;
  site?: EnvironmentSite;
}>();

defineEmits<{
  selectService: [serviceId: string];
}>();

/**
 * Maps service health to a compact tag color.
 *
 * @param status Service or signal status from the dashboard model.
 * @returns Antdv tag color value.
 */
function getStatusColor(status: EnvironmentHealthStatus) {
  if (status === 'ok') return 'success';
  if (status === 'degraded') return 'warning';
  if (status === 'blocked' || status === 'down') return 'error';
  if (status === 'isolated') return 'purple';
  return 'default';
}

/**
 * Counts unwired signals in a service.
 *
 * @param service Service record selected from the current site.
 * @returns Number of signals that are visibly missing configuration.
 */
function countUnwiredSignals(service: EnvironmentService) {
  return service.signals.filter((signal) => signal.status === 'unwired').length;
}
</script>

<template>
  <section class="environment-topology">
    <div class="environment-topology__header">
      <div>
        <p>Topology</p>
        <h2>{{ site?.label || 'No site selected' }}</h2>
      </div>
      <Tag v-if="site">{{ site.status }}</Tag>
    </div>

    <Empty v-if="!site || site.nodes.length === 0" />
    <div v-else class="environment-topology__nodes">
      <section
        v-for="node in site.nodes"
        :key="node.id"
        class="environment-topology__node"
      >
        <div class="environment-topology__node-heading">
          <strong>{{ node.label }}</strong>
          <Tag :color="getStatusColor(node.status)">{{ node.status }}</Tag>
        </div>
        <div class="environment-topology__services">
          <button
            v-for="service in node.services"
            :key="service.id"
            class="environment-topology__service"
            :class="[{ 'is-selected': service.id === selectedServiceId }]"
            type="button"
            @click="$emit('selectService', service.id)"
          >
            <span class="environment-topology__service-name">
              {{ service.label }}
            </span>
            <span class="environment-topology__service-summary">
              {{ service.summary }}
            </span>
            <span class="environment-topology__service-tags">
              <Tag :color="getStatusColor(service.status)">
                {{ service.status }}
              </Tag>
              <Tag v-if="countUnwiredSignals(service) > 0">
                {{ countUnwiredSignals(service) }} unwired
              </Tag>
              <Tag v-for="signal in service.signals" :key="signal.id">
                {{ signal.sourceKind }}
              </Tag>
            </span>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.environment-topology {
  min-width: 0;
  padding: 16px;
  border: 1px solid hsl(214deg 18% 86%);
  border-radius: 8px;
  background: hsl(0deg 0% 100%);
}

.environment-topology__header,
.environment-topology__node-heading,
.environment-topology__service-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.environment-topology__header p {
  margin: 0 0 4px;
  color: hsl(215deg 12% 45%);
  font-size: 12px;
}

.environment-topology__header h2 {
  margin: 0;
  color: hsl(219deg 22% 18%);
  font-size: 18px;
}

.environment-topology__nodes {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}

.environment-topology__node {
  padding: 12px;
  border: 1px solid hsl(210deg 18% 91%);
  border-radius: 8px;
}

.environment-topology__services {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.environment-topology__service {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 124px;
  padding: 12px;
  color: hsl(219deg 22% 18%);
  text-align: left;
  border: 1px solid hsl(214deg 18% 86%);
  border-radius: 8px;
  background: hsl(210deg 25% 98%);
  cursor: pointer;
}

.environment-topology__service.is-selected {
  border-color: hsl(198deg 82% 42%);
  background: hsl(198deg 42% 96%);
}

.environment-topology__service-name {
  font-weight: 700;
}

.environment-topology__service-summary {
  flex: 1;
  color: hsl(215deg 12% 38%);
  font-size: 12px;
  line-height: 1.45;
}
</style>
