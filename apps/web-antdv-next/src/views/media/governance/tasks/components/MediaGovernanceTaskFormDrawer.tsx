import type { MediaGovernanceApi } from '#/api/media-governance';

import { computed, defineComponent, ref } from 'vue';

import { Alert, Button, Drawer, message, Space, Tag } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMediaGovernanceTask,
  updateMediaGovernanceTaskIdentity,
} from '#/api/media-governance';

import { parseSeasonNumbers } from '../intake-contract';

const AAlert = Alert as any;
const AButton = Button as any;
const ADrawer = Drawer as any;
const ASpace = Space as any;
const ATag = Tag as any;

type DrawerMode = 'create' | 'edit';

interface TaskFormValues {
  mediaType: MediaGovernanceApi.MediaType;
  provider?: MediaGovernanceApi.Provider;
  providerId: string;
  releaseYear?: null | number;
  seasonText: string;
  titleHint: string;
}

export interface MediaGovernanceTaskFormDrawerExposed {
  openCreate: () => void;
  openEdit: (task: MediaGovernanceApi.Task) => void;
}

const MEDIA_TYPE_OPTIONS = [
  { label: 'TV 正常剧集', value: 'tv' },
  { label: '电影', value: 'movie' },
  { label: '剧场版', value: 'theatrical' },
];
const PROVIDER_OPTIONS = [
  { label: 'TMDB', value: 'tmdb' },
  { label: 'TVDB', value: 'tvdb' },
  { label: 'Bangumi', value: 'bangumi' },
];

