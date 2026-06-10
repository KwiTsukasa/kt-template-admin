import type { VbenFormSchema } from '#/adapter/form';

import { z } from '#/adapter/form';
import { $t } from '#/locales';

export const NOTICE_LEVEL_OPTIONS = [
  { label: '普通', value: 1 },
  { label: '重要', value: 2 },
  { label: '紧急', value: 3 },
];

export const NOTICE_STATUS_OPTIONS = [
  { color: 'success', label: $t('common.enabled'), value: 1 },
  { color: 'default', label: $t('common.disabled'), value: 0 },
];

export function getNoticeStatusOptions() {
  return NOTICE_STATUS_OPTIONS;
}

export function useSearchSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
      },
      fieldName: 'keyword',
      label: $t('system.notice.keyword'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: NOTICE_LEVEL_OPTIONS,
      },
      fieldName: 'level',
      label: $t('system.notice.level'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: NOTICE_STATUS_OPTIONS,
      },
      fieldName: 'status',
      label: $t('system.notice.status'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.no'), value: 0 },
          { label: $t('common.yes'), value: 1 },
        ],
      },
      fieldName: 'isTop',
      label: $t('system.notice.top'),
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '如 系统公告',
      },
      fieldName: 'title',
      label: $t('system.notice.title'),
      rules: z
        .string()
        .min(1, $t('ui.formRules.required', [$t('system.notice.title')]))
        .max(
          120,
          $t('ui.formRules.maxLength', [$t('system.notice.title'), 120]),
        ),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '如 站内信内容概要',
      },
      fieldName: 'summary',
      label: $t('system.notice.summary'),
      rules: z
        .string()
        .max(
          200,
          $t('ui.formRules.maxLength', [$t('system.notice.summary'), 200]),
        ),
    },
    {
      component: 'TextArea',
      componentProps: {
        autoSize: {
          maxRows: 10,
          minRows: 4,
        },
        allowClear: true,
        placeholder: '请输入完整内容',
      },
      fieldName: 'content',
      label: $t('system.notice.content'),
      rules: z
        .string()
        .min(1, $t('ui.formRules.required', [$t('system.notice.content')])),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: NOTICE_LEVEL_OPTIONS,
      },
      fieldName: 'level',
      label: $t('system.notice.level'),
      defaultValue: 1,
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '逗号分隔，如：10001,10002，留空表示全部用户可见',
      },
      fieldName: 'notifyUsers',
      label: $t('system.notice.notifyUsers'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          {
            label: $t('system.notice.topNo'),
            value: false,
          },
          {
            label: $t('system.notice.topYes'),
            value: true,
          },
        ],
      },
      defaultValue: false,
      fieldName: 'isTop',
      label: $t('system.notice.top'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: NOTICE_STATUS_OPTIONS,
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.notice.status'),
    },
  ];
}
