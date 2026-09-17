import type {
  ScheduleDefinition,
  ScheduleListItem,
} from '#/api/task-scheduling/schedule';

import { defineComponent } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { emptySchedule, scheduleApi } from '#/api/task-scheduling/schedule';
import DefinitionList from '#/components/kt-definition-list';
import {
  AUTOMATION_PATH,
  AUTOMATION_PERMISSION,
} from '#/constants/automation/resources';

import ScheduleDesigner from './designer';
import ScheduleStatus from './ScheduleStatus';

export default defineComponent({
  name: 'AutomationSchedules',
  setup() {
    const router = useRouter();
    return () => (
      <DefinitionList
        api={scheduleApi}
        basePath={AUTOMATION_PATH.schedules}
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
              <ScheduleStatus value={(row as ScheduleListItem).runtime} />
            ),
          },
        ]}
        createDefinition={emptySchedule}
        designerLabel="配置"
        drawerEditor={ScheduleDesigner}
        extraActions={[
          {
            key: 'control',
            icon: <IconifyIcon icon="lucide:settings-2" />,
            label: '启停与记录',
            permissionCodes: [AUTOMATION_PERMISSION.scheduleList],
            onClick: async (row) => {
              await router.push(
                `${AUTOMATION_PATH.schedules}/${row.id}/control`,
              );
            },
          },
        ]}
        pageTitle="定时任务"
        permission="Automation:Schedule"
        title="定时任务"
        toolbarButtons={[
          {
            key: 'triggers',
            label: '触发条件',
            icon: <IconifyIcon icon="lucide:alarm-clock" />,
            permissionCodes: [AUTOMATION_PERMISSION.triggerList],
            onClick: async () => {
              await router.push(AUTOMATION_PATH.triggers);
            },
          },
          {
            key: 'tasks',
            label: '执行动作',
            icon: <IconifyIcon icon="lucide:blocks" />,
            permissionCodes: [AUTOMATION_PERMISSION.taskList],
            onClick: async () => {
              await router.push(AUTOMATION_PATH.tasks);
            },
          },
          {
            key: 'records',
            label: '运行记录',
            icon: <IconifyIcon icon="lucide:history" />,
            permissionCodes: [AUTOMATION_PERMISSION.monitorList],
            onClick: async () => {
              await router.push(AUTOMATION_PATH.executions);
            },
          },
        ]}
      />
    );
  },
});
