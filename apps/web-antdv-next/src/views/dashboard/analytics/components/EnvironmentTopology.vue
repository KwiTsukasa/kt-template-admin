<script lang="ts" setup>
import type { EnvironmentService, EnvironmentSite } from '../types';

import { Empty, Tag } from 'antdv-next';

import { HEALTH_PRESENTATION } from '../presentation';

defineProps<{
  selectedServiceId?: string;
  site?: EnvironmentSite;
}>();

defineEmits<{
  selectService: [serviceId: string];
}>();

/**
 * 统计服务中尚未配置数据来源的信号，保留待接入状态的可见性。
 * @param service - 当前节点内的服务记录。
 * @returns 尚未接入的信号数量。
 */
function countUnwiredSignals(service: EnvironmentService) {
  return service.signals.filter((signal) => signal.status === 'unwired').length;
}
</script>

<template>
  <section class="environment-topology">
    <div class="environment-topology__header">
      <div>
        <h2>{{ site?.label || '未选择站点' }}</h2>
      </div>
      <span v-if="site">{{ site.nodes.length }} 个节点 · 点击服务查看证据</span>
    </div>

    <Empty
      v-if="!site || site.nodes.length === 0"
      description="当前站点暂无节点数据"
    />
    <div v-else class="environment-topology__nodes">
      <section
        v-for="node in site.nodes"
        :key="node.id"
        class="environment-topology__node"
      >
        <div class="environment-topology__node-heading">
          <strong>{{ node.label }}</strong>
          <Tag :color="HEALTH_PRESENTATION[node.status].color">
            {{ HEALTH_PRESENTATION[node.status].label }}
          </Tag>
        </div>
        <div class="environment-topology__services">
          <button
            v-for="service in node.services"
            :key="service.id"
            class="environment-topology__service"
            :aria-pressed="service.id === selectedServiceId"
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
              <Tag :color="HEALTH_PRESENTATION[service.status].color">
                {{ HEALTH_PRESENTATION[service.status].label }}
              </Tag>
              <Tag v-if="countUnwiredSignals(service) > 0">
                {{ countUnwiredSignals(service) }} 未接入
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
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: hsl(var(--card-foreground));
}

.environment-topology__header,
.environment-topology__node-heading,
.environment-topology__service-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}

.environment-topology__header {
  justify-content: space-between;
}

.environment-topology :deep(.ant-tag) {
  margin: 0;
}

.environment-topology__header p {
  margin: 0 0 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.environment-topology__header h2 {
  margin: 0;
  font-size: 18px;
  color: hsl(var(--foreground));
}

.environment-topology__nodes {
  display: grid;
  gap: 24px;
  align-content: start;
  min-height: 0;
  margin-top: 16px;
}

.environment-topology__node {
  min-width: 0;
}

.environment-topology__services {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
  gap: 12px;
  align-items: start;
  margin-top: 12px;
}

.environment-topology__service {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 16px;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.environment-topology__service:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 3px;
}

.environment-topology__service:hover {
  border-color: hsl(var(--primary));
}

.environment-topology__service.is-selected {
  background: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary));
}

.environment-topology__service-name {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.environment-topology__service-summary {
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}
</style>
