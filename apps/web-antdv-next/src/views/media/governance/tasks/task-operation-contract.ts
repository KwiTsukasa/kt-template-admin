import type { MediaGovernanceApi } from '#/api/media-governance';

/**
 * 按业务闭环与运行状态决定进度样式，某一步达到百分之百不能冒充整个任务成功。
 * @param task - 包含权威业务阶段和运行状态的任务快照。
 * @returns 受阻为异常、闭环成功为成功，执行中为活动，其余为普通进度。
 */
export function getMediaGovernanceProgressStatus(
  task: Pick<MediaGovernanceApi.Task, 'runState' | 'stage'>,
): 'active' | 'exception' | 'normal' | 'success' {
  if (task.runState === 'blocked') return 'exception';
  if (task.stage === 'closed' && task.runState === 'succeeded')
    return 'success';
  if (task.runState === 'running' || task.runState === 'queued')
    return 'active';
  return 'normal';
}

export type MediaGovernanceTaskOperationKey =
  | 'add-source'
  | 'configure-source'
  | 'discard-task'
  | 'workflow';

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
 * 将媒体执行入口集中到绑定工作流，只保留来源编辑和未执行任务删除等业务数据操作。
 * @param task - 当前任务的阶段、来源与可删除投影。
 * @returns 工作流入口以及当前允许编辑的业务配置操作。
 */
export function getMediaGovernanceTaskOperations(
  task: MediaGovernanceApi.Task,
): MediaGovernanceTaskOperation[] {
  const operations: MediaGovernanceTaskOperation[] = [
    {
      key: 'workflow',
      label: '工作流',
      permissionCode: 'Media:Governance:List',
    },
  ];
  if (task.activeRunId || task.stage === 'closed') return operations;
  if (task.stage === 'intake') {
    const addableRole = getAddableSourceRole(task);
    if (addableRole) {
      let label = '添加主媒体来源';
      if (addableRole === 'supplemental_subtitle') label = '补充字幕来源';
      operations.push({
        key: 'add-source',
        label,
        permissionCode: 'Media:Governance:SourceUpload',
      });
    }
    const unmapped = task.sources.find(
      (source) =>
        source.manifestState === 'inspected' &&
        (!hasCompleteSourceMapping(source) ||
          (source.sourceRole === 'supplemental_subtitle' &&
            task.units.some((unit) => !unit.subtitleContract))),
    );
    if (unmapped)
      operations.push({
        key: 'configure-source',
        label: '配置文件映射',
        permissionCode: 'Media:Governance:SourceUpload',
        sourceId: unmapped.id,
      });
  }
  if (task.semanticProjection.discardAllowed)
    operations.push({
      key: 'discard-task',
      label: '删除任务',
      permissionCode: 'Media:Governance:Create',
      danger: true,
      confirmation: {
        title: '确认删除任务？',
        description: getDiscardConfirmation(task),
      },
    });
  return operations;
}
