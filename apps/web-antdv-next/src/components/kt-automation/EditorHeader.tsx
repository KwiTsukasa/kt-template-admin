import { defineComponent } from 'vue';

import { useAccess } from '@vben/access';
import { IconifyIcon } from '@vben/icons';

import { Button, Input, Tag } from 'antdv-next';

import './automation.scss';

export default defineComponent({
  name: 'AutomationEditorHeader',
  props: {
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    label: { type: String, required: true },
    permission: { type: String, required: true },
    dirty: Boolean,
    loading: Boolean,
    revision: { type: Number, default: 0 },
    publishedVersion: { type: Number, default: undefined },
  },
  emits: {
    nameChange: (_name: string) => true,
    descriptionChange: (_description: string) => true,
    back: () => true,
    save: () => true,
    publish: () => true,
  },
  setup(props, { emit, slots }) {
    const { hasAccessByCodes } = useAccess();
    return () => (
      <header class="automation-editor-header">
        <div class="automation-editor-header__main">
          <Button
            aria-label={`返回${props.label}`}
            onClick={() => emit('back')}
            type="text"
          >
            <IconifyIcon icon="lucide:arrow-left" />
          </Button>
          <div class="automation-editor-header__identity">
            <Input
              aria-label="名称"
              class="automation-editor-header__name"
              disabled={!hasAccessByCodes([`${props.permission}:Edit`])}
              onChange={(event) => emit('nameChange', event.target.value || '')}
              value={props.name}
            />
          </div>
          <div class="automation-editor-header__state">
            <Tag>{`草稿 ${props.revision}`}</Tag>
            {props.publishedVersion && (
              <Tag color="blue">{`已发布 v${props.publishedVersion}`}</Tag>
            )}
            {props.dirty && (
              <span class="automation-unsaved">有未保存修改</span>
            )}
          </div>
        </div>
        <div class="automation-editor-header__actions">
          {slots.default?.()}
          <Button
            disabled={!hasAccessByCodes([`${props.permission}:Edit`])}
            loading={props.loading}
            onClick={() => emit('save')}
          >
            保存草稿
          </Button>
          <Button
            disabled={
              !hasAccessByCodes([`${props.permission}:Edit`]) ||
              !hasAccessByCodes([`${props.permission}:Publish`])
            }
            loading={props.loading}
            onClick={() => emit('publish')}
            type="primary"
          >
            发布版本
          </Button>
        </div>
      </header>
    );
  },
});
