import type {
  TriggerConfiguration,
  TriggerEventSource,
} from '#/api/trigger-engine';

import { defineComponent, onMounted, ref, toRaw, watch } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Space,
  Timeline,
} from 'antdv-next';

import { triggerApi } from '#/api/trigger-engine';
import CronEditor from '#/components/kt-cron-editor';
import { useDefinitionEditor } from '#/components/kt-definition-list/useDefinitionEditor';

export default defineComponent({
  name: 'AutomationTriggerDesigner',
  setup() {
    const editor = useDefinitionEditor(
      triggerApi,
      'triggerId',
      '/automation/triggers',
    );
    const occurrences = ref<string[]>([]);
    const previewed = ref(false);
    const eventSources = ref<TriggerEventSource[]>([]);
    const sourcesError = ref('');
    const loadSources = async () => {
      sourcesError.value = '';
      try {
        eventSources.value = await triggerApi.eventSources();
      } catch {
        sourcesError.value = '事件源加载失败，请重试。';
      }
    };
    onMounted(loadSources);
    watch(
      editor.definition,
      () => {
        occurrences.value = [];
        previewed.value = false;
      },
      { deep: true },
    );
    const timezones = Intl.supportedValuesOf('timeZone').map((zone) => ({
      label: zone,
      value: zone,
    }));
    const selectType = (type: unknown) => {
      if (!editor.definition.value) return;
      let trigger: TriggerConfiguration = { type: 'manual' };
      if (type === 'cron')
        trigger = {
          type: 'cron',
          expression: '0 9 * * *',
          timezone: 'Asia/Shanghai',
        };
      if (type === 'interval') trigger = { type: 'interval', everyMs: 60_000 };
      if (type === 'once')
        trigger = {
          type: 'once',
          at: new Date(Date.now() + 3_600_000).toISOString(),
        };
      if (type === 'event')
        trigger = {
          type: 'event',
          eventKey: '',
          eventVersion: 1,
          payloadSchema: { fields: [] },
        };
      editor.definition.value.trigger = trigger;
      occurrences.value = [];
      previewed.value = false;
    };
    const preview = async () => {
      if (!editor.definition.value) return;
      const submitted = JSON.stringify(editor.definition.value);
      const result = await triggerApi.preview(editor.definition.value);
      if (JSON.stringify(editor.definition.value) !== submitted) return;
      occurrences.value = result.occurrences;
      previewed.value = true;
    };
    const configuration = () => {
      const trigger = editor.definition.value?.trigger;
      if (!trigger) return null;
      if (trigger.type === 'cron')
        return (
          <div class="space-y-4">
            <CronEditor
              value={trigger.expression}
              {...{
                'onUpdate:value': (value: string) => {
                  trigger.expression = value;
                },
              }}
            />
            <label class="block">
              时区
              <Select
                class="w-full"
                onChange={(value) => {
                  trigger.timezone = String(value);
                }}
                options={timezones}
                showSearch
                value={trigger.timezone}
              />
            </label>
          </div>
        );
      if (trigger.type === 'interval')
        return (
          <Space>
            <span>每隔</span>
            <InputNumber
              max={2_592_000}
              min={1}
              onChange={(value) => {
                trigger.everyMs = Number(value) * 1000;
              }}
              value={trigger.everyMs / 1000}
            />
            <span>秒触发一次</span>
          </Space>
        );
      if (trigger.type === 'once')
        return (
          <label class="block">
            触发时间
            <DatePicker
              class="w-full"
              onChange={(value) => {
                trigger.at = String(value || '');
              }}
              showTime
              value={trigger.at}
              valueFormat="YYYY-MM-DDTHH:mm:ssZ"
            />
          </label>
        );
      if (trigger.type === 'event')
        return (
          <div class="space-y-3">
            <label class="block">
              业务事件
              <Select
                class="w-full"
                onChange={(value) => {
                  const source = eventSources.value.find(
                    (item) => `${item.key}@${item.version}` === value,
                  );
                  if (!source) return;
                  trigger.eventKey = source.key;
                  trigger.eventVersion = source.version;
                  trigger.payloadSchema = structuredClone(
                    toRaw(source.payloadSchema),
                  );
                }}
                optionFilterProp="label"
                options={eventSources.value.map((source) => ({
                  label: `${source.name} · v${source.version}`,
                  value: `${source.key}@${source.version}`,
                }))}
                placeholder="选择已注册的业务事件及版本"
                showSearch
                value={`${trigger.eventKey}@${trigger.eventVersion}`}
              />
            </label>
            {sourcesError.value && (
              <Alert
                action={
                  <Button onClick={loadSources} size="small">
                    重试
                  </Button>
                }
                message={sourcesError.value}
                type="error"
              />
            )}
            {!sourcesError.value && eventSources.value.length === 0 && (
              <Alert
                message="目前没有业务事件源，业务模块接入后会出现在这里。"
                type="info"
              />
            )}
            {trigger.eventKey &&
              !eventSources.value.some(
                (source) =>
                  source.key === trigger.eventKey &&
                  source.version === trigger.eventVersion,
              ) && (
                <Alert
                  message="当前固定版本的事件源未加载，无法发布或激活新的订阅。"
                  type="warning"
                />
              )}
            <div class="space-y-2">
              <strong>事件提供的字段</strong>
              {trigger.payloadSchema.fields.map((field) => (
                <div
                  class="flex justify-between rounded border p-2"
                  key={field.key}
                >
                  <span>{field.label}</span>
                  <span class="text-muted-foreground">{field.type}</span>
                </div>
              ))}
            </div>
            <Alert
              message="同一事件 ID 重试会去重。事件载荷仅包含这里声明的字段。"
              type="info"
            />
          </div>
        );
      return (
        <Alert
          message="由有权限的操作者手动发起，不创建周期任务。"
          type="info"
        />
      );
    };
    const timeline = () => {
      if (!previewed.value)
        return (
          <span class="text-muted-foreground">
            配置后点击预览，核对时区和发生时间。
          </span>
        );
      if (occurrences.value.length === 0)
        return <Alert message="该触发器没有未来定时发生点。" type="info" />;
      return (
        <Timeline
          items={occurrences.value.map((time) => ({
            content: new Date(time).toLocaleString(),
            key: time,
          }))}
        />
      );
    };
    return () => (
      <Page>
        <div class="space-y-4">
          <div class="flex flex-wrap justify-between gap-3">
            <Space>
              <Button onClick={editor.back}>返回触发器管理</Button>
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
          <div class="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card title="触发配置">
              <div class="space-y-5">
                <Select
                  class="w-full"
                  onChange={selectType}
                  options={[
                    { label: 'Cron 周期', value: 'cron' },
                    { label: '固定间隔', value: 'interval' },
                    { label: '指定时间', value: 'once' },
                    { label: '业务事件', value: 'event' },
                    { label: '手动触发', value: 'manual' },
                  ]}
                  value={editor.definition.value?.trigger.type}
                />
                {configuration()}
                <Button onClick={preview}>预览发生时间</Button>
              </div>
            </Card>
            <Card title="接下来五次">{timeline()}</Card>
          </div>
        </div>
      </Page>
    );
  },
});
