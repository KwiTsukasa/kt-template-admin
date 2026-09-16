import type {
  DefinitionClient,
  DefinitionDocument,
} from '#/api/automation/definition';

import {
  computed,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router';

import { Button, message, Modal, Space } from 'antdv-next';

import { usePageReturn } from '#/hooks/usePageReturn';

/**
 * 管理单个资源设计页的加载、并发版本和未保存离开提示，编辑内容仍由各业务模块拥有。
 * @param api - 当前资源自己的请求接口。
 * @param idKey - 路由中标识资源的参数名。
 * @param basePath - 返回管理列表时允许使用的路径。
 * @param context - 抽屉传入的资源标识和关闭操作，省略时使用路由页面。
 * @param context.id - 读取抽屉当前编辑的资源身份。
 * @param context.close - 未保存修改处理完成后关闭抽屉。
 * @returns 当前草稿、加载状态与保存、发布、返回操作。
 */
export function useDefinitionEditor<T>(
  api: DefinitionClient<T>,
  idKey: string,
  basePath: string,
  context?: { close: () => void; id: () => string },
) {
  const route = useRoute();
  const returnToPage = usePageReturn(basePath);
  const document = shallowRef<DefinitionDocument<T>>();
  const definition = ref<T>();
  const name = ref('');
  const description = ref('');
  const loading = ref(false);
  const saved = ref('');
  const error = ref('');
  let generation = 0;
  let writing = false;
  const snapshot = () =>
    JSON.stringify({
      name: name.value,
      description: description.value,
      definition: definition.value,
    });
  const dirty = computed(() =>
    Boolean(document.value && saved.value !== snapshot()),
  );
  const load = async () => {
    let id = route.params[idKey];
    if (context) id = context.id();
    if (typeof id !== 'string' || !id) return;
    const current = ++generation;
    loading.value = true;
    error.value = '';
    document.value = undefined;
    definition.value = undefined;
    try {
      const row = await api.detail(id);
      if (current !== generation) return;
      document.value = row;
      definition.value = structuredClone(
        row.definition,
      ) as typeof definition.value;
      name.value = row.name;
      description.value = row.description;
      saved.value = snapshot();
    } catch (error_) {
      if (current === generation) error.value = String(error_);
    } finally {
      if (current === generation) loading.value = false;
    }
  };
  const save = async () => {
    if (!document.value || !definition.value || loading.value) return false;
    const submitted = snapshot();
    const values = JSON.parse(submitted) as {
      definition: T;
      description: string;
      name: string;
    };
    writing = true;
    loading.value = true;
    try {
      const row = await api.save(document.value.id, {
        ...values,
        expectedRevision: document.value.revision,
      });
      document.value = row;
      saved.value = submitted;
      message.success('草稿已保存');
      return true;
    } finally {
      loading.value = false;
      writing = false;
    }
  };
  const publish = async () => {
    if (!(await save()) || !document.value) return;
    writing = true;
    loading.value = true;
    try {
      const published = await api.publish(
        document.value.id,
        document.value.revision,
      );
      document.value = {
        ...document.value,
        revision: published.revision,
        publishedVersion: published.version,
      };
      message.success(`已发布 v${published.version}`);
    } finally {
      loading.value = false;
      writing = false;
    }
  };
  const back = async () => {
    if (context) {
      if (await confirmLeave()) context.close();
      return;
    }
    await returnToPage();
  };
  const confirmLeave = async () => {
    if (writing) return false;
    if (!dirty.value) return true;
    return await new Promise<boolean>((resolve) => {
      const finish = (leave: boolean) => {
        modal.destroy();
        resolve(leave);
      };
      const modal = Modal.confirm({
        title: '有尚未保存的修改',
        content: '请选择保存、放弃修改或继续编辑。',
        onCancel: () => resolve(false),
        footer: () =>
          h(
            Space,
            {},
            {
              default: () => [
                h(
                  Button,
                  { disabled: loading.value, onClick: () => finish(false) },
                  { default: () => '继续编辑' },
                ),
                h(
                  Button,
                  {
                    danger: true,
                    disabled: loading.value,
                    onClick: () => finish(true),
                  },
                  { default: () => '放弃并离开' },
                ),
                h(
                  Button,
                  {
                    type: 'primary',
                    loading: loading.value,
                    onClick: async () => {
                      try {
                        if (await save()) {
                          if (dirty.value) {
                            message.info('保存期间又有修改，请再次确认');
                            return;
                          }
                          finish(true);
                        }
                      } catch {
                        /* 请求层已展示错误，保留草稿和离开选择。 */
                      }
                    },
                  },
                  { default: () => '保存并离开' },
                ),
              ],
            },
          ),
      });
    });
  };
  onBeforeRouteLeave(confirmLeave);
  onBeforeRouteUpdate((to, from) => {
    if (to.params[idKey] !== from.params[idKey]) return confirmLeave();
    return true;
  });
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (dirty.value) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  onMounted(() => window.addEventListener('beforeunload', beforeUnload));
  onBeforeUnmount(() => {
    generation += 1;
    window.removeEventListener('beforeunload', beforeUnload);
  });
  watch(() => context?.id() || route.params[idKey], load, { immediate: true });
  return {
    document,
    definition,
    name,
    description,
    loading,
    error,
    dirty,
    save,
    publish,
    back,
    confirmLeave,
    reload: load,
  };
}
