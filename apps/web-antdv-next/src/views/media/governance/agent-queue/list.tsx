import type { TableColumnType } from 'antdv-next';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type { KtTableApi } from '#/components/ktTable';

import { defineComponent, onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Tag } from 'antdv-next';

import { getMediaGovernanceTaskPage } from '#/api/media-governance';
import { KtTable, useKtTable } from '#/components/ktTable';

import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';

const AAlert = Alert as any;
const AKtTable = KtTable as any;
const ATag = Tag as any;

function agentStatusColor(
  status: MediaGovernanceApi.AgentSession['status'] | undefined,
) {
  if (status === 'failed') return 'error';
  if (status === 'needs-operator') return 'warning';
  return 'processing';
}

export default defineComponent({
  name: 'MediaGovernanceAgentQueue',
  setup() {
    const router = useRouter();
    const columns: Array<TableColumnType<MediaGovernanceApi.Task>> = [
      { dataIndex: 'titleHint', key: 'titleHint', title: '作品', width: 220 },
      {
        dataIndex: 'agentSession',
        key: 'status',
        title: 'Agent 状态',
        width: 160,
      },
      {
        dataIndex: 'agentSession',
        key: 'action',
        title: '当前动作',
        width: 280,
      },
      {
        dataIndex: 'agentSession',
        key: 'heartbeat',
        title: '最后心跳',
        width: 140,
      },
      { dataIndex: 'revision', key: 'revision', title: '任务版本', width: 110 },
    ];
    const api: KtTableApi<MediaGovernanceApi.Task> = {
      list: async (params) =>
        await getMediaGovernanceTaskPage({
          ...params,
          metadataStatus: 'requires-agent',
        }),
    };
    const [registerTable, tableApi] = useKtTable<MediaGovernanceApi.Task>({
      api,
      columns,
      tableTitle: 'CodexAgent 人工治理队列',
    });
    const stream = useMediaGovernanceStream({
      onSnapshotRequired: () => void tableApi.reload(),
      onTaskChanged: () => void tableApi.reload(),
    });

    onMounted(stream.start);
    onBeforeUnmount(stream.close);

    return () => (
      <Page autoContentHeight>
        <div class="grid gap-4">
          <AAlert
            message="这里只展示需要 CodexAgent 或操作员处理的任务；所有动作仍受五层边界和任务版本门约束。"
            showIcon
            type="info"
          />
          <AKtTable
            onRegister={registerTable}
            v-slots={{
              bodyCell: ({ column, record }: any) => {
                const row = record as MediaGovernanceApi.Task;
                if (column.key === 'titleHint') {
                  return (
                    <a
                      href={
                        router.resolve({
                          name: 'MediaGovernanceTaskDetail',
                          params: { taskId: row.id },
                        }).href
                      }
                    >
                      {row.titleHint}
                    </a>
                  );
                }
                if (column.key === 'status') {
                  return (
                    <ATag color={agentStatusColor(row.agentSession?.status)}>
                      {row.agentSession?.statusLabel || '等待启动'}
                    </ATag>
                  );
                }
                if (column.key === 'action')
                  return (
                    row.agentSession?.currentActionLabel || row.nextCommandLabel
                  );
                if (column.key === 'heartbeat')
                  return row.agentSession?.lastHeartbeatLabel || '-';
                return undefined;
              },
            }}
          />
        </div>
      </Page>
    );
  },
});
