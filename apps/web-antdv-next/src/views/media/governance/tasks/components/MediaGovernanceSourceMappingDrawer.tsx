import type { TableColumnType } from 'antdv-next';

import type { EditableSourceFileMapping } from '../source-selection-contract';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { computed, defineComponent, ref } from 'vue';

import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  InputNumber,
  message,
  Select,
  Space,
  Tag,
} from 'antdv-next';

import {
  bindMediaGovernanceSubtitleContract,
  getMediaGovernanceTask,
  updateMediaGovernanceSourceSelection,
} from '#/api/media-governance';
import { KtTable } from '#/components/kt-table';

import {
  buildLinkedSubtitleContractPlans,
  buildSourceSelectionInput,
  inferSourceFileMappings,
} from '../source-selection-contract';

const AAlert = Alert as any;
const AButton = Button as any;
const ACheckbox = Checkbox as any;
const ADrawer = Drawer as any;
const AInputNumber = InputNumber as any;
const AKtTable = KtTable as any;
const ASelect = Select as any;
const ASpace = Space as any;
const ATag = Tag as any;

export interface MediaGovernanceSourceMappingDrawerExposed {
  open: (
    task: MediaGovernanceApi.Task,
    source: MediaGovernanceApi.Source,
  ) => void;
}

const FILE_ROLE_OPTIONS = [
  { label: '视频', value: 'video' },
  { label: '字幕', value: 'subtitle' },
  { label: '字体 / 字体包', value: 'font' },
];
const LANGUAGE_OPTIONS = [
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁体中文', value: 'zh-TW' },
  { label: '日语', value: 'ja' },
  { label: '英语', value: 'en' },
];

