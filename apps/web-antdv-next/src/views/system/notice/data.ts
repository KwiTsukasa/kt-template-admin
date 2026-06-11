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

export function getNoticeSeverityOptions() {
  return NOTICE_SEVERITY_OPTIONS;
}

export function getNoticeSourceOptions() {
  return NOTICE_SOURCE_OPTIONS;
}

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
