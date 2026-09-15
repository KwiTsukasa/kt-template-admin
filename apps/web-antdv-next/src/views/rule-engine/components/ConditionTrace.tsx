import { defineComponent, type PropType } from 'vue';
import { Tag } from 'antdv-next';
import type { RuleConditionTrace } from '#/api/rule-engine';
import type { DataField } from '#/api/automation/definition';

const operators: Record<string, string> = {
  eq: '等于', ne: '不等于', gt: '大于', gte: '大于等于',
  lt: '小于', lte: '小于等于', in: '属于集合', contains: '包含', exists: '存在性',
};
const groups: Record<string, string> = { all: '全部满足', any: '任一满足', not: '取反' };

export default defineComponent({
  name: 'ConditionTrace',
  props: {
    trace: { type: Array as PropType<RuleConditionTrace[]>, required: true },
    fields: { type: Array as PropType<DataField[]>, required: true },
  },
  setup(props) {
    const label = (entry: RuleConditionTrace) => {
      if (entry.type !== 'compare') return groups[entry.type];
      const field = props.fields.find((candidate) => candidate.key === entry.field);
      return `${field?.label || entry.field} · ${operators[entry.operator || ''] || entry.operator}`;
    };
    const color = (matched: boolean) => { if (matched) return 'success'; return 'default'; };
    const result = (matched: boolean) => { if (matched) return '满足'; return '不满足'; };
    return () => <section class="mt-4 space-y-2" aria-label="逐条件解释">
      <h3>逐条件解释</h3>
      {props.trace.map((entry) => <div key={entry.location} class="flex flex-wrap items-center gap-2 border-b pb-2">
        <code class="text-xs text-muted-foreground">{entry.location}</code>
        <span>{label(entry)}</span><Tag color={color(entry.matched)}>{result(entry.matched)}</Tag>
      </div>)}
    </section>;
  },
});
