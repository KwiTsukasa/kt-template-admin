import type { MediaGovernanceApi } from '#/api/media-governance';

export type MediaGovernanceTaskOperationKey =
  | 'add-source'
  | 'cancel-download'
  | 'configure-source'
  | 'discard-task'
  | 'edit-task'
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

export function getDiscardDisabledReason(task: MediaGovernanceApi.Task) {
  if (task.semanticProjection.discardAllowed) return undefined;
  const reason = task.semanticProjection.discardReasonLabel?.trim();
  if (reason) return reason;
  return '当前任务不能删除。';
}

export function canDiscardMediaGovernanceTask(task: MediaGovernanceApi.Task) {
  return !getDiscardDisabledReason(task);
}

export function canStartMediaGovernanceAgent(task: MediaGovernanceApi.Task) {
  return (
    task.stage !== 'closed' &&
    (!task.agentSession || task.agentSession.status === 'failed')
  );
}

export function canOpenMediaGovernanceAgent(task: MediaGovernanceApi.Task) {
  return (
    task.stage !== 'closed' &&
    Boolean(task.agentSession && task.agentSession.status !== 'failed')
  );
}

export function getAgentStartConfirmation(task: MediaGovernanceApi.Task) {
  let action = '启动';
  if (task.agentSession?.status === 'failed') {
    action = '重新启动';
  }
  return `${action}「${task.titleHint}」的 CodexAgent 治理任务吗？Agent 将读取当前阶段的任务事实并按五层边界开始治理，不会直接写入正式媒体、云端或数据库。`;
}

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
      (!task.agentSession || task.agentSession.status === 'failed')
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

function agentOperationLabel(task: MediaGovernanceApi.Task) {
  if (task.agentSession?.status === 'failed') return '安全重试 CodexAgent';
  return '启动 CodexAgent 人工治理';
}

function addSourceOperationLabel(sourceRole: MediaGovernanceApi.SourceRole) {
  if (sourceRole === 'primary_media') return '添加主媒体来源';
  return '补充整季字幕来源';
}

function governanceOperationLabel(task: MediaGovernanceApi.Task) {
  if (task.runState === 'blocked') return '修正后重试本地治理';
  return '开始本地治理';
}

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
  operations.push(
    operation('edit-task', '重新编辑任务信息', 'Media:Governance:Create'),
  );
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
