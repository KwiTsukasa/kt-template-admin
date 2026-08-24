import type { MediaGovernanceApi } from '#/api/media-governance';

export type MediaGovernanceTaskOperationKey =
  | 'add-source'
  | 'cancel-download'
  | 'configure-source'
  | 'discard-task'
  | 'inspect-source'
  | 'pause-download'
  | 'probe-source'
  | 'replace-source'
  | 'resume-download'
  | 'start-acceptance'
  | 'start-agent'
  | 'start-download'
  | 'start-governance'
  | 'start-metadata-repair'
  | 'start-metadata-verification';

export interface MediaGovernanceTaskOperation {
  confirmation?: {
    description: string;
    title: string;
  };
  danger?: boolean;
  key: MediaGovernanceTaskOperationKey;
  label: string;
  permissionCode: string;
  sourceId?: string;
}

/**
 * 根据任务是否拥有本地账本记录生成不同强度的删除确认文案。
 *
 * @param task - 提供标题与可选本地账本标识的待删除任务。
 * @returns 包含删除标题、影响说明和确认按钮文本的配置。
 */
export function getDiscardConfirmation(task: MediaGovernanceApi.Task) {
  const messages = [
    `确认删除任务「${task.titleHint}」吗？`,
    '本操作会删除任务、来源配置和数据库中的未执行记录。',
  ];
  if (task.workItemId) {
    messages.push(`同时清除绑定的本地账本 ${task.workItemId}。`);
  }
  return messages.join('');
}

/**
 * 读取任务不可删除原因，并为缺失投影提供兜底文案。
 *
 * @param task - 提供删除许可投影与禁用原因的任务快照。
 * @returns 任务不可删除的原因；操作可用时为 undefined。
 */
export function getDiscardDisabledReason(task: MediaGovernanceApi.Task) {
  if (task.semanticProjection.discardAllowed) return undefined;
  const reason = task.semanticProjection.discardReasonLabel?.trim();
  if (reason) return reason;
  return '当前任务不能删除。';
}

/**
 * 仅当任务操作投影包含 discard 时允许删除。
 *
 * @param task - 要检查删除许可投影的任务快照。
 * @returns 任务操作投影允许 discard 时为 true。
 */
export function canDiscardMediaGovernanceTask(task: MediaGovernanceApi.Task) {
  return !getDiscardDisabledReason(task);
}

/**
 * 仅当操作投影包含启动或重试 Agent 时允许执行。
 *
 * @param task - 要检查阶段与 Agent 会话失败状态的任务快照。
 * @returns 任务允许首次启动或重试 Agent 时为 true。
 */
export function canStartMediaGovernanceAgent(task: MediaGovernanceApi.Task) {
  return task.stage !== 'closed' && !task.llmConversationId;
}

/**
 * 仅当任务已有 Agent 会话或可操作投影时允许进入会话。
 *
 * @param task - 要检查是否存在可进入 Agent 会话的任务快照。
 * @returns 任务已有会话或具备 Agent 操作入口时为 true。
 */
export function canOpenMediaGovernanceAgent(task: MediaGovernanceApi.Task) {
  return Boolean(task.llmConversationId);
}

/**
 * 根据是否已有会话生成首次启动或安全重试的确认文案。
 *
 * @param task - 提供标题及既有 Agent 会话状态的任务快照。
 * @returns 首次启动或安全重试 Agent 对应的确认配置。
 */
export function getAgentStartConfirmation(task: MediaGovernanceApi.Task) {
  return `为「${task.titleHint}」创建一条本地 Codex 对话吗？媒体任务只保存 LLM conversationId，模型、消息、流式状态和 Codex thread 均由大模型模块统一管理。`;
}

/**
 * 根据接收阶段已有来源决定下一种可添加角色。
 *
 * @param task - 提供接收阶段、运行状态和已有来源的任务快照。
 * @returns 下一种允许添加的来源角色；当前阶段不可添加时为 null。
 */
export function getAddableSourceRole(
  task: MediaGovernanceApi.Task,
): MediaGovernanceApi.SourceRole | null {
  if (task.stage !== 'intake' || task.activeRunId !== null) return null;
  const primary = task.sources.find(
    (source) => source.sourceRole === 'primary_media',
  );
  if (!primary) return 'primary_media';
  if (
    primary.contentKind === 'subtitleless_media' &&
    !task.sources.some(
      (source) => source.sourceRole === 'supplemental_subtitle',
    )
  ) {
    return 'supplemental_subtitle';
  }
  return null;
}

/**
 * 通过选中文件数与逐文件角色、单元映射核对来源是否完整。
 *
 * @param source - 要核对已选文件数量与逐文件映射的媒体治理来源。
 * @returns 全部选中文件拥有合法角色与治理单元映射时为 true。
 */
