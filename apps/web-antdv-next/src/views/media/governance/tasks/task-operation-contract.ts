import type { MediaGovernanceApi } from '#/api/media-governance';

export type MediaGovernanceTaskOperationKey =
  | 'add-source'
  | 'cancel-download'
  | 'configure-source'
  | 'inspect-source'
  | 'pause-download'
  | 'probe-source'
  | 'resume-download'
  | 'start-acceptance'
  | 'start-agent'
  | 'start-download'
  | 'start-governance'
  | 'start-metadata-repair'
  | 'start-metadata-verification';

export interface MediaGovernanceTaskOperation {
  danger?: boolean;
  key: MediaGovernanceTaskOperationKey;
  label: string;
  permissionCode: string;
  sourceId?: string;
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

function operation(
  key: MediaGovernanceTaskOperationKey,
  label: string,
  permissionCode: string,
  sourceId?: string,
  danger = false,
): MediaGovernanceTaskOperation {
  return { danger, key, label, permissionCode, sourceId };
}
