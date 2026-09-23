<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type { VbenFormSchema } from '#/adapter/form';

import { computed, h, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { $te } from '@vben/locales';
import { getPopupContainer } from '@vben/utils';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMenu,
  getMenuList,
  isMenuNameExists,
  isMenuPathExists,
  SystemMenuApi,
  updateMenu,
} from '#/api/system/menu';
import { $t } from '#/locales';
import { componentKeys } from '#/router/routes';

import { getMenuTypeOptions } from '../data';

type ChangeEvent = { target: { value?: string } };

const emit = defineEmits<{
  success: [];
}>();
const formData = ref<SystemMenuApi.SystemMenu>();
const titleSuffix = ref<string>();

/**
 * 为父级选择树投影已翻译标签，保留原始菜单标题与 id 供表单提交。
 * @param menus - 后端返回的原始菜单树。
 * @returns 每层节点附带展示标签、但原始 meta.title 和 id 不变的树。
 */
function translateParentOptions(
  menus: SystemMenuApi.SystemMenu[],
): SystemMenuApi.SystemMenu[] {
  return menus.map((menu) => {
    const option = {
      ...menu,
      displayTitle: $t(menu.meta?.title || ''),
    };
    if (menu.children) {
      option.children = translateParentOptions(menu.children);
    }
    return option;
  });
}
const schema: VbenFormSchema[] = [
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: getMenuTypeOptions(),
      optionType: 'button',
    },
    defaultValue: 'menu',
    fieldName: 'type',
    formItemClass: 'col-span-2 md:col-span-2',
    label: $t('system.menu.type'),
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: $t('system.menu.menuName'),
    rules: z
      .string()
      .min(2, $t('ui.formRules.minLength', [$t('system.menu.menuName'), 2]))
      .max(30, $t('ui.formRules.maxLength', [$t('system.menu.menuName'), 30]))
      .refine(
        async (value: string) => {
          return !(await isMenuNameExists(value, formData.value?.id));
        },
        (value) => ({
          message: $t('ui.formRules.alreadyExists', [
            $t('system.menu.menuName'),
            value,
          ]),
        }),
      ),
  },
  {
    component: 'ApiTreeSelect',
    componentProps: {
      api: getMenuList,
      afterFetch: translateParentOptions,
      class: 'w-full',
      /**
       * 同时用原始菜单键和翻译后的标签筛选父级节点，避免已选值与搜索词显示不一致。
       * @param input - 用户输入的父级搜索词。
       * @param node - 树选择器提供的当前候选节点。
       * @returns 原始键或展示标签包含搜索词时为 true。
       */
      filterTreeNode(input: string, node: Recordable<any>) {
        if (!input || input.length === 0) {
          return true;
        }
        const title: string = node.meta?.title ?? '';
        const label: string = node.label ?? '';
        return title.includes(input) || label.includes(input);
      },
      getPopupContainer,
      labelField: 'displayTitle',
      showSearch: true,
      treeDefaultExpandAll: true,
      valueField: 'id',
      childrenField: 'children',
    },
    fieldName: 'pid',
    label: $t('system.menu.parent'),
    /**
     * 向树节点提供图标和已翻译文字，不覆盖提交用的节点 id。
     * @returns 包含树节点标题插槽函数的对象。
     */
    renderComponentContent() {
      return {
        /**
         * 用投影后的标签渲染可选节点，避免再次翻译已完成的显示文字。
         * @returns 带可选图标的树节点标题。
         */
        title({ label, meta }: { label: string; meta: Recordable<any> }) {
          const coms = [];
          if (!label) return '';
          if (meta?.icon) {
            coms.push(h(IconifyIcon, { class: 'size-4', icon: meta.icon }));
          }
          coms.push(h('span', { class: '' }, label));
          return h('div', { class: 'flex items-center gap-1' }, coms);
        },
      };
    },
  },
  {
    component: 'Input',
    componentProps() {
      // 不需要处理多语言时就无需这么做
      return {
        ...(titleSuffix.value && { addonAfter: titleSuffix.value }),
        onChange({ target: { value } }: ChangeEvent) {
          titleSuffix.value = value && $te(value) ? $t(value) : undefined;
        },
      };
    },
    fieldName: 'meta.title',
    label: $t('system.menu.menuTitle'),
    rules: 'required',
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return ['catalog', 'embedded', 'menu'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'path',
    label: $t('system.menu.path'),
    rules: z
      .string()
      .min(2, $t('ui.formRules.minLength', [$t('system.menu.path'), 2]))
      .max(100, $t('ui.formRules.maxLength', [$t('system.menu.path'), 100]))
      .refine(
        (value: string) => {
          return value.startsWith('/');
        },
        $t('ui.formRules.startWith', [$t('system.menu.path'), '/']),
      )
      .refine(
        async (value: string) => {
          return !(await isMenuPathExists(value, formData.value?.id));
        },
        (value) => ({
          message: $t('ui.formRules.alreadyExists', [
            $t('system.menu.path'),
            value,
          ]),
        }),
      ),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return ['embedded', 'menu'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'activePath',
    help: $t('system.menu.activePathHelp'),
    label: $t('system.menu.activePath'),
    rules: z
      .string()
      .min(2, $t('ui.formRules.minLength', [$t('system.menu.path'), 2]))
      .max(100, $t('ui.formRules.maxLength', [$t('system.menu.path'), 100]))
      .refine(
        (value: string) => {
          return value.startsWith('/');
        },
        $t('ui.formRules.startWith', [$t('system.menu.path'), '/']),
      )
      .refine(async (value: string) => {
        return await isMenuPathExists(value, formData.value?.id);
      }, $t('system.menu.activePathMustExist'))
      .optional(),
  },
  {
    component: 'IconPicker',
    componentProps: {
      prefix: 'carbon',
    },
    dependencies: {
      show: (values) => {
        return ['catalog', 'embedded', 'link', 'menu'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.icon',
    label: $t('system.menu.icon'),
  },
  {
    component: 'IconPicker',
    componentProps: {
      prefix: 'carbon',
    },
    dependencies: {
      show: (values) => {
        return ['catalog', 'embedded', 'menu'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.activeIcon',
    label: $t('system.menu.activeIcon'),
  },
  {
    component: 'AutoComplete',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      filterOption(input: string, option: { value: string }) {
        return option.value.toLowerCase().includes(input.toLowerCase());
      },
      options: componentKeys.map((v) => ({ value: v })),
    },
    dependencies: {
      rules: (values) => {
        return values.type === 'menu' ? 'required' : null;
      },
      show: (values) => {
        return values.type === 'menu';
      },
      triggerFields: ['type'],
    },
    fieldName: 'component',
    label: $t('system.menu.component'),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return ['embedded', 'link'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'linkSrc',
    label: $t('system.menu.linkSrc'),
    rules: z.string().url($t('ui.formRules.invalidURL')),
  },
  {
    component: 'Input',
    dependencies: {
      rules: (values) => {
        return values.type === 'button' ? 'required' : null;
      },
      show: (values) => {
        return ['button', 'catalog', 'embedded', 'menu'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'authCode',
    label: $t('system.menu.authCode'),
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: [
        { label: $t('common.enabled'), value: 1 },
        { label: $t('common.disabled'), value: 0 },
      ],
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'status',
    label: $t('system.menu.status'),
  },
  {
    component: 'InputNumber',
    componentProps: {
      class: 'w-full',
      precision: 0,
    },
    defaultValue: 0,
    fieldName: 'sort',
    label: $t('system.menu.sort'),
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      options: [
        { label: $t('system.menu.badgeType.dot'), value: 'dot' },
        { label: $t('system.menu.badgeType.normal'), value: 'normal' },
      ],
    },
    dependencies: {
      show: (values) => {
        return values.type !== 'button';
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.badgeType',
    label: $t('system.menu.badgeType.title'),
  },
  {
    component: 'Input',
    componentProps: (values) => {
      return {
        allowClear: true,
        class: 'w-full',
        disabled: values.meta?.badgeType !== 'normal',
      };
    },
    dependencies: {
      show: (values) => {
        return values.type !== 'button';
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.badge',
    label: $t('system.menu.badge'),
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      options: SystemMenuApi.BadgeVariants.map((v) => ({
        label: v,
        value: v,
      })),
    },
    dependencies: {
      show: (values) => {
        return values.type !== 'button';
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.badgeVariants',
    label: $t('system.menu.badgeVariants'),
  },
  {
    component: 'Divider',
    dependencies: {
      show: (values) => {
        return !['button', 'link'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'divider1',
    formItemClass: 'col-span-2 md:col-span-2 pb-0',
    hideLabel: true,
    renderComponentContent() {
      return {
        default: () => $t('system.menu.advancedSettings'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return ['menu'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.keepAlive',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.keepAlive'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return ['embedded', 'menu'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.affixTab',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.affixTab'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !['button'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.hideInMenu',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.hideInMenu'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return ['catalog', 'menu'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.hideChildrenInMenu',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.hideChildrenInMenu'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !['button', 'link'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.hideInBreadcrumb',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.hideInBreadcrumb'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !['button', 'link'].includes(values.type);
      },
      triggerFields: ['type'],
    },
    fieldName: 'meta.hideInTab',
    renderComponentContent() {
      return {
        default: () => $t('system.menu.hideInTab'),
      };
    },
  },
];

const breakpoints = useBreakpoints(breakpointsTailwind);
const isHorizontal = computed(() => breakpoints.greaterOrEqual('md').value);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});
const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: onSubmit,
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<SystemMenuApi.SystemMenu>();
      if (data?.type === 'link') {
        data.linkSrc = data.meta?.link;
      } else if (data?.type === 'embedded') {
        data.linkSrc = data.meta?.iframeSrc;
      }
      if (data) {
        formData.value = data;
        formApi.setValues(formData.value);
        titleSuffix.value = formData.value.meta?.title
          ? $t(formData.value.meta.title)
          : '';
      } else {
        formApi.resetForm();
        titleSuffix.value = '';
      }
    }
  },
});

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    drawerApi.lock();
    const data =
      await formApi.getValues<
        Omit<SystemMenuApi.SystemMenu, 'children' | 'id'>
      >();
    if (data.type === 'link') {
      data.meta = { ...data.meta, link: data.linkSrc };
    } else if (data.type === 'embedded') {
      data.meta = { ...data.meta, iframeSrc: data.linkSrc };
    }
    delete data.linkSrc;
    try {
      await (formData.value?.id
        ? updateMenu(formData.value.id, data)
        : createMenu(data));
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  }
}
const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.menu.name')])
    : $t('ui.actionTitle.create', [$t('system.menu.name')]),
);
</script>
<template>
  <Drawer class="w-full max-w-[800px]" :title="getDrawerTitle">
    <Form class="mx-4" :layout="isHorizontal ? 'horizontal' : 'vertical'" />
  </Drawer>
</template>
