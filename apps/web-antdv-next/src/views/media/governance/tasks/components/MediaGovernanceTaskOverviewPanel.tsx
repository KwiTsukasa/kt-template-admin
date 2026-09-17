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

import { getMediaGovernanceProgressStatus } from '../task-operation-contract';

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
     * 根据权限和风险级别渲染任务操作按钮及确认层。
     *
     * @param operation - 要按权限、危险级别与确认配置渲染的任务操作描述。
     * @returns 按权限、禁用原因与危险级别配置的操作按钮。
     */
    function renderOperationButton(operation: MediaGovernanceTaskOperation) {
      let buttonType = 'primary';
      if (operation.danger) buttonType = 'default';
      const button = (
        <AButton
          danger={operation.danger}
          disabled={
            !props.canExecute(operation.permissionCode) || !!props.operationKey
          }
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
      let confirmationDescription = '';
      let confirmationTitle = `确认${operation.label}？`;
      if (operation.confirmation) {
        confirmationDescription = operation.confirmation.description;
        confirmationTitle = operation.confirmation.title;
      }
      return (
        <APopconfirm
          description={confirmationDescription}
          disabled={
            !props.canExecute(operation.permissionCode) || !!props.operationKey
          }
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
        <ASpace wrap>
          {props.operations.map((operation) => (
            <span key={`${operation.key}:${operation.sourceId || ''}`}>
              {renderOperationButton(operation)}
            </span>
          ))}
        </ASpace>
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
          status={getMediaGovernanceProgressStatus(props.task)}
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
