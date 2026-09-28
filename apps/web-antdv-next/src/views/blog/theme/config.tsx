import type {
  ThemeField,
  ThemeObject,
  ThemePath,
  ThemeValue,
} from './form-model';

import type { BlogApi } from '#/api/blog';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Button,
  Image,
  Input,
  InputNumber,
  message,
  Select,
  Switch,
  Upload,
} from 'antdv-next';

import {
  getThemeConfig,
  resolveKtBlogWebBaseUrl,
  saveThemeConfig,
} from '#/api/blog';

import {
  cloneTheme,
  isThemeObject,
  preserveScalarType,
  readTheme,
  themeColorRgb,
  themeGroups,
  writeTheme,
} from './form-model';
import { resolveThemeImagePreview } from './image-preview';
import { themeImageAccept, uploadThemeImage } from './image-upload';

import './form.scss';

const typeOptions = [
  { label: '文本', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '开关', value: 'boolean' },
  { label: '对象', value: 'object' },
  { label: '列表', value: 'array' },
  { label: '空值', value: 'null' },
];
const menuFields: ThemeField[] = [
  { path: 'label', label: '菜单名称', kind: 'text', initial: '' },
  { path: 'href', label: '链接地址', kind: 'text', initial: '' },
  { path: 'icon', label: '图标类名', kind: 'text', initial: '' },
  { path: 'external', label: '外部链接', kind: 'boolean', initial: false },
];
const choiceLabels: Record<string, string> = {
  alwayson: '始终深色',
  alwaysoff: '始终浅色',
  system: '跟随系统',
  time: '按时间切换',
  false: '关闭',
  fadeIn: '淡入',
  show: '直接显示',
  article: '文章正文',
  all: '全站',
  zh_CN: '简体中文',
  zh_TW: '繁体中文',
  en_US: '英语',
  YMD: '年 / 月 / 日',
  MDY: '月 / 日 / 年',
  DMY: '日 / 月 / 年',
};

