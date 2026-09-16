import type { UploadFile } from 'antdv-next';

import type {
  WorkflowScriptCapability,
  WorkflowScriptDeclaration,
} from '#/api/workflow-engine';

import { defineComponent, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';

import { InboxOutlined, LoadingOutlined } from '@antdv-next/icons';
import { Alert, Button, message, Select, Tag, Upload } from 'antdv-next';

import { workflowApi } from '#/api/workflow-engine';

export default defineComponent({
  name: 'WorkflowScriptUpload',
  emits: { uploaded: (_script: WorkflowScriptCapability) => true },
  setup(_props, { emit }) {
    const { hasAccessByCodes } = useAccess();
    const filename = ref('');
    const source = ref('');
    const declaration = ref<WorkflowScriptDeclaration>();
    const error = ref('');
    const busy = ref(false);
    const saving = ref(false);
    const target = ref<'local' | 'nas'>('local');
    const files = ref<UploadFile[]>([]);
    let selection = 0;
    const save = async () => {
      if (!declaration.value || busy.value || saving.value) return;
      saving.value = true;
      try {
        const saved = await workflowApi.uploadScript(
          filename.value,
          source.value,
          target.value,
        );
        emit('uploaded', saved);
        message.success(`脚本 v${saved.version} 已保存，可添加到业务步骤`);
        await drawer.close();
      } catch (error_) {
        error.value = String(error_);
      } finally {
        saving.value = false;
      }
    };
    const [Drawer, drawer] = useVbenDrawer({
      title: '上传执行脚本',
      class: 'w-[640px]',
      onConfirm: save,
    });
    const inspect = async (file: File) => {
      const current = ++selection;
      declaration.value = undefined;
      error.value = '';
      filename.value = '';
      source.value = '';
      if (!/\.(?:mjs|py|sh)$/i.test(file.name)) {
        error.value = '请选择 .mjs、.py 或 .sh 脚本';
        files.value = [];
        return;
      }
      if (file.size > 256 * 1024) {
        error.value = '脚本不能超过 256 KiB';
        files.value = [];
        return;
      }
      files.value = [
        { uid: String(current), name: file.name, status: 'uploading' },
      ];
      busy.value = true;
      try {
        const text = await file.text();
        const metadata = await workflowApi.inspectScript(file.name, text);
        if (current !== selection) return;
        filename.value = file.name;
        source.value = text;
        declaration.value = metadata;
        files.value = [
          { uid: String(current), name: file.name, status: 'done' },
        ];
      } catch (error_) {
        if (current === selection) {
          error.value = String(error_);
          files.value = [
            { uid: String(current), name: file.name, status: 'error' },
          ];
        }
      } finally {
        if (current === selection) busy.value = false;
      }
    };
    return () => (
      <>
        <Button
          disabled={!hasAccessByCodes(['Automation:Workflow:Edit'])}
          onClick={() => drawer.open()}
          size="small"
        >
          上传脚本
        </Button>
        <Drawer
          v-slots={{
            footer: () => (
              <div class="flex w-full justify-end gap-2">
                <Button disabled={saving.value} onClick={() => drawer.close()}>
                  取消
                </Button>
                <Button
                  disabled={!declaration.value || busy.value || saving.value}
                  loading={saving.value}
                  onClick={save}
                  type="primary"
                >
                  保存脚本版本
                </Button>
              </div>
            ),
          }}
        >
          <div class="space-y-5">
            <Upload.Dragger
              accept=".mjs,.py,.sh"
              beforeUpload={(file) => {
                void inspect(file);
                return Upload.LIST_IGNORE;
              }}
              disabled={busy.value || saving.value}
              fileList={files.value}
              maxCount={1}
              multiple={false}
              onRemove={() => {
                selection += 1;
                files.value = [];
                declaration.value = undefined;
                filename.value = '';
                source.value = '';
                error.value = '';
                busy.value = false;
                return true;
              }}
            >
              <p class="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p class="ant-upload-text">点击选择或拖入执行脚本</p>
              <p class="ant-upload-hint">
                支持 Bash（.sh）、Python（.py）、Node.js（.mjs），最大 256 KiB
              </p>
            </Upload.Dragger>
            {busy.value && (
              <p>
                <LoadingOutlined class="mr-2" />
                正在识别扩展参数…
              </p>
            )}
            {error.value && (
              <Alert message={error.value} showIcon type="error" />
            )}
            {declaration.value && (
              <>
                <div>
                  <h3 class="font-semibold">{declaration.value.name}</h3>
                  <p class="text-muted-foreground">
                    {declaration.value.description}
                  </p>
                  <Tag>{declaration.value.runtime}</Tag>
                  <Tag color="blue">标准声明已识别</Tag>
                </div>
                <label class="block space-y-2">
                  <span>执行目标</span>
                  <Select
                    class="w-full"
                    onChange={(value) => {
                      if (value === 'local' || value === 'nas')
                        target.value = value;
                    }}
                    options={[
                      { label: '工作流本地执行节点', value: 'local' },
                      { label: 'NAS 执行节点', value: 'nas' },
                    ]}
                    value={target.value}
                  />
                </label>
                <section class="space-y-3">
                  <h3 class="font-semibold">
                    识别到的扩展参数 ·{' '}
                    {declaration.value.paramsSchema.fields.length}
                  </h3>
                  {declaration.value.paramsSchema.fields.map((field) => (
                    <div class="rounded border p-3" key={field.key}>
                      <div class="flex items-center gap-2">
                        <strong>{field.label}</strong>
                        <Tag>{field.type}</Tag>
                        {field.required && <Tag color="orange">必填</Tag>}
                      </div>
                      <div class="mt-1 text-sm text-muted-foreground">
                        {field.key}
                      </div>
                      {Object.hasOwn(
                        declaration.value?.defaults || {},
                        field.key,
                      ) && (
                        <div>
                          默认值：
                          {String(declaration.value?.defaults[field.key])}
                        </div>
                      )}
                      {field.options && (
                        <div>
                          选项：
                          {field.options
                            .map((option) => option.label)
                            .join('、')}
                        </div>
                      )}
                    </div>
                  ))}
                  {declaration.value.paramsSchema.fields.length === 0 && (
                    <p class="text-muted-foreground">此脚本没有额外参数。</p>
                  )}
                </section>
                <section>
                  <h3 class="font-semibold">结果字段</h3>
                  <p>
                    {declaration.value.resultSchema.fields
                      .map((field) => `${field.label}（${field.type}）`)
                      .join('、') || '无业务扩展结果'}
                  </p>
                </section>
              </>
            )}
          </div>
        </Drawer>
      </>
    );
  },
});
