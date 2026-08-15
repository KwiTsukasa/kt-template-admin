import type { MediaGovernanceIntakeForm } from '../intake-contract';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { computed, defineComponent, ref } from 'vue';

import { Alert, Button, Drawer, message, Space, Tag } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMediaGovernanceTask,
  updateMediaGovernanceTaskIdentity,
} from '#/api/media-governance';

import {
  buildCreateTaskInput,
  buildIdentityPreview,
  buildUpdateTaskIdentityInput,
  validateIntakeForm,
} from '../intake-contract';

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
          componentProps: {
            options: MEDIA_TYPE_OPTIONS,
          },
          fieldName: 'mediaType',
          label: '作品类型',
          rules: 'selectRequired',
        },
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            placeholder: 'S00, S01',
          },
          dependencies: {
            if(values) {
              return values.mediaType === 'tv';
            },
            triggerFields: ['mediaType'],
          },
          fieldName: 'seasonText',
          help: '特别篇和番外篇使用 S00；执行前可修正，已失效的文件关联会自动移除。',
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
      return buildIdentityPreview(toIntakeForm(formValues.value));
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
      const intakeForm = toIntakeForm(values);
      const [validationError] = validateIntakeForm(intakeForm);
      if (validationError) {
        message.warning(validationError);
        return;
      }

      saving.value = true;
      try {
        let task: MediaGovernanceApi.Task;
        if (mode.value === 'create') {
          task = await createMediaGovernanceTask(
            buildCreateTaskInput(intakeForm),
          );
        } else {
          const currentTask = editingTask.value;
          if (!currentTask) {
            message.warning('当前任务已失效，请关闭后重新打开');
            return;
          }
          task = await updateMediaGovernanceTaskIdentity(
            currentTask.id,
            buildUpdateTaskIdentityInput(intakeForm, currentTask.revision),
          );
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
        destroyOnHidden
        mask={{ closable: !saving.value }}
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
              showIcon
              title="执行前可修正全部基础身份；类型或季号变化时，仅移除已经失效的文件关联。"
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

function toIntakeForm(values: TaskFormValues): MediaGovernanceIntakeForm {
  let releaseYear = '';
  if (values.releaseYear) releaseYear = String(values.releaseYear);
  return {
    mediaType: values.mediaType,
    provider: values.provider ?? '',
    providerId: values.providerId,
    releaseYear,
    seasonText: values.seasonText,
    titleHint: values.titleHint,
  };
}
