import type { UploadFile } from 'antdv-next';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { computed, defineComponent, ref } from 'vue';

import { Alert, Button, Drawer, message, Space, Upload } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import {
  addMediaGovernanceMagnetSource,
  uploadMediaGovernanceTorrentSource,
} from '#/api/media-governance';

import { getAddableSourceRole } from '../task-operation-contract';

const AAlert = Alert as any;
const AButton = Button as any;
const ADrawer = Drawer as any;
const ASpace = Space as any;
const AUploadDragger = Upload.Dragger as any;

interface SourceFormValues {
  contentKind: MediaGovernanceApi.ContentKind;
  magnetUri: string;
  releaseGroup: string;
  seasonNumbers: string[];
  sourceRole: MediaGovernanceApi.SourceRole;
  transportKind: 'magnet' | 'torrent';
}

export interface MediaGovernanceSourceFormDrawerExposed {
  open: (task: MediaGovernanceApi.Task) => void;
}

const PRIMARY_CONTENT_KIND_OPTIONS = [
  { label: '媒体已内嵌可切换字幕', value: 'embedded_subtitle_media' },
  { label: '媒体已烧录中文字幕', value: 'burned_in_subtitle_media' },
  { label: '媒体包内含外挂字幕', value: 'bundled_sidecar_media' },
  { label: '媒体无字幕，需要补充字幕来源', value: 'subtitleless_media' },
];