export default defineComponent({
  name: 'BlogThemeConfig',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const draft = ref<ThemeObject>({});
    const loaded = ref(false);
    const loading = ref(false);
    const saving = ref(false);
    const loadError = ref('');
    const uploadingPath = ref('');
    let disposed = false;
    const errors = ref<Record<string, string>>({});
    const imageErrors = ref<Record<string, string>>({});
    const newKeys = ref<Record<string, string>>({});
    const canSave = computed(() => hasAccessByCodes(['Blog:Theme:Save']));
    const busy = computed(
      () => loading.value || saving.value || uploadingPath.value !== '',
    );
    const disabled = computed(
      () => busy.value || !loaded.value || !canSave.value,
    );

    /**
     * 替换独立草稿并清除旧校验信息，拒绝将无效响应作为可保存的空配置。
     * @param config - 服务端返回的主题配置对象。
     * @returns 响应有效并完成回填时返回真。
     */
    function applyConfig(config: BlogApi.ThemeConfig) {
      if (!isThemeObject(config)) return false;
      draft.value = cloneTheme(config as ThemeObject);
      loaded.value = true;
      errors.value = {};
      imageErrors.value = {};
      newKeys.value = {};
      return true;
    }

    /**
     * 加载主题配置，请求失败保留已有草稿，首次加载失败时禁止保存。
     */
    async function loadConfig() {
      if (busy.value) return;
      loading.value = true;
      loadError.value = '';
      try {
        const config = await getThemeConfig();
        if (!applyConfig(config))
          loadError.value = '返回的主题配置无效，请重试加载。';
      } catch {
        loadError.value = '主题配置加载失败，已有草稿已保留，请重试。';
      } finally {
        loading.value = false;
      }
    }

    /**
     * 在权限和校验通过后保存独立载荷；失败不清空草稿，成功回填服务端结果。
     */
    async function saveConfig() {
      if (disabled.value) return;
      if (Object.keys(errors.value).length > 0) {
        message.warning('请先修正表单中的输入错误');
        return;
      }
      saving.value = true;
      try {
        const config = await saveThemeConfig({
          config: cloneTheme(draft.value) as BlogApi.ThemeConfig,
          source: 'admin',
        });
        if (!applyConfig(config)) {
          message.error('保存响应无效，编辑草稿已保留，请刷新确认结果');
          return;
        }
        message.success('主题配置保存成功');
      } catch {
        message.error('主题配置保存失败，编辑草稿已保留');
      } finally {
        saving.value = false;
      }
    }

    /**
     * 局部写入字段并清除对应错误；合法主题色联动 RGB，其余原值不被重建。
     * @param path - 待修改字段的完整配置路径。
     * @param value - 用户明确设置的新值，undefined 表示移除。
     */
    function updateValue(path: ThemePath, value: ThemeValue | undefined) {
      if (disabled.value) return;
      const nextDraft = cloneTheme(draft.value);
      writeTheme(nextDraft, path, value);
      Reflect.deleteProperty(errors.value, JSON.stringify(path));
      Reflect.deleteProperty(imageErrors.value, JSON.stringify(path));
      if (
        path.length === 1 &&
        path[0] === 'themeColor' &&
        typeof value === 'string'
      ) {
        const rgb = themeColorRgb(value);
        if (rgb !== undefined) writeTheme(nextDraft, ['themeColorRgb'], rgb);
        else if (value !== '')
          errors.value[JSON.stringify(path)] = '请输入 #RGB 或 #RRGGBB 颜色';
      }
      draft.value = nextDraft;
    }

    /**
     * 校验数值边界后保留历史字符串类型写回，清空控件时保留显式空值。
     * @param field - 数值字段定义及边界。
     * @param path - 字段完整路径。
     * @param value - 数值控件的新输入；有限数值按范围校验，清空输入写入显式空值。
     */
    function updateNumber(
      field: ThemeField,
      path: ThemePath,
      value: null | number | string,
    ) {
      if (disabled.value) return;
      if (value === null || value === '') {
        updateValue(path, null);
        return;
      }
      const numeric = Number(value);
      if (
        !Number.isFinite(numeric) ||
        (field.min !== undefined && numeric < field.min) ||
        (field.max !== undefined && numeric > field.max)
      ) {
        errors.value[JSON.stringify(path)] =
          `请输入 ${field.min ?? '不限'} 至 ${field.max ?? '不限'} 范围内的数字`;
        return;
      }
      updateValue(
        path,
        preserveScalarType(readTheme(draft.value, path), numeric),
      );
    }

    /**
     * 为扩展字段识别可选择的编辑类型，空值与数组不归入普通对象。
     * @param value - 当前扩展字段原值。
     * @returns 对应扩展类型下拉选项的标识。
     */
    function valueType(value: ThemeValue) {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    }

    /**
     * 仅在用户切换扩展类型后建立空对象、空列表或对应标量，原类型不会自动转换。
     * @param type - 用户选择的字段类型。
     * @returns 该类型的初始配置值。
     */
    function initialValue(type: string): ThemeValue {
      if (type === 'array') return [];
      if (type === 'object') return {};
      if (type === 'number') return 0;
      if (type === 'boolean') return false;
      if (type === 'null') return null;
      return '';
    }

    /**
     * 为未知对象添加不重复的字段，并清除已使用的键名输入。
     * @param path - 接收新字段的对象路径。
     */
    function addKey(path: ThemePath) {
      const id = JSON.stringify(path);
      const key = newKeys.value[id]?.trim();
      const object = readTheme(draft.value, path);
      if (!key || !isThemeObject(object) || Object.hasOwn(object, key)) return;
      updateValue([...path, key], '');
      newKeys.value[id] = '';
    }

    /**
     * 保持菜单和列表原对象内容，将指定项与相邻项交换。
     * @param path - 列表所在配置路径。
     * @param index - 需要移动的项目下标。
     * @param offset - 相邻方向，负一向上、正一向下。
     */
    function moveItem(path: ThemePath, index: number, offset: number) {
      const list = readTheme(draft.value, path);
      const target = index + offset;
      if (!Array.isArray(list) || target < 0 || target >= list.length) return;
      const next = [...list];
      const current = next[index];
      const adjacent = next[target];
      if (current === undefined || adjacent === undefined) return;
      next[index] = adjacent;
      next[target] = current;
      updateValue(path, next);
    }

    /**
     * 为递归列表追加项目，缺省列表只有用户点击新增后才建立。
     * @param path - 列表所在配置路径。
     * @param value - 要追加的独立项目值。
     */
    function addItem(path: ThemePath, value: ThemeValue) {
      const list = readTheme(draft.value, path);
      if (Array.isArray(list)) updateValue(path, [...list, value]);
      else updateValue(path, [value]);
    }

    /**
     * 将历史开关兼容值映射到展示状态，展示不修改原值。
     * @param value - 历史布尔值或 WordPress 开关字符串。
     * @returns 值明确表示开启时返回真。
     */
    function checkedValue(value: ThemeValue | undefined) {
      return (
        value === true ||
        value === 1 ||
        ['1', 'enabled', 'on', 'show', 'true', 'visible', 'yes'].includes(
          String(value).toLowerCase(),
        )
      );
    }

    /**
     * 上传期间锁定表单，成功后以公开资源地址更新草稿，失败保留此前图片配置。
     * @param path - 作者头像或背景图片在配置中的路径。
     * @param file - 已选择的本地图片文件。
     */
    async function uploadImage(path: ThemePath, file: File) {
      if (disabled.value) return;
      const id = JSON.stringify(path);
      uploadingPath.value = id;
      Reflect.deleteProperty(imageErrors.value, id);
      try {
        const url = await uploadThemeImage(file);
        if (disposed) return;
        const nextDraft = cloneTheme(draft.value);
        writeTheme(nextDraft, path, url);
        draft.value = nextDraft;
        message.success('图片已上传，请保存配置使其生效');
      } catch (error) {
        if (disposed) return;
        let text = '图片上传失败，原图片已保留';
        if (error instanceof Error) text = error.message;
        imageErrors.value[id] = text;
        message.error(text);
      } finally {
        uploadingPath.value = '';
      }
    }

    /**
     * 为图片字段展示现有资源并提供受控上传入口，不让临时地址或文本输入进入配置。
     * @param field - 图片字段的中文标签。
     * @param path - 图片字段的完整配置路径。
     * @param value - 保留在配置中的原图片地址。
     * @returns 图片回显、上传按钮和独立错误提示节点。
     */
    function renderImage(
      field: ThemeField,
      path: ThemePath,
      value: ThemeValue | undefined,
    ) {
      const id = JSON.stringify(path);
      let imageUrl = '';
      try {
        imageUrl = resolveThemeImagePreview(
          value,
          resolveKtBlogWebBaseUrl(import.meta.env),
          window.location.origin,
        );
      } catch {
        imageUrl = '';
      }
      return (
        <div class="theme-image-field">
          {imageUrl !== '' && (
            <Image
              alt={field.label}
              class="theme-image-preview"
              src={imageUrl}
              width={200}
            />
          )}
          {imageUrl === '' && (
            <div class="theme-image-empty">未设置图片或图片地址无法回显</div>
          )}
          <Upload
            accept={themeImageAccept}
            beforeUpload={(file) => {
              void uploadImage(path, file);
              return Upload.LIST_IGNORE;
            }}
            disabled={disabled.value}
            multiple={false}
            showUploadList={false}
          >
            <Button
              aria-label={`上传${field.label}`}
              disabled={disabled.value}
              htmlType="button"
              loading={uploadingPath.value === id}
            >
              上传替换
            </Button>
          </Upload>
          <span class="theme-field-hint">
            常见图片格式，最大 5 MiB；上传后需保存配置。
          </span>
          {imageErrors.value[id] && (
            <div class="theme-field-error" role="alert">
              {imageErrors.value[id]}
            </div>
          )}
        </div>
      );
    }

    /**
     * 按业务类型为站点、外观和文章字段派生中文控件，缺省及空值通过明确设置入口修改。
     * @param field - 业务字段标签、类型和边界定义。
     * @param explicitPath - 菜单行等动态位置的完整路径；省略时使用字段定义。
     * @returns 当前业务字段的表单节点。
     */
    function renderField(field: ThemeField, explicitPath?: ThemePath) {
      const path = explicitPath ?? field.path.split('.');
      const value = readTheme(draft.value, path);
      const id = JSON.stringify(path);
      let control;
      if (
        value !== undefined &&
        (isThemeObject(value) || Array.isArray(value))
      ) {
        control = renderValue(path, value);
      } else
        switch (field.kind) {
          case 'boolean': {
            control = (
              <Switch
                aria-label={field.label}
                checked={checkedValue(value)}
                disabled={
                  disabled.value || value === undefined || value === null
                }
                id={`theme-${id}`}
                onUpdate:checked={(next) =>
                  updateValue(path, preserveScalarType(value, next === true))
                }
              />
            );

            break;
          }
          case 'image': {
            control = renderImage(field, path, value);
            break;
          }
          case 'number': {
            let numeric: null | number = null;
            if (
              value !== undefined &&
              value !== null &&
              value !== '' &&
              Number.isFinite(Number(value))
            )
              numeric = Number(value);
            control = (
              <InputNumber
                aria-label={field.label}
                {...{ id: `theme-${id}` }}
                disabled={disabled.value}
                onUpdate:value={(next) => updateNumber(field, path, next)}
                style={{ width: '100%' }}
                value={numeric}
              />
            );

            break;
          }
          case 'select': {
            const options = (field.choices ?? []).map((option) => ({
              label: choiceLabels[option] ?? option,
              value: option,
            }));
            if (
              typeof value === 'string' &&
              !options.some((option) => option.value === value)
            )
              options.push({ label: `当前值：${value}`, value });
            control = (
              <Select
                aria-label={field.label}
                disabled={disabled.value}
                id={`theme-${id}`}
                onUpdate:value={(next) => updateValue(path, String(next))}
                options={options}
                style={{ width: '100%' }}
                value={value as string | undefined}
              />
            );
            if (typeof value === 'string' && !field.choices?.includes(value))
              control = (
                <div class="theme-custom-choice">
                  {control}
                  <Input
                    aria-label={`${field.label}自定义值`}
                    disabled={disabled.value}
                    onUpdate:value={(next) => updateValue(path, next)}
                    value={value}
                  />
                </div>
              );

            break;
          }
          default: {
            let text = '';
            if (value !== null && value !== undefined) text = String(value);
            control = (
              <Input
                aria-label={field.label}
                {...{ id: `theme-${id}` }}
                disabled={disabled.value}
                onUpdate:value={(next) => updateValue(path, next)}
                placeholder="未设置"
                value={text}
              />
            );
          }
        }
      return (
        <div class="theme-field" data-field={path.join('.')}>
          <div class="theme-field-label">
            <label for={`theme-${id}`}>{field.label}</label>
          </div>
          <div class="theme-field-control">{control}</div>
          {field.kind !== 'image' &&
            (value === undefined || value === null) && (
              <div class="theme-field-hint">
                <span>
                  {value === null && '当前为空值'}
                  {value === undefined && '当前未设置'}
                </span>
                <Button
                  disabled={disabled.value}
                  htmlType="button"
                  onClick={() => updateValue(path, cloneTheme(field.initial))}
                  size="small"
                >
                  设置
                </Button>
              </div>
            )}
          {errors.value[id] && (
            <div class="theme-field-error" role="alert">
              {errors.value[id]}
            </div>
          )}
        </div>
      );
    }

    /**
     * 为未知配置递归派生对象、列表及标量控件，保留任意嵌套结构的编辑能力。
     * @param path - 当前节点所在配置路径。
     * @param value - 当前节点原始 JSON 值。
     * @returns 不依赖 JSON 文本输入的递归表单节点。
     */
    function renderValue(path: ThemePath, value: ThemeValue) {
      const id = JSON.stringify(path);
      let body;
      if (isThemeObject(value)) {
        body = (
          <div class="theme-nested">
            {Object.entries(value).map(([key, child]) => (
              <div
                class="theme-extension"
                data-field={[...path, key].join('.')}
                key={key}
              >
                <div class="theme-field-label">
                  <label>{key}</label>
                  <Button
                    disabled={disabled.value}
                    htmlType="button"
                    onClick={() => updateValue([...path, key], undefined)}
                    size="small"
                  >
                    删除字段
                  </Button>
                </div>
                {renderValue([...path, key], child)}
              </div>
            ))}
            <div class="theme-add-key">
              <Input
                aria-label={`${path.join('.')}新字段名`}
                disabled={disabled.value}
                onUpdate:value={(next) => {
                  newKeys.value[id] = next;
                }}
                placeholder="新字段名"
                value={newKeys.value[id] ?? ''}
              />
              <Button
                disabled={
                  disabled.value ||
                  !newKeys.value[id]?.trim() ||
                  Object.hasOwn(value, newKeys.value[id]?.trim() ?? '')
                }
                htmlType="button"
                onClick={() => addKey(path)}
              >
                添加字段
              </Button>
            </div>
          </div>
        );
      } else if (Array.isArray(value)) {
        body = (
          <div class="theme-nested">
            {value.map((child, index) => (
              <div
                class="theme-extension"
                data-field={[...path, index].join('.')}
                key={index}
              >
                <div class="theme-field-label">
                  <label>第 {index + 1} 项</label>
                  {renderOrderActions(path, index, value.length, '删除')}
                </div>
                {renderValue([...path, index], child)}
              </div>
            ))}
            <Button
              disabled={disabled.value}
              htmlType="button"
              onClick={() => addItem(path, '')}
            >
              新增项目
            </Button>
          </div>
        );
      } else if (typeof value === 'boolean') {
        body = (
          <Switch
            aria-label={`${path.join('.')}值`}
            checked={value}
            disabled={disabled.value}
            onUpdate:checked={(next) => updateValue(path, next === true)}
          />
        );
      } else if (typeof value === 'number') {
        body = (
          <InputNumber
            aria-label={`${path.join('.')}值`}
            disabled={disabled.value}
            onUpdate:value={(next) => {
              if (next === null) updateValue(path, null);
              else if (Number.isFinite(Number(next)))
                updateValue(path, Number(next));
            }}
            style={{ width: '100%' }}
            value={value}
          />
        );
      } else if (typeof value === 'string') {
        body = (
          <Input
            aria-label={`${path.join('.')}值`}
            disabled={disabled.value}
            onUpdate:value={(next) => updateValue(path, next)}
            value={value}
          />
        );
      } else body = <span class="theme-field-hint">空值</span>;
      return (
        <div class="theme-value">
          <Select
            aria-label={`${path.join('.')}字段类型`}
            disabled={disabled.value}
            onUpdate:value={(next) =>
              updateValue(path, initialValue(String(next)))
            }
            options={typeOptions}
            style={{ width: '100px' }}
            value={valueType(value)}
          />
          {body}
        </div>
      );
    }

    /**
     * 为列表项目提供边界受限的移动和删除按钮。
     * @param path - 所属列表路径。
     * @param index - 当前项目下标。
     * @param length - 列表项目总数。
     * @param deleteLabel - 删除按钮的业务标签。
     * @returns 列表项目操作按钮集合。
     */
    function renderOrderActions(
      path: ThemePath,
      index: number,
      length: number,
      deleteLabel: string,
    ) {
      return (
        <div class="theme-row-actions">
          <Button
            disabled={disabled.value || index === 0}
            htmlType="button"
            onClick={() => moveItem(path, index, -1)}
            size="small"
          >
            上移
          </Button>
          <Button
            disabled={disabled.value || index === length - 1}
            htmlType="button"
            onClick={() => moveItem(path, index, 1)}
            size="small"
          >
            下移
          </Button>
          <Button
            disabled={disabled.value}
            htmlType="button"
            onClick={() => updateValue([...path, index], undefined)}
            size="small"
          >
            {deleteLabel}
          </Button>
        </div>
      );
    }

    /**
     * 展示菜单业务字段并保留每项额外字段，列表操作使用完整原始项目。
     * @param key - 顶部或侧边栏菜单字段名。
     * @param title - 中文菜单分组标题。
     * @returns 菜单增删排序和逐项编辑节点。
     */
    function renderMenu(key: string, title: string) {
      const value = readTheme(draft.value, [key]);
      let content;
      if (Array.isArray(value))
        content = value.map((item, index) => (
          <div
            class="theme-menu-item"
            data-menu-item={`${key}.${index}`}
            key={index}
          >
            <div class="theme-field-label">
              <h3>第 {index + 1} 项</h3>
              {renderOrderActions([key], index, value.length, '删除菜单')}
            </div>
            {isThemeObject(item) && (
              <div class="theme-fields">
                {menuFields.map((field) =>
                  renderField(field, [key, index, field.path]),
                )}
                {Object.entries(item)
                  .filter(
                    ([name]) =>
                      !menuFields.some((field) => field.path === name),
                  )
                  .map(([name, child]) => (
                    <div
                      class="theme-extension"
                      data-field={`${key}.${index}.${name}`}
                      key={name}
                    >
                      <label>{name}</label>
                      {renderValue([key, index, name], child)}
                    </div>
                  ))}
              </div>
            )}
            {!isThemeObject(item) && renderValue([key, index], item)}
          </div>
        ));
      else if (value !== undefined) content = renderValue([key], value);
      return (
        <section class="theme-card" data-menu={key}>
          <div class="theme-field-label">
            <h3>{title}</h3>
            <div class="theme-row-actions">
              <Button
                disabled={
                  disabled.value ||
                  (value !== undefined && !Array.isArray(value))
                }
                htmlType="button"
                onClick={() => addItem([key], { label: '', href: '' })}
              >
                新增菜单
              </Button>
            </div>
          </div>
          {content}
        </section>
      );
    }

    /**
     * 在已知字段树中查找未覆盖节点，扩展对象及历史异型父节点保留编辑入口。
     * @param object - 当前层配置对象。
     * @param path - 当前对象在配置中的路径。
     * @returns 未被业务表单覆盖的递归配置节点集合。
     */
    function extensionEntries(
      object: ThemeObject,
      path: ThemePath = [],
    ): { path: ThemePath; value: ThemeValue }[] {
      const known = [
        ...themeGroups.flatMap((group) =>
          group.fields.map((field) => field.path),
        ),
        'headerMenu',
        'sidebarMenu',
        'bodyClass',
        'htmlClass',
      ].map((field) => field.split('.'));
      return Object.entries(object).flatMap(([key, value]) => {
        const next = [...path, key];
        if (
          known.some(
            (field) =>
              field.length === next.length &&
              field.every((segment, index) => segment === next[index]),
          )
        )
          return [];
        if (
          known.some(
            (field) =>
              field.length > next.length &&
              next.every((segment, index) => segment === field[index]),
          ) &&
          isThemeObject(value)
        )
          return extensionEntries(value, next);
        return [{ path: next, value }];
      });
    }

    /**
     * 为页面和全局样式类提供增删排序控件，保留原数组项目并在首次新增时建立缺省列表。
     * @param key - 页面或全局样式类字段。
     * @param title - 中文列表标题。
     * @returns 可增删排序的样式类表单。
     */
    function renderClasses(key: string, title: string) {
      const value = readTheme(draft.value, [key]);
      let content;
      if (Array.isArray(value)) {
        content = value.map((item, index) => (
          <div
            class="theme-extension"
            data-field={`${key}.${index}`}
            key={index}
          >
            <div class="theme-field-label">
              <label>第 {index + 1} 个样式类</label>
              {renderOrderActions([key], index, value.length, '删除')}
            </div>
            {typeof item === 'string' && (
              <Input
                aria-label={`${title}第${index + 1}项`}
                disabled={disabled.value}
                onUpdate:value={(next) => updateValue([key, index], next)}
                value={item}
              />
            )}
            {typeof item !== 'string' && renderValue([key, index], item)}
          </div>
        ));
      } else if (value !== undefined) content = renderValue([key], value);
      return (
        <section class="theme-card" data-classes={key} key={key}>
          <div class="theme-field-label">
            <h3>{title}</h3>
            <div class="theme-row-actions">
              <Button
                disabled={
                  disabled.value ||
                  (value !== undefined && !Array.isArray(value))
                }
                htmlType="button"
                onClick={() => addItem([key], '')}
              >
                新增样式类
              </Button>
            </div>
          </div>
          {content}
        </section>
      );
    }

    onMounted(() => {
      void loadConfig();
    });
    onBeforeUnmount(() => {
      disposed = true;
    });
    return () => (
      <div class="blog-theme-config">
        <Page autoContentHeight>
          <div class="theme-layout">
            <header class="theme-toolbar">
              <div>
                <h2>主题配置</h2>
                <p>在同一表单内按分组编辑博客外观与交互，保存后应用配置。</p>
              </div>
              <div class="theme-row-actions">
                <Button
                  disabled={busy.value}
                  htmlType="button"
                  loading={loading.value}
                  onClick={loadConfig}
                >
                  刷新
                </Button>
                <Button
                  disabled={disabled.value}
                  htmlType="button"
                  loading={saving.value}
                  onClick={saveConfig}
                  type="primary"
                >
                  保存配置
                </Button>
              </div>
            </header>
            {loadError.value && (
              <div class="theme-status theme-field-error" role="alert">
                {loadError.value}
              </div>
            )}
            {!canSave.value && (
              <div class="theme-status">当前账号没有主题保存权限。</div>
            )}
            <main class="theme-scroll">
              <form
                class="theme-sections"
                onSubmit={(event) => event.preventDefault()}
              >
                {themeGroups.map((group) => (
                  <section class="theme-card" key={group.title}>
                    <h3>{group.title}</h3>
                    <div class="theme-fields">
                      {group.fields.map((field) => renderField(field))}
                    </div>
                  </section>
                ))}
                <section aria-label="菜单与样式" class="theme-sections">
                  <h3 class="theme-section-title">菜单与样式</h3>
                  {renderMenu('headerMenu', '顶部菜单')}
                  {renderMenu('sidebarMenu', '侧边栏菜单')}
                  {renderClasses('bodyClass', '页面样式类')}
                  {renderClasses('htmlClass', '全局样式类')}
                </section>
                <section class="theme-card">
                  <h3>扩展字段</h3>
                  <p class="theme-field-hint">
                    未识别的配置仍会原样保存，可在这里按字段类型编辑。
                  </p>
                  {extensionEntries(draft.value).map((entry) => (
                    <div
                      class="theme-extension"
                      data-field={entry.path.join('.')}
                      key={JSON.stringify(entry.path)}
                    >
                      <div class="theme-field-label">
                        <label>{entry.path.join(' / ')}</label>
                        <Button
                          disabled={disabled.value}
                          htmlType="button"
                          onClick={() => updateValue(entry.path, undefined)}
                        >
                          删除字段
                        </Button>
                      </div>
                      {renderValue(entry.path, entry.value)}
                    </div>
                  ))}
                </section>
              </form>
            </main>
          </div>
        </Page>
      </div>
    );
  },
});
