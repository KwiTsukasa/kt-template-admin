import type { PropType } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent } from 'vue';

import {
  Alert,
  Button,
  Descriptions,
  Empty,
  RadioGroup,
  TextArea,
} from 'antdv-next';

const AAlert = Alert as any;
const AButton = Button as any;
const ADescriptions = Descriptions as any;
const AEmpty = Empty as any;
const AInputTextArea = TextArea as any;
const ARadioGroup = RadioGroup as any;

export default defineComponent({
  name: 'MediaGovernanceTaskAgentPanel',
  props: {
    canDecide: { default: false, type: Boolean },
    candidateId: { default: '', type: String },
    operationKey: { default: '', type: String },
    reason: { default: '', type: String },
    session: {
      default: undefined,
      type: Object as PropType<MediaGovernanceApi.AgentSession | null>,
    },
  },
  emits: ['candidateChange', 'reasonChange', 'submit'],
  setup(props, { emit }) {
    function resultAlertType(session: MediaGovernanceApi.AgentSession) {
      if (session.status === 'failed') return 'error';
      return 'info';
    }

    function renderResult(session: MediaGovernanceApi.AgentSession) {
      if (!session.result) return null;
      return (
        <AAlert
          description={session.result.nextActionLabel}
          showIcon
          title={session.result.summary}
          type={resultAlertType(session)}
        />
      );
    }

    function renderOperatorDecision(session: MediaGovernanceApi.AgentSession) {
      const candidates = session.result?.candidates ?? [];
      if (session.status !== 'needs-operator' || candidates.length === 0) {
        return null;
      }
      const button = [];
      if (props.canDecide) {
        button.push(
          <AButton
            key="submit"
            loading={props.operationKey === 'operator-decision'}
            onClick={() => emit('submit')}
            type="primary"
          >
            放行所选候选并继续治理
          </AButton>,
        );
      }
      return (
        <div class="grid gap-4 rounded border border-solid border-warning/40 p-4">
          <div>
            <div class="font-medium">人工核对并放行候选</div>
            <div class="mt-1 text-sm text-muted-foreground">
              选择经过核对的唯一候选并记录放行依据；未放行前 Agent
              不会继续写入正式媒体目录。
            </div>
          </div>
          <ARadioGroup
            onChange={(event: { target: { value: string } }) =>
              emit('candidateChange', event.target.value)
            }
            options={candidates.map((candidate) => ({
              label: candidate.summary,
              value: candidate.id,
            }))}
            value={props.candidateId}
          />
          <AInputTextArea
            autoSize={{ maxRows: 5, minRows: 3 }}
            maxlength={500}
            onChange={(event: { target: { value: string } }) =>
              emit('reasonChange', event.target.value)
            }
            placeholder="填写人工核对依据"
            showCount
            value={props.reason}
          />
          <div>{button}</div>
        </div>
      );
    }

    return () => {
      const session = props.session;
      if (!session) {
        return <AEmpty description="当前任务尚未进入 CodexAgent 人工治理" />;
      }
      return (
        <div class="grid gap-4">
          <ADescriptions
            bordered
            column={1}
            items={[
              {
                content: session.statusLabel,
                key: 'status',
                label: 'Agent 状态',
              },
              {
                content: session.currentActionLabel,
                key: 'action',
                label: '当前动作',
              },
              {
                content: session.lastHeartbeatLabel,
                key: 'heartbeat',
                label: '最后心跳',
              },
              {
                content: session.policyBoundaryLabel,
                key: 'policy',
                label: '运行边界',
              },
            ]}
          />
          {renderResult(session)}
          {renderOperatorDecision(session)}
        </div>
      );
    };
  },
});