export function hasCompleteSourceMapping(source: MediaGovernanceApi.Source) {
  if (
    source.selectedFileCount === 0 ||
    source.selectedFileMappings.length !== source.selectedFileCount
  ) {
    return false;
  }
  const selected = new Set(source.selectedFileIndices);
  return source.selectedFileMappings.every((mapping) =>
    selected.has(mapping.index),
  );
}

/**
 * 根据任务阶段、运行态与来源状态投影下一步可执行操作。
 *
 * @param task - 提供阶段、运行状态、来源和语义投影的操作决策任务快照。
 * @returns 当前阶段、权限前置条件和来源状态允许展示的操作数组。
 */
export function getMediaGovernanceTaskOperations(
  task: MediaGovernanceApi.Task,
): MediaGovernanceTaskOperation[] {
  if (task.stage === 'closed') return [];

  if (task.activeRunId) {
    if (task.stage !== 'download') return [];
    if (task.runState === 'running') {
      return [
        operation(
          'pause-download',
          '安全暂停下载',
          'Media:Governance:Download',
        ),
        operation(
          'cancel-download',
          '取消下载并保留清理入口',
          'Media:Governance:Download',
          undefined,
          true,
        ),
      ];
    }
    if (task.runState === 'blocked') {
      return [
        operation('resume-download', '继续原下载', 'Media:Governance:Download'),
        operation(
          'cancel-download',
          '取消下载并准备换源',
          'Media:Governance:Download',
          undefined,
          true,
        ),
      ];
    }
    return [];
  }

  if (task.metadataStatus === 'requires-agent') {
    if (
      task.nextCommandLabel.includes('有界元数据修复') ||
      task.nextCommandLabel.includes('自动补齐')
    ) {
      return [
        operation(
          'start-metadata-repair',
          task.nextCommandLabel,
          'Media:Governance:Run',
        ),
      ];
    }
    if (
      !task.nextCommandLabel.includes('重新采集') &&
      !task.llmConversationId
    ) {
      return [
        operation(
          'start-agent',
          agentOperationLabel(task),
          'Media:Governance:AgentStart',
        ),
      ];
    }
  }

  if (task.stage === 'intake' && task.runState === 'blocked') {
    return blockedIntakeOperations(task);
  }

  if (task.stage === 'intake') {
    const addableRole = getAddableSourceRole(task);
    if (addableRole) {
      return [
        operation(
          'add-source',
          addSourceOperationLabel(addableRole),
          'Media:Governance:SourceUpload',
        ),
      ];
    }
    const pendingInspection = task.sources.find(
      (source) => source.manifestState === 'pending-inspection',
    );
    if (pendingInspection) {
      return [
        operation(
          'inspect-source',
          '检查来源文件清单',
          'Media:Governance:SourceUpload',
          pendingInspection.id,
        ),
      ];
    }
    const unmapped = task.sources.find(
      (source) => !hasCompleteSourceMapping(source),
    );
    if (unmapped) {
      return [
        operation(
          'configure-source',
          '配置逐文件治理映射',
          'Media:Governance:SourceUpload',
          unmapped.id,
        ),
      ];
    }
    if (task.governanceProfile === 'sidecar-linked') {
      const supplemental = task.sources.find(
        (source) => source.sourceRole === 'supplemental_subtitle',
      );
      if (
        supplemental &&
        task.units.some((unit) => unit.subtitleContract === null)
      ) {
        return [
          operation(
            'configure-source',
            '密封逐季字幕合同',
            'Media:Governance:SourceUpload',
            supplemental.id,
          ),
        ];
      }
    }
    const unchecked = task.sources.find(
      (source) => source.sourceHealth !== 'viable',
    );
    if (unchecked) {
      return [
        operation(
          'probe-source',
          '运行死种 / 死链校验',
          'Media:Governance:Download',
          unchecked.id,
        ),
      ];
    }
    return [
      operation(
        'start-download',
        '开始 NAS 隔离下载',
        'Media:Governance:Download',
      ),
    ];
  }

  if (
    task.stage === 'download' &&
    (task.runState === 'succeeded' ||
      (task.runState === 'blocked' && task.payloadSeal !== null))
  ) {
    return [
      operation(
        'start-governance',
        governanceOperationLabel(task),
        'Media:Governance:Run',
      ),
    ];
  }

  if (
    task.stage === 'governance' &&
    task.runState === 'blocked' &&
    task.sealedPlan !== null
  ) {
    return [
      operation(
        'start-governance',
        '从密封计划重试本地治理',
        'Media:Governance:Run',
      ),
    ];
  }

  if (
    task.stage === 'metadata' &&
    ((task.runState === 'succeeded' && task.metadataStatus === 'pending') ||
      task.nextCommandLabel.includes('重新采集'))
  ) {
    return [
      operation(
        'start-metadata-verification',
        task.nextCommandLabel,
        'Media:Governance:Run',
      ),
    ];
  }

  if (
    task.stage === 'metadata' &&
    task.runState === 'succeeded' &&
    task.metadataStatus === 'verified'
  ) {
    return [
      operation(
        'start-acceptance',
        task.nextCommandLabel,
        'Media:Governance:Run',
      ),
    ];
  }

  return [];
}

