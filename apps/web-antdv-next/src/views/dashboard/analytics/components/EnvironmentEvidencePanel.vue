<script lang="ts" setup>
import type {
  EnvironmentService,
  EnvironmentSignal,
  EnvironmentSite,
} from '../types';

import { computed } from 'vue';

import { Button, Empty, Select, Space, Tag } from 'antdv-next';

import { HEALTH_PRESENTATION } from '../presentation';

const props = defineProps<{
  loading: boolean;
  selectedService?: EnvironmentService;
  selectedSignal?: EnvironmentSignal;
  selectedSite?: EnvironmentSite;
  selfChecking: boolean;
}>();
defineEmits<{ refresh: []; selectSignal: [signalId: string]; selfCheck: [] }>();
const evidence = computed(
  () =>
    props.selectedSignal?.evidence ??
    props.selectedService?.signals.flatMap((signal) => signal.evidence) ??
    [],
);
</script>

<template>
  <div class="environment-evidence-panel">
    <Space wrap>
      <Tag
        v-if="selectedService"
        :color="HEALTH_PRESENTATION[selectedService.status].color"
      >
        {{ HEALTH_PRESENTATION[selectedService.status].label }}
      </Tag>
      <span>{{ selectedSite?.label }}</span>
    </Space>
    <p>{{ selectedService?.summary }}</p>
    <Select
      v-if="selectedService?.signals.length"
      aria-label="探针"
      :options="
        selectedService.signals.map((signal) => ({
          label: signal.label,
          value: signal.id,
        }))
      "
      :value="selectedSignal?.id"
      @change="$emit('selectSignal', String($event))"
    />
    <Empty v-if="evidence.length === 0" description="暂无探针证据" />
    <ul v-else class="environment-evidence-panel__list">
      <li v-for="(item, index) in evidence" :key="`${item.source}-${index}`">
        <strong>{{ item.source }}</strong>
        <p>{{ item.summary }}</p>
        <time v-if="item.observedAt">{{ item.observedAt }}</time>
      </li>
    </ul>
    <Space wrap>
      <Button :loading="loading" @click="$emit('refresh')">刷新</Button>
      <Button :loading="selfChecking" @click="$emit('selfCheck')">
        只读自检
      </Button>
    </Space>
  </div>
</template>

<style scoped>
.environment-evidence-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.environment-evidence-panel p {
  margin: 0;
}

.environment-evidence-panel__list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.environment-evidence-panel__list li {
  display: grid;
  gap: 8px;
  padding: 16px 0;
  border-bottom: 1px solid hsl(var(--border));
}

.environment-evidence-panel__list time {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