export default defineComponent({
  name: 'MediaGovernanceSourceFormDrawer',
  emits: ['saved'],
  setup(_, { emit, expose }) {
    const fileList = ref<UploadFile[]>([]);
    const open = ref(false);
    const saving = ref(false);
    const task = ref<MediaGovernanceApi.Task>();
    const values = ref<SourceFormValues>(createDefaults('primary_media', []));
    const [SourceForm, formApi] = useVbenForm({
      commonConfig: { labelClass: 'w-32 whitespace-nowrap' },
      /**
       * 将表单局部变化合并进来源草稿状态。
       *
       * @param changedValues - 来源表单本次变化的字段补丁。
       */
      handleValuesChange(changedValues) {
        values.value = {
          ...values.value,
          ...(changedValues as Partial<SourceFormValues>),
        };
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'RadioGroup',
          componentProps: {
            buttonStyle: 'solid',
            optionType: 'button',
            options: [
              { label: '磁力链接', value: 'magnet' },
              { label: '种子文件', value: 'torrent' },
            ],
          },
          fieldName: 'transportKind',
          label: '来源方式',
          rules: 'selectRequired',
        },
        {
          component: 'Select',
          componentProps: () => ({
            disabled: true,
            options: [
              { label: '主媒体来源', value: 'primary_media' },
              { label: '补充字幕来源', value: 'supplemental_subtitle' },
            ],
          }),
          fieldName: 'sourceRole',
          label: '来源用途',
          rules: 'selectRequired',
        },
        {
          component: 'Select',
          componentProps: () => ({ options: contentKindOptions(values.value) }),
          fieldName: 'contentKind',
          help: '治理类型由主媒体真实字幕形态确定，后续下载和目录治理会严格沿用。',
          label: '内容类型',
          rules: 'selectRequired',
        },
        {
          component: 'Select',
          componentProps: () => ({
            mode: 'multiple',
            options: (task.value?.units ?? []).map((unit) => ({
              label: unit.seasonNumber || '电影单元',
              value: unit.seasonNumber || 'MOVIE',
            })),
          }),
          dependencies: {
            if: () => task.value?.mediaType === 'tv',
            triggerFields: ['sourceRole'],
          },
          fieldName: 'seasonNumbers',
          help: '字幕按季保持单一发布组；特别篇与番外篇使用 S00。',
          label: '覆盖季号',
        },
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            maxlength: 120,
            placeholder: '例如：DBD-Raws',
          },
          fieldName: 'releaseGroup',
          help: '必须填写真实发布组，用于阻止同一季混用多个字幕来源。',
          label: '发布组',
          rules: z.string().trim().min(1, '必须填写发布组').max(120),
        },
        {
          component: 'Textarea',
          componentProps: {
            allowClear: true,
            autoSize: { maxRows: 6, minRows: 4 },
            maxlength: 4096,
            placeholder: 'magnet:?xt=urn:btih:...',
          },
          dependencies: {
            if: (current) => current.transportKind === 'magnet',
            triggerFields: ['transportKind'],
          },
          fieldName: 'magnetUri',
          help: '服务端只保存脱敏描述和 info-hash，不向页面回显追踪器或私密参数。',
          label: '磁力链接',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const title = computed(() => sourceDrawerTitle(values.value.sourceRole));

    /**
     * 按任务当前可新增角色初始化并打开来源抽屉。
     *
     * @param nextTask - 子抽屉或会话刷新后取得的最新媒体治理任务。
     */
    async function show(nextTask: MediaGovernanceApi.Task) {
      const sourceRole = getAddableSourceRole(nextTask);
      if (!sourceRole) {
        message.warning('当前任务没有可新增的来源角色');
        return;
      }
      task.value = nextTask;
      const defaults = createDefaults(
        sourceRole,
        nextTask.units.flatMap((unit) => {
          if (unit.seasonNumber) return [unit.seasonNumber];
          return [];
        }),
      );
      values.value = defaults;
      fileList.value = [];
      open.value = true;
      await formApi.resetForm();
      await formApi.setValues(defaults);
      await formApi.resetValidate();
    }

    /**
     * 在本地校验种子文件扩展名与大小并阻止自动上传。
     *
     * @param file - 用户在来源表单中选择的 torrent 文件；函数会阻止 Upload 自动提交。
     * @returns 始终返回 Upload.LIST_IGNORE，阻止组件自动上传；无效文件会先提示错误。
     */
    function beforeUpload(file: File) {
      if (!file.name.toLowerCase().endsWith('.torrent')) {
        message.warning('只能上传 .torrent 种子描述文件');
        return Upload.LIST_IGNORE;
      }
      if (file.size > 2 * 1024 * 1024) {
        message.warning('种子描述文件不能超过 2 MiB');
        return Upload.LIST_IGNORE;
      }
      return false;
    }

    /**
     * 只保留用户最后选择的一个种子文件。
     *
     * @param info - Antdv Upload 最新文件列表事件数据。
     */
    function handleUploadChange(info: { fileList: UploadFile[] }) {
      fileList.value = info.fileList.slice(-1);
    }

    /**
     * 校验来源草稿并按传输类型提交磁链或种子文件。
     */
    async function submit() {
      const currentTask = task.value;
      if (!currentTask) return;
      const { valid } = await formApi.validate();
      if (!valid) return;
      const formValues = await formApi.getValues<SourceFormValues>();
      const validationError = validateSourceValues(currentTask, formValues);
      if (validationError) {
        message.warning(validationError);
        return;
      }
      const input: MediaGovernanceApi.SourceClassificationInput = {
        contentKind: formValues.contentKind,
        expectedRevision: currentTask.revision,
        releaseGroup: formValues.releaseGroup.trim(),
        seasonNumbers: selectedSeasonNumbers(currentTask, formValues),
        sourceRole: formValues.sourceRole,
      };
      saving.value = true;
      try {
        if (formValues.transportKind === 'magnet') {
          await addMediaGovernanceMagnetSource(currentTask.id, {
            ...input,
            magnetUri: formValues.magnetUri.trim(),
          });
        } else {
          const file = fileList.value[0]?.originFileObj as File | undefined;
          if (!file) {
            message.warning('请选择一个 .torrent 种子描述文件');
            return;
          }
          await uploadMediaGovernanceTorrentSource(currentTask.id, file, input);
        }
        message.success('来源已添加，请继续完成清单检查与逐文件映射');
        open.value = false;
        emit('saved');
      } finally {
        saving.value = false;
      }
    }

    expose({ open: show } satisfies MediaGovernanceSourceFormDrawerExposed);

    /**
     * 仅在种子来源模式下渲染本地文件选择区。
     *
     * @returns 包含种子文件限制、当前文件和移除入口的上传控件。
     */
    function renderTorrentUpload() {
      if (values.value.transportKind !== 'torrent') return null;
      return (
        <div class="grid gap-2">
          <div class="font-medium">种子描述文件</div>
          <AUploadDragger
            accept=".torrent,application/x-bittorrent"
            beforeUpload={beforeUpload}
            fileList={fileList.value}
            maxCount={1}
            onChange={handleUploadChange}
            onRemove={() => {
              fileList.value = [];
              return true;
            }}
          >
            <div class="py-5 text-center">
              点击或拖入一个 .torrent 文件
              <div class="mt-1 text-sm text-muted-foreground">
                最大 2 MiB；浏览器不会自动上传，提交后由 API 安全解析。
              </div>
            </div>
          </AUploadDragger>
        </div>
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
        size="large"
        title={title.value}
        v-slots={{
          footer: () => (
            <div class="flex justify-end">
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
                  添加来源
                </AButton>
              </ASpace>
            </div>
          ),
        }}
      >
        <div class="grid gap-4">
          <AAlert
            showIcon
            title="来源只进入任务隔离目录；完成映射、死种校验并显式开始后，才会在 NAS 内下载。"
            type="info"
          />
          <SourceForm />
          {renderTorrentUpload()}
        </div>
      </ADrawer>
    );
  },
});

/**
 * 根据来源角色与任务季号创建磁力或种子表单默认值。
 *
 * @param sourceRole - 决定默认内容形态与来源角色的主媒体或补充字幕类型。
 * @param seasonNumbers - 新来源默认覆盖的季号文本集合。
 * @returns 含来源角色、内容形态、覆盖季号和空磁力/种子值的表单。
 */
function createDefaults(
  sourceRole: MediaGovernanceApi.SourceRole,
  seasonNumbers: string[],
): SourceFormValues {
  let contentKind: MediaGovernanceApi.ContentKind = 'embedded_subtitle_media';
  if (sourceRole === 'supplemental_subtitle') {
    contentKind = 'sidecar_subtitle_package';
  }
  return {
    contentKind,
    magnetUri: '',
    releaseGroup: '',
    seasonNumbers,
    sourceRole,
    transportKind: 'magnet',
  };
}

/**
 * 根据来源用途返回允许选择的内容类型。
 *
 * @param values - 来源表单当前的磁力、种子、角色和季号字段。
 * @returns 符合来源角色与任务类型约束的内容形态选项。
 */
function contentKindOptions(values: SourceFormValues) {
  if (values.sourceRole === 'supplemental_subtitle') {
    return [{ label: '整季外挂字幕包', value: 'sidecar_subtitle_package' }];
  }
  return PRIMARY_CONTENT_KIND_OPTIONS;
}

/**
 * 根据来源用途生成抽屉标题。
 *
 * @param sourceRole - 用于选择主媒体或补充字幕抽屉标题的来源角色。
 * @returns 主源、替换源或补充字幕对应的抽屉标题。
 */
function sourceDrawerTitle(sourceRole: MediaGovernanceApi.SourceRole) {
  if (sourceRole === 'supplemental_subtitle') return '补充整季字幕来源';
  return '添加主媒体来源';
}

/**
 * 仅为电视任务返回来源覆盖的季号。
 *
 * @param task - 提供电影或电视媒体类型、用于决定是否保留季号的任务。
 * @param values - 来源表单当前的磁力、种子、角色和季号字段。
 * @returns 电视任务选中的规范季号数组；电影任务为 undefined。
 */
function selectedSeasonNumbers(
  task: MediaGovernanceApi.Task,
  values: SourceFormValues,
) {
  if (task.mediaType === 'tv') return values.seasonNumbers;
  return undefined;
}

/**
 * 通过角色、内容形态、季号与磁力身份约束校验来源表单。
 *
 * @param task - 提供媒体类型和合法季号范围的目标任务快照。
 * @param values - 来源表单当前的磁力、种子、角色和季号字段。
 * @returns 校验失败时的首条错误文本；全部约束满足时为 undefined。
 */
function validateSourceValues(
  task: MediaGovernanceApi.Task,
  values: SourceFormValues,
) {
  if (
    values.sourceRole === 'supplemental_subtitle' &&
    values.contentKind !== 'sidecar_subtitle_package'
  ) {
    return '补充字幕来源只能选择整季外挂字幕包';
  }
  if (
    values.sourceRole === 'primary_media' &&
    values.contentKind === 'sidecar_subtitle_package'
  ) {
    return '主媒体来源不能选择纯字幕包';
  }
  if (task.mediaType === 'tv' && values.seasonNumbers.length === 0) {
    return 'TV 来源必须至少覆盖一个季号';
  }
  if (
    values.transportKind === 'magnet' &&
    !/^magnet:\?xt=urn:btih:[a-z\d]{32,40}(?:&|$)/iu.test(
      values.magnetUri.trim(),
    )
  ) {
    return '磁力链接必须包含有效的 BTIH 身份';
  }
  return undefined;
}
