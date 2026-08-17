import type { VbenFormSchema } from '#/adapter/form';

import { $t } from '#/locales';

export const NOTICE_SEVERITY_OPTIONS = [
  { color: 'blue', label: $t('system.notice.severityInfo'), value: 'info' },
  { color: 'orange', label: $t('system.notice.severityWarn'), value: 'warn' },
  { color: 'red', label: $t('system.notice.severityError'), value: 'error' },
  { color: 'purple', label: $t('system.notice.severityFatal'), value: 'fatal' },
];

export const NOTICE_SOURCE_OPTIONS = [
  { color: 'geekblue', label: $t('system.notice.sourceApi'), value: 'api' },
  { color: 'cyan', label: $t('system.notice.sourceQqbot'), value: 'qqbot' },
];

export const NOTICE_STATUS_OPTIONS = [
  { color: 'error', label: $t('system.notice.statusUnhandled'), value: 1 },
  { color: 'default', label: $t('system.notice.statusHandled'), value: 0 },
];

/**
 * 返回信息、警告、错误和致命四种通知严重程度选项，供筛选和表单共用。
 *
 * @returns 系统通知各严重程度的表单选项数组。
 */
export function getNoticeSeverityOptions() {
  return NOTICE_SEVERITY_OPTIONS;
}

/**
 * 返回 API 与 QQBot 两种通知来源选项，供筛选和表单共用。
 *
 * @returns 系统通知各来源类型的表单选项数组。
 */
export function getNoticeSourceOptions() {
  return NOTICE_SOURCE_OPTIONS;
}

/**
 * 返回未处理和已处理两种通知状态选项，供筛选和表单共用。
 *
 * @returns 系统通知各处理状态的表单选项数组。
 */
export function getNoticeStatusOptions() {
  return NOTICE_STATUS_OPTIONS;
}

/**
 * 生成系统通知的关键词、严重程度、状态、来源与事件类型字段，供搜索表单直接渲染。
 *
 * @returns 可直接渲染系统通知搜索表单的字段 Schema 列表。
 */
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
        options: NOTICE_SEVERITY_OPTIONS,
      },
      fieldName: 'severity',
      label: $t('system.notice.severity'),
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
        options: NOTICE_SOURCE_OPTIONS,
      },
      fieldName: 'source',
      label: $t('system.notice.source'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
      },
      fieldName: 'eventType',
      label: $t('system.notice.eventType'),
    },
  ];
}
