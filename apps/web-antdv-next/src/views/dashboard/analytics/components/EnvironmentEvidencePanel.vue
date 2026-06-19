<script lang="ts" setup>
import type {
  EnvironmentAction,
  EnvironmentEvidence,
  EnvironmentService,
  EnvironmentSignal,
  EnvironmentSite,
} from '../types';

import { Button, Empty, Tag } from 'antdv-next';

defineProps<{
  actions: EnvironmentAction[];
  selectedService?: EnvironmentService;
  selectedSignal?: EnvironmentSignal;
  selectedSite?: EnvironmentSite;
  selfChecking: boolean;
}>();

defineEmits<{
  selfCheck: [];
}>();

/**
 * Returns evidence rows for the selected service or signal.
 *
 * @param service Selected topology service from the current site.
 * @param signal Selected signal when the user drills into one.
 * @returns Evidence list shown in the right-side panel.
 */
function getEvidenceRows(
  service?: EnvironmentService,
  signal?: EnvironmentSignal,
) {
  if (signal) return signal.evidence;
  return (
    service?.signals.flatMap((serviceSignal) => serviceSignal.evidence) ?? []
  );
}

/**
 * Labels evidence with a stable source and missing-config status.
 *
 * @param evidence Evidence record from the API contract.
 * @returns Human-readable evidence title.
 */
function getEvidenceTitle(evidence: EnvironmentEvidence) {
  return `${evidence.type || 'evidence'} · ${evidence.source}`;
}
</script>

<template>
  <aside class="environment-evidence-panel">
    <section class="environment-evidence-panel__section">
      <p class="environment-evidence-panel__eyebrow">Evidence</p>
      <h2>{{ selectedService?.label || selectedSite?.label || '未选择' }}</h2>
      <p class="environment-evidence-panel__summary">
        {{
          selectedService?.summary || selectedSite?.summary || '暂无环境证据'
        }}
      </p>
      <Tag v-if="selectedService">{{ selectedService.status }}</Tag>
    </section>

    <section class="environment-evidence-panel__section">
      <h3>证据链</h3>
      <Empty
        v-if="getEvidenceRows(selectedService, selectedSignal).length === 0"
      />
      <ul v-else class="environment-evidence-panel__evidence-list">
        <li
          v-for="evidence in getEvidenceRows(selectedService, selectedSignal)"
          :key="`${evidence.source}-${evidence.summary}`"
        >
          <strong>{{ getEvidenceTitle(evidence) }}</strong>
          <span>{{ evidence.summary }}</span>
          <small v-if="evidence.observedAt">{{ evidence.observedAt }}</small>
        </li>
      </ul>
    </section>

    <section class="environment-evidence-panel__section">
      <h3>动作</h3>
      <div class="environment-evidence-panel__actions">
        <div
          v-for="action in actions"
          :key="action.id"
          class="environment-evidence-panel__action"
        >
          <Button
            :disabled="!action.enabled"
            :loading="action.id === 'run-self-check' && selfChecking"
            @click="
              action.id === 'run-self-check' && action.enabled
                ? $emit('selfCheck')
                : undefined
            "
          >
            {{ action.label }}
          </Button>
          <span v-if="!action.enabled">{{ action.disabledReason }}</span>
          <span v-else-if="action.riskLevel === 'low'">只读动作</span>
        </div>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.environment-evidence-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
  min-width: 0;
  height: 100%;
  min-height: 0;
  padding: 14px;
  overflow: hidden;
  color: hsl(var(--card-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.environment-evidence-panel__section {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.environment-evidence-panel__section h2,
.environment-evidence-panel__section h3,
.environment-evidence-panel__eyebrow,
.environment-evidence-panel__summary {
  margin: 0;
}

.environment-evidence-panel__section h2 {
  font-size: 18px;
  color: hsl(var(--foreground));
}

.environment-evidence-panel__section h3 {
  margin-bottom: 10px;
  font-size: 14px;
  color: hsl(var(--foreground));
}

.environment-evidence-panel__eyebrow,
.environment-evidence-panel__summary,
.environment-evidence-panel__action span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.environment-evidence-panel__evidence-list {
  display: grid;
  gap: 8px;
  min-height: 0;
  padding: 0;
  margin: 0;
  overflow: hidden;
  list-style: none;
}

.environment-evidence-panel__evidence-list li,
.environment-evidence-panel__action {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 8px;
  overflow: hidden;
  background: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.environment-evidence-panel__evidence-list strong,
.environment-evidence-panel__evidence-list span,
.environment-evidence-panel__evidence-list small {
  overflow-wrap: anywhere;
}

.environment-evidence-panel__actions {
  display: grid;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
}
</style>
