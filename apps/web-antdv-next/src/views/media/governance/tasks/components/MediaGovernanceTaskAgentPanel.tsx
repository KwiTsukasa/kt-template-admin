import type { PropType, VNodeChild } from 'vue';

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
  emits: ['candidateChange', 'openConversation', 'reasonChange', 'submit'],
  setup(props, { emit }) {
    /**
     * 将 Agent 结构化结论状态映射为中文标签。
     *
     * @param status - Agent 结构化结论状态；缺失时按未产出结果展示。
     * @returns approved、rejected、blocked 对应的中文结论文本。
     */
    function resultStatusLabel(
      status: NonNullable<MediaGovernanceApi.AgentSession['result']>['status'],
    ) {
      const labels = {
        blocked: '本轮受阻',
        'conversation-response': '会话答复',
        'plan-submitted': '密封计划已提交',
        'requires-operator': '等待人工选择候选',
      };
      return labels[status];
    }

    /**
     * 渲染 Agent 当前回合的结构化结论或等待提示。
     *
     * @param session - 需要渲染结构化结论或操作员决策的 Agent 会话。
     * @returns Agent 结构化结论卡片；会话尚无结论时返回 null。
     */
    function renderResult(session: MediaGovernanceApi.AgentSession) {
      const result = session.result;
      if (!result) {
        const running = session.status === 'running';
        let description =
          '请刷新 CodexAgent 标签页重新读取这个回合的历史结果。';
        let title = '尚未读取到本轮结论';
        let type = 'warning';
        if (running) {
          description = '本轮结束后会在这里自动展示结论、候选身份和后续动作。';
          title = 'Agent 会话正在执行';
          type = 'info';
        }
        return (
          <AAlert
            description={description}
            showIcon
            title={title}
            type={type}
          />
        );
      }
      let candidateContent: VNodeChild = '本轮无候选项';
      if (result.candidateSummaries.length > 0) {
        candidateContent = (
          <div class="grid gap-1">
            {result.candidateSummaries.map((summary) => (
              <div key={summary}>{summary}</div>
            ))}
          </div>
        );
      }
      let planStatus = '本轮未生成密封计划';
      if (result.planSha256) {
        planStatus = '已生成并绑定本轮结果';
      }
      return (
        <ADescriptions
          bordered
          column={1}
          items={[
            {
              content: resultStatusLabel(result.status),
              key: 'result-status',
              label: '结论状态',
            },
            {
              content: result.summary,
              key: 'result-summary',
              label: '会话结论',
            },
            {
              content: result.nextActionLabel,
              key: 'result-next-action',
              label: '后续动作',
            },
            {
              content: candidateContent,
              key: 'result-candidates',
              label: '候选身份',
            },
            {
              content: planStatus,
              key: 'result-plan',
              label: '密封计划',
            },
          ]}
          title="CodexAgent 本轮结构化结论"
        />
      );
    }

    /**
     * 当会话等待人工决策时渲染候选选择、依据输入与提交按钮。
     *
     * @param session - 需要渲染结构化结论或操作员决策的 Agent 会话。
     * @returns 人工决策候选与依据节点；无需人工决策时返回 null。
     */
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
          <div class="flex justify-end">
            <AButton onClick={() => emit('openConversation')} type="primary">
              进入本地 Codex 对话
            </AButton>
          </div>
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