/**
 * 根据既有会话状态生成 Agent 启动操作文案。
 *
 * @param task - 提供 Agent 会话失败状态、用于选择启动或重试文案的任务。
 * @returns 首次启动或安全重试 Agent 的操作文本。
 */
function agentOperationLabel(task: MediaGovernanceApi.Task) {
  if (task.llmConversationId) return '进入本地 Codex 对话';
  return '创建本地 Codex 对话';
}

/**
 * 根据可添加来源角色生成操作文案。
 *
 * @param sourceRole - 当前允许添加的主媒体或补充字幕来源角色。
 * @returns 添加主源、替换源或补充字幕的操作文本。
 */
function addSourceOperationLabel(sourceRole: MediaGovernanceApi.SourceRole) {
  if (sourceRole === 'primary_media') return '添加主媒体来源';
  return '补充整季字幕来源';
}

/**
 * 根据运行状态生成治理启动或重试文案。
 *
 * @param task - 提供运行状态、用于选择治理启动或重试文案的任务。
 * @returns 启动治理或重试治理的操作文本。
 */
function governanceOperationLabel(task: MediaGovernanceApi.Task) {
  if (task.runState === 'blocked') return '修正后重试本地治理';
  return '开始本地治理';
}

/**
 * 当接收阶段受阻时组装换源、重映射和删除操作。
 *
 * @param task - 处于接收阻塞阶段、需要生成恢复操作的任务快照。
 * @returns 接收阶段受阻时可执行的换源、重映射与删除操作。
 */
function blockedIntakeOperations(task: MediaGovernanceApi.Task) {
  const operations: MediaGovernanceTaskOperation[] = [];
  let source = task.sources.find(
    (candidate) => candidate.sourceHealthLabel === '来源检查失败',
  );
  if (!source) {
    source = task.sources.find(
      (candidate) => candidate.manifestState === 'pending-inspection',
    );
  }
  if (!source) source = task.sources[0];
  if (source) {
    operations.push(
      operation(
        'replace-source',
        '重新填写种子 / 磁链',
        'Media:Governance:SourceUpload',
        source.id,
        true,
        {
          description:
            '旧来源会先按任务边界精确清理；完成后自动打开现有来源表单，可重新选择磁链或种子文件。',
          title: '确认更换当前来源？',
        },
      ),
    );
    if (source.manifestState === 'inspected') {
      operations.push(
        operation(
          'configure-source',
          '重新编辑文件清单',
          'Media:Governance:SourceUpload',
          source.id,
        ),
      );
    }
  } else {
    const sourceRole = getAddableSourceRole(task);
    if (sourceRole) {
      operations.push(
        operation(
          'add-source',
          addSourceOperationLabel(sourceRole),
          'Media:Governance:SourceUpload',
        ),
      );
    }
  }
  if (task.semanticProjection.discardAllowed) {
    operations.push(
      operation(
        'discard-task',
        '删除任务',
        'Media:Governance:Create',
        undefined,
        true,
        {
          description:
            '删除任务、来源配置、未执行记录，并清除已绑定的本地账本编号。',
          title: '确认删除这个任务？',
        },
      ),
    );
  }
  return operations;
}

/**
 * 根据操作键、权限、来源与确认信息创建任务操作描述。
 *
 * @param key - 媒体治理操作的稳定键。
 * @param label - 任务操作向用户展示的文本。
 * @param permissionCode - 执行媒体治理操作要求的权限码。
 * @param sourceId - 目标媒体治理来源的稳定标识。
 * @param danger - 是否以危险操作样式展示按钮；未传入时使用 `false`。
 * @param confirmation - 操作执行前展示的确认标题与正文；无确认要求时为空。
 * @returns 包含键、文案、权限码、可选来源与确认配置的任务操作。
 */
function operation(
  key: MediaGovernanceTaskOperationKey,
  label: string,
  permissionCode: string,
  sourceId?: string,
  danger = false,
  confirmation?: MediaGovernanceTaskOperation['confirmation'],
): MediaGovernanceTaskOperation {
  return { confirmation, danger, key, label, permissionCode, sourceId };
}
