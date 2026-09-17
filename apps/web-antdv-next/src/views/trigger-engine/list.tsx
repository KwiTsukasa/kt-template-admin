import type { TriggerDefinition } from '#/api/trigger-engine';

import { defineComponent } from 'vue';
import { useRouter } from 'vue-router';

import { emptyTrigger, triggerApi } from '#/api/trigger-engine';
import DefinitionList from '#/components/kt-definition-list';
import {
  AUTOMATION_PATH,
  AUTOMATION_PERMISSION,
} from '#/constants/automation/resources';

import TriggerDesigner from './designer';

export default defineComponent({
  name: 'AutomationTriggers',
  setup() {
    const router = useRouter();
    return () => (
      <DefinitionList
        api={triggerApi}
        basePath={AUTOMATION_PATH.triggers}
        columns={[
          {
            title: '发生条件',
            key: 'trigger',
            width: 290,
            render: (_value, row) => {
              const trigger = (row.definition as TriggerDefinition).trigger;
              if (trigger.type === 'cron')
                return `${trigger.expression} · ${trigger.timezone}`;
              if (trigger.type === 'interval')
                return `每 ${trigger.everyMs / 1000} 秒`;
              if (trigger.type === 'once') return `指定时间 · ${trigger.at}`;
              if (trigger.type === 'event')
                return `业务事件 · ${trigger.eventKey}`;
              return '手动触发';
            },
          },
        ]}
        createDefinition={emptyTrigger}
        designerLabel="配置触发器"
        drawerEditor={TriggerDesigner}
        extraActions={[
          {
            key: 'activity',
            label: '触发记录',
            permissionCodes: [AUTOMATION_PERMISSION.triggerList],
            onClick: async (row) => {
              await router.push(
                `${AUTOMATION_PATH.triggers}/${row.id}/activity`,
              );
            },
          },
        ]}
        pageTitle="触发条件"
        permission="Automation:Trigger"
        title="触发器"
      />
    );
  },
});
