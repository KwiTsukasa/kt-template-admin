import type { DataSchema } from '#/api/automation/definition';
import type { TaskHandler } from '#/api/task-execution';

import { defineComponent, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, InputNumber, Select, Space, Tag } from 'antdv-next';

import { taskApi, taskFromHandler } from '#/api/task-execution';
import EditorHeader from '#/components/kt-automation/EditorHeader';
import { useDefinitionEditor } from '#/components/kt-definition-list/useDefinitionEditor';

export default defineComponent({
  name: 'AutomationTaskDesigner',
  setup() {
    const editor = useDefinitionEditor(taskApi, 'taskId', '/automation/tasks');
    const handlers = ref<TaskHandler[]>([]);
    const handlerError = ref('');
    const loadHandlers = async () => {
      handlerError.value = '';
      try {
        handlers.value = await taskApi.handlers();
      } catch {
        handlerError.value = '执行能力目录加载失败';
      }
    };
    onMounted(loadHandlers);
    const selectHandler = (value: unknown) => {
      const handler = handlers.value.find(
        (item) => `${item.key}@${item.version}` === value,
      );
      if (!handler?.available) return;
      editor.definition.value = taskFromHandler(handler);
    };
    const publish = async () => {
      const definition = editor.definition.value;
      const handler = handlers.value.find(
        (item) =>
          item.key === definition?.handler.key &&
          item.version === definition.handler.version,
      );
      if (!definition || !handler?.available) {
        editor.error.value = '当前执行能力不可用';
        return;
      }
      if (definition.timeoutMs > handler.timeoutMs) {
        editor.error.value = `单次执行超时不能超过 ${handler.timeoutMs / 1000} 秒`;
        return;
      }
      editor.error.value = '';
      await editor.publish();
    };
    const fields = (schema: DataSchema) => {
      if (schema.fields.length === 0)
        return <span class="text-muted-foreground">无需填写字段</span>;
      return (
        <div class="space-y-2">
          {schema.fields.map((field) => (
            <div
              class="flex justify-between rounded border p-3"
              key={field.key}
            >
              <span>
                {field.label}{' '}
                <span class="text-muted-foreground">{field.key}</span>
              </span>
              <Space>
                <Tag>{field.type}</Tag>
                {field.required && <Tag>必填</Tag>}
              </Space>
            </div>
          ))}
        </div>
      );
    };
    return () => {
      const definition = editor.definition.value;
      let handler: TaskHandler | undefined;
      if (definition)
        handler = handlers.value.find(
          (item) =>
            item.key === definition.handler.key &&
            item.version === definition.handler.version,
        );
      return (
        <Page autoContentHeight contentClass="automation-designer-viewport">
          <div class="automation-page automation-page--designer">
            <EditorHeader
              description={editor.description.value}
              dirty={editor.dirty.value}
              label="执行动作"
              loading={editor.loading.value}
              name={editor.name.value}
              onBack={editor.back}
              onDescriptionChange={(value) => {
                editor.description.value = value;
              }}
              onNameChange={(value) => {
                editor.name.value = value;
              }}
              onPublish={publish}
              onSave={editor.save}
              permission="Automation:Task"
              publishedVersion={
                editor.document.value?.publishedVersion ?? undefined
              }
              revision={editor.document.value?.revision}
            />
            {editor.error.value && (
              <Alert message={editor.error.value} type="error" />
            )}
            {handlerError.value && (
              <Alert
                action={<Button onClick={loadHandlers}>重试</Button>}
                message={handlerError.value}
                type="error"
              />
            )}
            {definition && (
              <div class="automation-action-layout">
                <section class="automation-studio__panel automation-records">
                  <div class="automation-studio__panel-heading">
                    <h2>执行能力</h2>
                  </div>
                  <div class="automation-studio__panel-body automation-records__body">
                    <Select
                      class="w-full"
                      onChange={selectHandler}
                      optionFilterProp="label"
                      options={handlers.value.map((item) => ({
                        label: `${item.name} · v${item.version}`,
                        value: `${item.key}@${item.version}`,
                        disabled: !item.available,
                      }))}
                      showSearch
                      value={`${definition.handler.key}@${definition.handler.version}`}
                    />
                    {!handler?.available && (
                      <Alert
                        message="当前固定处理器版本不可用；已发布契约仍保留，发布和运行需要恢复该能力。"
                        type="warning"
                      />
                    )}
                    <label class="block">
                      单次执行超时（秒）
                      <InputNumber
                        class="w-full"
                        max={(handler?.timeoutMs ?? 3_600_000) / 1000}
                        min={1}
                        onChange={(value) => {
                          if (value !== null)
                            definition.timeoutMs = Number(value) * 1000;
                        }}
                        value={definition.timeoutMs / 1000}
                      />
                    </label>
                    <label class="block">
                      最大尝试次数
                      <Select
                        class="w-full"
                        disabled={!definition.contract.idempotent}
                        onChange={(value) => {
                          definition.maxAttempts = Number(value);
                        }}
                        options={[1, 2, 3, 4, 5].map((value) => ({
                          label: `${value} 次`,
                          value,
                        }))}
                        value={definition.maxAttempts}
                      />
                    </label>
                    <label class="block">
                      重试等待（秒）
                      <InputNumber
                        class="w-full"
                        disabled={definition.maxAttempts === 1}
                        max={3600}
                        min={1}
                        onChange={(value) => {
                          if (value !== null)
                            definition.retryBackoffMs = Number(value) * 1000;
                        }}
                        value={definition.retryBackoffMs / 1000}
                      />
                    </label>
                  </div>
                </section>
                <div class="flex min-h-0 flex-col gap-4">
                  <section class="automation-studio__panel automation-records">
                    <div class="automation-studio__panel-heading">
                      <h2>输入参数</h2>
                    </div>
                    <div class="automation-studio__panel-body automation-records__body">
                      {fields(definition.contract.inputSchema)}
                    </div>
                  </section>
                  <section class="automation-studio__panel automation-records">
                    <div class="automation-studio__panel-heading">
                      <h2>输出结果</h2>
                    </div>
                    <div class="automation-studio__panel-body automation-records__body">
                      {fields(definition.contract.outputSchema)}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </Page>
      );
    };
  },
});
