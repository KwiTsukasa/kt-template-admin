import type { DataSchema } from '#/api/automation/definition';
import type { TaskHandler } from '#/api/task-execution';

import { defineComponent, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
} from 'antdv-next';

import { taskApi, taskFromHandler } from '#/api/task-execution';
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
        <Page>
          <div class="space-y-4">
            <div class="flex justify-between gap-3">
              <Space>
                <Button onClick={editor.back}>返回原子任务</Button>
                <Input
                  onChange={(event) => {
                    editor.name.value = event.target.value || '';
                  }}
                  value={editor.name.value}
                />
              </Space>
              <Space>
                <Button loading={editor.loading.value} onClick={editor.save}>
                  保存
                </Button>
                <Button
                  loading={editor.loading.value}
                  onClick={editor.publish}
                  type="primary"
                >
                  发布版本
                </Button>
              </Space>
            </div>
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
              <div class="grid gap-4 lg:grid-cols-2">
                <Card title="执行能力">
                  <div class="space-y-4">
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
                        max={3600}
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
                    {!definition.contract.idempotent && (
                      <Alert
                        message="该能力未声明幂等，每次运行只尝试一次。"
                        type="info"
                      />
                    )}
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
                </Card>
                <div class="space-y-4">
                  <Card title="输入契约">
                    {fields(definition.contract.inputSchema)}
                  </Card>
                  <Card title="输出契约">
                    {fields(definition.contract.outputSchema)}
                  </Card>
                </div>
              </div>
            )}
          </div>
        </Page>
      );
    };
  },
});
