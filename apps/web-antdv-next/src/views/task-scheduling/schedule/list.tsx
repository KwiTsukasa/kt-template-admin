import type { ScheduleDefinition } from '#/api/task-scheduling/schedule';

import { defineComponent } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { emptySchedule, scheduleApi } from '#/api/task-scheduling/schedule';
import DefinitionList from '#/components/kt-definition-list';

import ScheduleDesigner from './designer';
import ScheduleStatus from './ScheduleStatus';

export default defineComponent({
  name: 'AutomationSchedules',
  setup() {
    const router = useRouter();
    return () => (
      <DefinitionList
        api={scheduleApi}
        basePath="/automation/schedules"
        columns={[
          {
            title: '执行对象',
            key: 'target',
            width: 150,
            render: (_value, row) => {
              const target = (row.definition as ScheduleDefinition).target;
              if (!target) return '尚未配置';
              let label = '业务动作';
              if (target.type === 'workflow') label = '工作流';
              return `${label} · v${target.reference.version}`;
            },
          },
          {
            title: '运行状态 / 最近结果',
            key: 'state',
            width: 300,
            render: (_value, row) => (
              <ScheduleStatus id={row.id} revision={row.revision} />
            ),
          },
        ]}
        createDefinition={emptySchedule}
        description="安排系统维护和业务核对，查看每次触发、准入与执行结果。"
        designerLabel="配置"
        drawerEditor={ScheduleDesigner}
        extraActions={[
          {
            key: 'control',
            icon: <IconifyIcon icon="lucide:settings-2" />,
            label: '启停与记录',
            permissionCodes: ['Automation:Schedule:List'],
            onClick: async (row) => {
              await router.push(`/automation/schedules/${row.id}/control`);
            },
          },
        ]}
        icon="lucide:calendar-clock"
        pageTitle="定时任务"
        permission="Automation:Schedule"
        title="定时任务"
        toolbarButtons={[
          {
            key: 'triggers',
            label: '触发条件',
            icon: <IconifyIcon icon="lucide:alarm-clock" />,
            permissionCodes: ['Automation:Trigger:List'],
            onClick: async () => {
              await router.push('/automation/triggers');
            },
          },
          {
            key: 'tasks',
            label: '执行动作',
            icon: <IconifyIcon icon="lucide:blocks" />,
            permissionCodes: ['Automation:Task:List'],
            onClick: async () => {
              await router.push('/automation/tasks');
            },
          },
          {
            key: 'records',
            label: '运行记录',
            icon: <IconifyIcon icon="lucide:history" />,
            permissionCodes: ['Automation:Monitor:List'],
            onClick: async () => {
              await router.push('/automation/executions');
            },
          },
        ]}
      />
    );
  },
});