export default defineComponent({
  name: 'MediaGovernanceTaskFormDrawer',
  emits: ['saved'],
  setup(_, { emit, expose }) {
    const editingTask = ref<MediaGovernanceApi.Task>();
    const formValues = ref<TaskFormValues>(createDefaults());
    const mode = ref<DrawerMode>('create');
    const open = ref(false);
    const saving = ref(false);
    const [TaskForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-32 whitespace-nowrap',
      },
      handleValuesChange(values) {
        formValues.value = {
          ...formValues.value,
          ...(values as Partial<TaskFormValues>),
        };
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            maxlength: 200,
            placeholder: '例如：异世界迷宫黑心企业',
          },
          fieldName: 'titleHint',
          label: '作品名',
          rules: z.string().trim().min(1, '必须填写作品名').max(200),
        },
        {
          component: 'Select',
          componentProps: () => ({
            disabled: mode.value === 'edit',
            options: MEDIA_TYPE_OPTIONS,
          }),
          fieldName: 'mediaType',
          label: '作品类型',
          rules: 'selectRequired',
        },
        {
          component: 'Input',
          componentProps: () => ({
            allowClear: true,
            disabled: mode.value === 'edit',
            placeholder: 'S00, S01',
          }),
          dependencies: {
            if(values) {
              return values.mediaType === 'tv';
            },
            triggerFields: ['mediaType'],
          },
          fieldName: 'seasonText',
          help: '特别篇和番外篇使用 S00；创建后季号不可直接修改。',
          label: 'TV 季号',
        },
        {
          component: 'InputNumber',
          componentProps: {
            max: new Date().getFullYear() + 2,
            min: 1888,
            placeholder: '可选，例如 2024',
            style: { width: '100%' },
          },
          fieldName: 'releaseYear',
          help: '用于区分同名作品；不确定时请留空，错误年份会让候选身份偏移。',
          label: '首播/上映年份',
        },
        {
          component: 'Select',
          componentProps: {
            allowClear: true,
            options: PROVIDER_OPTIONS,
            placeholder: '不确定时留空',
          },
          fieldName: 'provider',
          label: '媒体资料库',
        },
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            maxlength: 64,
            placeholder: '例如：105476',
          },
          fieldName: 'providerId',
          help: '用于锁定唯一作品；必须与上方资料库成对填写，填错会关联到另一部作品。',
          label: '资料库作品编号',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const drawerTitle = computed(() =>
      mode.value === 'create' ? '新建媒体治理任务' : '编辑作品身份',
    );
    const identityPreview = computed(() => {
      const values = formValues.value;
      const seasons = parseSeasonNumbers(values.seasonText || '');
      const mediaTypeLabel =
        MEDIA_TYPE_OPTIONS.find((item) => item.value === values.mediaType)
          ?.label || '未选择类型';
      const unitLabel =
        values.mediaType === 'tv'
          ? seasons.join('、') || '尚未填写季号'
          : '电影单元（不使用 S00）';
      const providerLabel =
        values.provider && values.providerId.trim()
          ? `${PROVIDER_OPTIONS.find((item) => item.value === values.provider)?.label} · ${values.providerId.trim()}`
          : '资料库身份待核验';
      return `${values.titleHint.trim() || '尚未填写作品名'} · ${mediaTypeLabel} · ${unitLabel} · ${values.releaseYear || '年份待核验'} · ${providerLabel}`;
    });

    function openCreate() {
      mode.value = 'create';
      editingTask.value = undefined;
      const values = createDefaults();
      formValues.value = values;
      open.value = true;
      void resetForm(values);
    }

    function openEdit(task: MediaGovernanceApi.Task) {
      mode.value = 'edit';
      editingTask.value = task;
      const values: TaskFormValues = {
        mediaType: task.mediaType,
        provider: task.providerRef?.provider,
        providerId: task.providerRef?.providerId ?? '',
        releaseYear: task.releaseYear,
        seasonText: task.units
          .map((unit) => unit.seasonNumber)
          .filter(Boolean)
          .join(', '),
        titleHint: task.titleHint,
      };
      formValues.value = values;
      open.value = true;
      void resetForm(values);
    }

    async function resetForm(values: TaskFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    async function submit() {
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues<TaskFormValues>();
      const validationError = validateValues(values, mode.value);
      if (validationError) {
        message.warning(validationError);
        return;
      }

      saving.value = true;
      try {
        const providerRef =
          values.provider && values.providerId.trim()
            ? {
                provider: values.provider,
                providerId: values.providerId.trim(),
              }
            : null;
        let task: MediaGovernanceApi.Task;
        if (mode.value === 'create') {
          task = await createMediaGovernanceTask({
            mediaType: values.mediaType,
            providerRef: providerRef ?? undefined,
            releaseYear: values.releaseYear || undefined,
            seasonNumbers:
              values.mediaType === 'tv'
                ? parseSeasonNumbers(values.seasonText)
                : undefined,
            titleHint: values.titleHint.trim(),
          });
        } else {
          const currentTask = editingTask.value;
          if (!currentTask) {
            message.warning('当前任务已失效，请关闭后重新打开');
            return;
          }
          task = await updateMediaGovernanceTaskIdentity(currentTask.id, {
            expectedRevision: currentTask.revision,
            providerRef,
            releaseYear: values.releaseYear || null,
            titleHint: values.titleHint.trim(),
          });
        }
        message.success(
          mode.value === 'create' ? '任务草稿已创建' : '作品身份已更新',
        );
        open.value = false;
        emit('saved', task);
      } finally {
        saving.value = false;
      }
    }

    expose({
      openCreate,
      openEdit,
    } satisfies MediaGovernanceTaskFormDrawerExposed);

    return () => (
      <ADrawer
        destroyOnClose={false}
        maskClosable={!saving.value}
        onClose={() => {
          if (!saving.value) open.value = false;
        }}
        open={open.value}
        size="large"
        title={drawerTitle.value}
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
                  {mode.value === 'create' ? '创建任务草稿' : '保存身份修改'}
                </AButton>
              </ASpace>
            </div>
          ),
        }}
      >
        <div class="grid gap-4">
          {mode.value === 'edit' ? (
            <AAlert
              message="作品类型与季号已经生成治理单元，本次只修改名称、资料库身份和年份。"
              showIcon
              type="info"
            />
          ) : null}
          <TaskForm />
          <div class="rounded border border-solid border-border bg-muted/30 p-4">
            <div class="mb-2 flex items-center gap-2 font-medium">
              候选身份预览 <ATag color="warning">待资料源核验</ATag>
            </div>
            <div class="text-sm leading-6">{identityPreview.value}</div>
          </div>
        </div>
      </ADrawer>
    );
  },
});

function createDefaults(): TaskFormValues {
  return {
    mediaType: 'tv',
    provider: undefined,
    providerId: '',
    releaseYear: null,
    seasonText: 'S01',
    titleHint: '',
  };
}

function validateValues(values: TaskFormValues, mode: DrawerMode) {
  const hasProvider = Boolean(values.provider);
  const hasProviderId = Boolean(values.providerId.trim());
  if (hasProvider !== hasProviderId) {
    return '媒体资料库与作品编号必须成对填写；不确定时两项都留空。';
  }
  if (
    hasProviderId &&
    !/^[A-Z\d][\w.:-]{0,63}$/i.test(values.providerId.trim())
  ) {
    return '媒体资料库作品编号格式不正确。';
  }
  if (mode === 'edit') return undefined;
  const seasons = parseSeasonNumbers(values.seasonText || '');
  if (values.mediaType === 'tv' && seasons.length === 0) {
    return 'TV 正常剧集必须至少填写一个季号。';
  }
  if (values.mediaType !== 'tv' && seasons.length > 0) {
    return '电影和剧场版不填写季号，也不能用 S00 代替作品类型。';
  }
  if (
    seasons.some((season) => !/^S\d{2}$/.test(season)) ||
    new Set(seasons).size !== seasons.length
  ) {
    return '季号必须使用 S00、S01 这类格式，且不能重复。';
  }
  return undefined;
}