export default defineComponent({
  name: 'MediaGovernanceSourceMappingDrawer',
  emits: ['saved'],
  setup(_, { emit, expose }) {
    const errors = ref<string[]>([]);
    const open = ref(false);
    const rows = ref<EditableSourceFileMapping[]>([]);
    const saving = ref(false);
    const source = ref<MediaGovernanceApi.Source>();
    const task = ref<MediaGovernanceApi.Task>();
    const title = computed(
      () =>
        `配置逐文件治理映射 · ${source.value?.releaseGroup || '未命名来源'}`,
    );
    const manifestByIndex = computed(
      () =>
        new Map(
          (source.value?.manifest ?? []).map(
            (entry) => [entry.index, entry] as const,
          ),
        ),
    );
    const columns: Array<TableColumnType<EditableSourceFileMapping>> = [
      { key: 'selected', title: '选择', width: 64 },
      { ellipsis: false, key: 'file', minWidth: 360, title: '来源文件' },
      { key: 'fileRole', title: '治理角色', width: 150 },
      { key: 'unitId', title: '目标单元', width: 145 },
      { key: 'episodeText', title: '集号', width: 105 },
      { key: 'language', title: '字幕语言', width: 135 },
    ];

    /**
     * 根据任务与来源推断初始逐文件映射并打开抽屉。
     *
     * @param nextTask - 子抽屉或会话刷新后取得的最新媒体治理任务。
     * @param nextSource - 映射抽屉准备编辑的最新媒体来源快照。
     */
    function show(
      nextTask: MediaGovernanceApi.Task,
      nextSource: MediaGovernanceApi.Source,
    ) {
      task.value = nextTask;
      source.value = nextSource;
      rows.value = inferSourceFileMappings(nextTask, nextSource);
      errors.value = [];
      open.value = true;
    }

    /**
     * 按文件索引不可变地合并一行映射变更。
     *
     * @param index - 目标行或文件映射在当前数组中的零基索引。
     * @param patch - 要合并到指定文件映射行的字段补丁。
     */
    function updateRow(
      index: number,
      patch: Partial<EditableSourceFileMapping>,
    ) {
      rows.value = rows.value.map((row) => {
        if (row.index === index) return { ...row, ...patch };
        return row;
      });
    }

    /**
     * 切换文件角色并清理不再适用的集号或语言。
     *
     * @param row - 正在编辑角色、集号或单元映射的来源文件行。
     * @param fileRole - 文件在媒体治理中的视频、字幕或忽略角色。
     */
    function updateRole(
      row: EditableSourceFileMapping,
      fileRole: MediaGovernanceApi.SelectedFileRole,
    ) {
      let episodeText = row.episodeText;
      let language = row.language;
      if (fileRole === 'font') episodeText = '';
      if (fileRole !== 'subtitle') language = '';
      updateRow(row.index, {
        episodeText,
        fileRole,
        language,
        selected: true,
      });
    }

    /**
     * 校验并保存文件映射，随后逐单元密封字幕合同。
     */
    async function submit() {
      const currentTask = task.value;
      const currentSource = source.value;
      if (!currentTask || !currentSource) return;
      const selection = buildSourceSelectionInput(
        currentTask,
        currentSource,
        rows.value,
      );
      const linkedContracts = buildLinkedSubtitleContractPlans(
        currentTask,
        currentSource,
        selection.input,
      );
      errors.value = [...selection.errors, ...linkedContracts.errors];
      if (errors.value.length > 0) return;

      saving.value = true;
      try {
        await updateMediaGovernanceSourceSelection(
          currentTask.id,
          currentSource.id,
          selection.input,
        );
        let latestTask = await getMediaGovernanceTask(currentTask.id);
        for (const plan of linkedContracts.plans) {
          await bindMediaGovernanceSubtitleContract(
            latestTask.id,
            plan.unitId,
            {
              expectedEpisodeNumbers: plan.expectedEpisodeNumbers,
              expectedRevision: latestTask.revision,
              mappings: plan.mappings,
              releaseGroup: plan.releaseGroup,
              sourceId: plan.sourceId,
            },
          );
          latestTask = await getMediaGovernanceTask(currentTask.id);
        }
        let successMessage = '逐文件治理映射已保存';
        if (linkedContracts.plans.length > 0) {
          successMessage = '文件映射与逐季单一字幕源合同已密封';
        }
        message.success(successMessage);
        open.value = false;
        emit('saved');
      } finally {
        saving.value = false;
      }
    }

    /**
     * 按表格列渲染当前文件映射的编辑控件。
     *
     * @param key - 决定渲染文件路径、角色、集号或治理单元的列键。
     * @param row - 正在编辑角色、集号或单元映射的来源文件行。
     * @returns 对应列的编辑控件或文本节点；未接管列返回 undefined。
     */
    function renderCell(key: string, row: EditableSourceFileMapping) {
      const currentTask = task.value;
      const currentSource = source.value;
      if (!currentTask || !currentSource) return undefined;
      const manifest = manifestByIndex.value.get(row.index);
      if (key === 'selected') {
        return (
          <ACheckbox
            checked={row.selected}
            onChange={(event: { target: { checked: boolean } }) =>
              updateRow(row.index, { selected: event.target.checked })
            }
          />
        );
      }
      if (key === 'file') {
        return (
          <div class="grid gap-1">
            <span class="break-all">{manifest?.relativePath}</span>
            <span class="text-xs text-muted-foreground">
              {formatBytes(manifest?.sizeBytes ?? 0)} · 索引 {row.index}
            </span>
          </div>
        );
      }
      if (key === 'fileRole') {
        return (
          <ASelect
            disabled={!row.selected}
            onChange={(value: MediaGovernanceApi.SelectedFileRole) =>
              updateRole(row, value)
            }
            options={FILE_ROLE_OPTIONS.filter(
              (option) =>
                currentSource.sourceRole !== 'supplemental_subtitle' ||
                option.value !== 'video',
            )}
            placeholder="请选择"
            value={row.fileRole || undefined}
          />
        );
      }
      if (key === 'unitId') {
        return (
          <ASelect
            disabled={!row.selected || !row.fileRole}
            onChange={(value: string) =>
              updateRow(row.index, { unitId: value })
            }
            options={currentTask.units.map((unit) => ({
              label: unit.seasonNumber || '电影单元',
              value: unit.id,
            }))}
            placeholder="目标单元"
            value={row.unitId || undefined}
          />
        );
      }
      if (key === 'episodeText') {
        if (currentTask.mediaType !== 'tv' || row.fileRole === 'font') {
          return <span class="text-muted-foreground">不适用</span>;
        }
        return (
          <AInputNumber
            disabled={!row.selected || !row.fileRole}
            max={999}
            min={0}
            onChange={(value: null | number) =>
              updateEpisodeNumber(row.index, value)
            }
            placeholder="集号"
            precision={0}
            value={episodeInputValue(row)}
          />
        );
      }
      if (key === 'language') {
        if (row.fileRole !== 'subtitle') {
          return <span class="text-muted-foreground">不适用</span>;
        }
        return (
          <ASelect
            disabled={!row.selected}
            onChange={(value: MediaGovernanceApi.SubtitleLanguage) =>
              updateRow(row.index, { language: value })
            }
            options={LANGUAGE_OPTIONS}
            placeholder="字幕语言"
            value={row.language || undefined}
          />
        );
      }
      return undefined;
    }

    expose({ open: show } satisfies MediaGovernanceSourceMappingDrawerExposed);

    /**
     * 将数值集号转换为映射草稿使用的文本值。
     *
     * @param index - 目标行或文件映射在当前数组中的零基索引。
     * @param value - 用户输入的集号文本；空文本会清除映射集号。
     */
    function updateEpisodeNumber(index: number, value: null | number) {
      let episodeText = '';
      if (value !== null) episodeText = String(value);
      updateRow(index, { episodeText });
    }

    /**
     * 将映射草稿中的集号文本投影为数字输入值。
     *
     * @param row - 正在编辑角色、集号或单元映射的来源文件行。
     * @returns 可写入数字输入框的集号；空值或非法值为 undefined。
     */
    function episodeInputValue(row: EditableSourceFileMapping) {
      if (!row.episodeText) return undefined;
      return Number(row.episodeText);
    }

    /**
     * 当来源角色为补充字幕时展示单一发布组合同约束。
     *
     * @returns 补充字幕来源的合同提示节点；其他来源角色返回 null。
     */
    function renderSubtitleSourceNotice() {
      if (source.value?.sourceRole !== 'supplemental_subtitle') return null;
      return (
        <AAlert
          showIcon
          title={
            <span>
              当前字幕发布组：
              <ATag color="blue">
                {source.value.releaseGroup || '尚未填写'}
              </ATag>
              保存时会按季密封单一发布组合同。
            </span>
          }
          type="warning"
        />
      );
    }

    return () => (
      <ADrawer
        destroyOnHidden
        mask={{ closable: !saving.value }}
        onClose={() => {
          if (!saving.value) open.value = false;
        }}
        open={open.value}
        size="min(1400px, calc(100vw - 32px))"
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          },
        }}
        title={title.value}
        v-slots={{
          footer: () => (
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm text-muted-foreground">
                已选择 {rows.value.filter((row) => row.selected).length}/
                {rows.value.length} 个文件
              </span>
              <ASpace>
                <AButton
                  disabled={saving.value}
                  onClick={() => (open.value = false)}
                >
                  取消
                </AButton>
                <AButton
                  loading={saving.value}
                  onClick={() => void submit()}
                  type="primary"
                >
                  保存并密封映射
                </AButton>
              </ASpace>
            </div>
          ),
        }}
      >
        <div class="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div class="grid flex-none gap-4">
            <AAlert
              showIcon
              title="先确认每个文件的角色、季/电影单元、集号和字幕语言。特别篇不会根据文件名机械猜测集号。"
              type="info"
            />
            {errors.value.map((error) => (
              <AAlert key={error} showIcon title={error} type="error" />
            ))}
            {renderSubtitleSourceNotice()}
          </div>
          <div class="min-h-0 flex-1 overflow-hidden">
            <AKtTable
              columns={columns}
              dataSource={rows.value}
              immediate={false}
              rowKey="index"
              showDefaultButtons={false}
              showFooter={false}
              showHeader={false}
              showIndex={false}
              showPagination={false}
              showTableSetting={false}
              size="small"
              v-slots={{
                bodyCell: ({ column, record }: any) =>
                  renderCell(column.key, record),
              }}
              virtual
            />
          </div>
        </div>
      </ADrawer>
    );
  },
});

/**
 * 根据数值大小选择 B、KB、MB 或 GB，并保留合适的小数位。
 *
 * @param bytes - 需要换算为可读容量的字节数。
 * @returns 带 B、KB、MB 或 GB 单位的文件大小文本。
 */
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}
