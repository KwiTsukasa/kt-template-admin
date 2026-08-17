import type { PropType } from 'vue';

import type { MediaGovernanceTaskOperation } from '../task-operation-contract';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent } from 'vue';

import {
  Alert,
  Button,
  Descriptions,
  Popconfirm,
  Progress,
  Space,
} from 'antdv-next';

const AAlert = Alert as any;
const AButton = Button as any;
const ADescriptions = Descriptions as any;
const APopconfirm = Popconfirm as any;
const AProgress = Progress as any;
const ASpace = Space as any;

export default defineComponent({
  name: 'MediaGovernanceTaskOverviewPanel',
  props: {
    canExecute: {
      required: true,
      type: Function as PropType<(permissionCode: string) => boolean>,
    },
    execute: {
      required: true,
      type: Function as PropType<
        (operation: MediaGovernanceTaskOperation) => void
      >,
    },
    operationKey: { default: '', type: String },
    operations: {
      default: () => [],
      type: Array as PropType<MediaGovernanceTaskOperation[]>,
    },
    task: {
      required: true,
      type: Object as PropType<MediaGovernanceApi.Task>,
    },
  },
  setup(props) {
    /**
     * 根据任务是否受阻选择概要提示样式。
     *
     * @returns 任务受阻时为 error，其他状态为 info。
     */
    function alertType() {
      if (props.task.gateReason) return 'warning';
      return 'info';
    }

    /**
     * 将任务运行状态映射为进度条状态。
     *
     * @returns 任务失败时为 exception，完成时为 success，其余为 active。
     */
    function progressStatus() {
      if (props.task.runState === 'blocked') return 'exception';
      return 'active';
    }

    /**
     * 根据权限和风险级别渲染任务操作按钮及确认层。
     *
     * @param operation - 要按权限、危险级别与确认配置渲染的任务操作描述。
     * @returns 按权限、禁用原因与危险级别配置的操作按钮。
     */
    function renderOperationButton(operation: MediaGovernanceTaskOperation) {
      if (!props.canExecute(operation.permissionCode)) return null;
      let buttonType = 'primary';
      if (operation.danger) buttonType = 'default';
      const button = (
        <AButton
          danger={operation.danger}
          loading={props.operationKey === operation.key}
          onClick={() => {
            if (!operation.danger) props.execute(operation);
          }}
          type={buttonType}
        >
          {operation.label}
        </AButton>
      );
      if (!operation.danger) return button;
      let confirmationDescription =
        '只取消当前下载执行器，不删除已验收的正式媒体文件。';
      let confirmationTitle = `确认${operation.label}？`;
      if (operation.confirmation) {
        confirmationDescription = operation.confirmation.description;
        confirmationTitle = operation.confirmation.title;
      }
      return (
        <APopconfirm
          description={confirmationDescription}
          onConfirm={() => props.execute(operation)}
          title={confirmationTitle}
        >
          {button}
        </APopconfirm>
      );
    }

    /**
     * 渲染当前任务可执行的下一步操作集合。
     *
     * @returns 当前任务可执行操作的按钮组；无操作时返回 null。
     */
    function renderOperations() {
      if (props.operations.length === 0) return null;
      return (
        <div class="rounded border border-solid border-primary/30 bg-primary/5 p-4">
          <div class="mb-3">
            <div class="font-medium">下一步可执行操作</div>
            <div class="mt-1 text-sm text-muted-foreground">
              操作成功后会自动刷新任务状态，运行进度由实时事件继续更新。
            </div>
          </div>
          <ASpace wrap>
            {props.operations.map((operation) => (
              <span key={`${operation.key}:${operation.sourceId || ''}`}>
                {renderOperationButton(operation)}
              </span>
            ))}
          </ASpace>
        </div>
      );
    }

    return () => (
      <div class="grid gap-4">
        <AAlert
          description={`当前动作：${props.task.semanticProjection.currentActionLabel}`}
          showIcon
          title={props.task.nextCommandLabel}
          type={alertType()}
        />
        {renderOperations()}
        <AProgress
          percent={props.task.progress.percent}
          status={progressStatus()}
        />
        <ADescriptions
          bordered
          column={{ lg: 2, md: 2, sm: 1, xl: 2, xs: 1, xxl: 2 }}
          items={[
            {
              content: props.task.identityPreview.mediaTypeLabel,
              key: 'type',
              label: '作品类型',
            },
            {
              content: props.task.identityPreview.seasonLabel,
              key: 'season',
              label: '治理单元',
            },
            {
              content: props.task.identityPreview.providerLabel,
              key: 'provider',
              label: '资料库身份',
            },
            {
              content: props.task.identityPreview.releaseYearLabel,
              key: 'year',
              label: '首播/上映年份',
            },
            {
              content: props.task.progress.progressLabel,
              key: 'progress',
              label: '量化进度',
            },
            {
              content: props.task.progress.heartbeatLabel,
              key: 'heartbeat',
              label: '最后心跳',
            },
            {
              content: props.task.progress.speedLabel,
              key: 'speed',
              label: '当前速率',
            },
            {
              content: props.task.progress.etaLabel,
              key: 'eta',
              label: '预计剩余',
            },
          ]}
        />
      </div>
    );
  },
});
