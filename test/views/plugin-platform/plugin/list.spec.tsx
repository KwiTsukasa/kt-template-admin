/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
/* @vitest-environment happy-dom */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';

import PluginList from '@test-source/apps/web-antdv-next/src/views/plugin-platform/plugin/list';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  disable: vi.fn(),
  enable: vi.fn(),
  getEvents: vi.fn(),
  getInstallations: vi.fn(),
  getPlugins: vi.fn(),
  getOperations: vi.fn(),
  health: vi.fn(),
  installLocal: vi.fn(),
  metadata: vi.fn(),
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
  manifestForm: {
    getValues: vi.fn(async () => ({ manifest: '{"pluginKey":"A"}' })),
    resetForm: vi.fn(async () => undefined),
    resetValidate: vi.fn(async () => undefined),
    setValues: vi.fn(async () => undefined),
    validate: vi.fn(async () => ({ valid: true })),
  },
  manifestModalApi: {
    close: vi.fn(async () => undefined),
    lock: vi.fn(),
    open: vi.fn(),
    unlock: vi.fn(),
  },
  manifestModalOptions: undefined as any,
  packageForm: {
    getValues: vi.fn(async () => ({
      packageHash: '',
      packagePath: '/mock/B.zip',
    })),
    resetForm: vi.fn(async () => undefined),
    resetValidate: vi.fn(async () => undefined),
    setValues: vi.fn(async () => undefined),
    validate: vi.fn(async () => ({ valid: true })),
  },
  tableOptions: undefined as any,
  tableSlots: undefined as any,
  uninstall: vi.fn(),
  upload: vi.fn(),
  validate: vi.fn(),
}));

vi.mock('#/api/plugin-platform/plugin', () => ({
  disablePluginInstallation: mocks.disable,
  enablePluginInstallation: mocks.enable,
  getPluginHealth: mocks.health,
  getPluginInstallations: mocks.getInstallations,
  getPluginList: mocks.getPlugins,
  getPluginOperationPage: mocks.getOperations,
  getPluginRuntimeEvents: mocks.getEvents,
  installLocalPluginPackage: mocks.installLocal,
  uninstallPluginInstallation: mocks.uninstall,
  uploadPluginPackage: mocks.upload,
  validatePluginManifest: mocks.validate,
}));
vi.mock('#/hooks/useDict', () => ({
  useDict: () => ({
    labelOf: (value: string) => value,
    options: ref([]),
    reload: vi.fn(async () => []),
  }),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('main', slots.default?.()),
  }),
  useVbenModal: (options: unknown) => {
    mocks.manifestModalOptions = options;
    return [
      defineComponent({
        props: { confirmDisabled: Boolean },
        setup:
          (props, { slots }) =>
          () =>
            h(
              'section',
              {
                'data-disabled': String(props.confirmDisabled),
              },
              slots.default?.(),
            ),
      }),
      mocks.manifestModalApi,
    ];
  },
}));
vi.mock('#/adapter/form', () => {
  let index = 0;
  const rule: Record<string, any> = {};
  for (const key of ['trim', 'min', 'max', 'optional', 'or'])
    rule[key] = () => rule;
  return {
    useVbenForm: () => [
      defineComponent({ setup: () => () => h('form') }),
      [mocks.manifestForm, mocks.packageForm][index++ % 2],
    ],
    z: { literal: () => rule, string: () => rule },
  };
});
vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    setup(_, { slots }) {
      return () => {
        mocks.tableSlots = slots;
        return h('div');
      };
    },
  }),
  useKtTable: (options: unknown) => {
    mocks.tableOptions = options;
    return [vi.fn(), {}];
  },
}));
vi.mock('antdv-next', async () => {
  const { default: Tag } = await import('antdv-next/dist/tag/index');
  return {
    message: {
      error: vi.fn(),
      success: mocks.messageSuccess,
      warning: mocks.messageWarning,
    },
    Tag,
  };
});
vi.mock(
  '@test-source/apps/web-antdv-next/src/views/plugin-platform/plugin/metadata',
  () => ({
    loadPluginMetadata: mocks.metadata,
  }),
);
vi.mock(
  '@test-source/apps/web-antdv-next/src/views/plugin-platform/plugin/components/PluginManifestModal',
  () => ({
    default: defineComponent({
      name: 'MockManifestModal',
      props: { loading: Boolean, mode: String, open: Boolean },
      emits: ['close', 'submit', 'update:packagePath'],
      setup: (props) => () =>
        h('div', {
          'data-manifest-mode': props.mode,
          'data-manifest-open': String(props.open),
        }),
    }),
  }),
);
vi.mock(
  '@test-source/apps/web-antdv-next/src/views/plugin-platform/plugin/components/PluginPlatformStateDrawer',
  () => ({
    default: defineComponent({
      name: 'MockPluginDrawer',
      props: {
        error: String,
        installations: Array,
        intentRevision: Number,
        known: Boolean,
        loading: Boolean,
        mode: String,
        open: Boolean,
        runtimeEvents: Array,
        pendingInstallationIds: Array,
      },
      emits: ['close', 'installationAction', 'retry'],
      setup(props) {
        return () =>
          h(
            'section',
            {
              'data-drawer-mode': props.mode,
              'data-drawer-open': String(props.open),
            },
            props.error,
          );
      },
    }),
  }),
);

/**
 * 控制抽屉数据读取的返回顺序，验证迟到响应归属。
 * @returns 可手动兑现或拒绝的 Promise。
 */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

/**
 * 从真实页面注册配置中触发已有表格头部按钮。
 * @param key - 安装记录或运行事件按钮的稳定键。
 */
function clickHeader(key: string) {
  const button = mocks.tableOptions.buttons.find(
    (item: { key: string }) => item.key === key,
  );
  button.onClick();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tableOptions = undefined;
  mocks.tableSlots = undefined;
  mocks.getInstallations.mockResolvedValue([]);
  mocks.getEvents.mockResolvedValue([]);
  mocks.getPlugins.mockResolvedValue([]);
  mocks.getOperations.mockResolvedValue({ items: [], total: 0 });
  mocks.health.mockResolvedValue([]);
  mocks.enable.mockResolvedValue(undefined);
  mocks.disable.mockResolvedValue(undefined);
  mocks.uninstall.mockResolvedValue(undefined);
  mocks.installLocal.mockResolvedValue(undefined);
  mocks.upload.mockReset().mockResolvedValue({});
  mocks.validate.mockReset().mockResolvedValue({});
  mocks.metadata.mockResolvedValue({ pluginMap: {}, pluginOptions: [] });
  mocks.manifestModalApi.open.mockImplementation(() => {
    mocks.manifestModalOptions.onOpenChange?.(true);
  });
  mocks.manifestForm.getValues.mockReset();
  mocks.manifestForm.getValues.mockImplementation(async () => ({
    manifest: '{"pluginKey":"A"}',
  }));
  mocks.packageForm.getValues.mockReset();
  mocks.packageForm.getValues.mockImplementation(async () => ({
    packageHash: '',
    packagePath: '/mock/B.zip',
  }));
});

describe('plugin state drawer request ownership', () => {
  it('keeps a late manifest validation from emitting into a newer package mode', async () => {
    const { default: RealManifestModal } = await vi.importActual<
      typeof import('@test-source/apps/web-antdv-next/src/views/plugin-platform/plugin/components/PluginManifestModal')
    >(
      '@test-source/apps/web-antdv-next/src/views/plugin-platform/plugin/components/PluginManifestModal',
    );
    const oldValues = deferred<{ manifest: string }>();
    mocks.manifestForm.getValues.mockReturnValueOnce(oldValues.promise);
    const modal = mount(RealManifestModal, {
      props: { mode: 'validate', open: false, value: '{"pluginKey":"A"}' },
    });
    await modal.setProps({ open: true });
    await flushPromises();
    const stale = mocks.manifestModalOptions.onConfirm();
    await flushPromises();
    expect(mocks.manifestForm.getValues).toHaveBeenCalledOnce();
    await modal.setProps({ mode: 'upload', packagePath: '/mock/B.zip' });
    await flushPromises();
    oldValues.resolve({ manifest: '{"pluginKey":"A"}' });
    await stale;
    expect(modal.emitted('submit')).toBeUndefined();
    await mocks.manifestModalOptions.onConfirm();
    expect(modal.emitted('update:packagePath')?.at(-1)).toEqual([
      '/mock/B.zip',
    ]);
    expect(modal.emitted('submit')).toHaveLength(1);
    modal.unmount();
  });

  it('waits for an old manifest reset before preparing a new package mode', async () => {
    const { default: RealManifestModal } = await vi.importActual<
      typeof import('@test-source/apps/web-antdv-next/src/views/plugin-platform/plugin/components/PluginManifestModal')
    >(
      '@test-source/apps/web-antdv-next/src/views/plugin-platform/plugin/components/PluginManifestModal',
    );
    const oldReset = deferred<undefined>();
    mocks.manifestForm.resetForm.mockReturnValueOnce(oldReset.promise);
    const modal = mount(RealManifestModal, {
      props: { mode: 'validate', open: false, value: '{"pluginKey":"A"}' },
    });
    await modal.setProps({ open: true });
    await modal.setProps({ mode: 'upload', packagePath: '/mock/B.zip' });
    await flushPromises();
    expect(modal.get('section').attributes('data-disabled')).toBe('true');
    oldReset.resolve(undefined);
    await flushPromises();
    expect(mocks.packageForm.setValues).toHaveBeenCalledWith({
      packageHash: '',
      packagePath: '/mock/B.zip',
    });
    expect(modal.get('section').attributes('data-disabled')).toBe('false');
    modal.unmount();
  });
  it('does not close a new upload modal when an old validate result settles', async () => {
    const old = deferred<unknown>();
    mocks.validate.mockReturnValueOnce(old.promise);
    const page = mount(PluginList);
    await flushPromises();
    clickHeader('manifestValidate');
    await flushPromises();
    const manifest = page.findComponent({ name: 'MockManifestModal' });
    manifest.vm.$emit('submit');
    await flushPromises();
    expect(mocks.validate).toHaveBeenCalledOnce();
    manifest.vm.$emit('close');
    clickHeader('manifestUpload');
    await flushPromises();
    old.resolve({});
    await flushPromises();
    expect(manifest.attributes('data-manifest-open')).toBe('true');
    expect(manifest.attributes('data-manifest-mode')).toBe('upload');
    page.unmount();
  });

  it('invalidates a manifest result on real KeepAlive deactivation', async () => {
    const old = deferred<unknown>();
    mocks.validate.mockReturnValueOnce(old.promise);
    const active = ref(true);
    const Host = defineComponent({
      setup() {
        return () =>
          h(KeepAlive, null, {
            default: () =>
              active.value ? h(PluginList) : h('div', 'other route'),
          });
      },
    });
    const host = mount(Host);
    await flushPromises();
    clickHeader('manifestValidate');
    await flushPromises();
    const manifest = host.getComponent({ name: 'MockManifestModal' });
    manifest.vm.$emit('submit');
    await flushPromises();
    expect(mocks.validate).toHaveBeenCalledOnce();
    active.value = false;
    await nextTick();
    old.resolve({});
    await flushPromises();
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    active.value = true;
    await nextTick();
    clickHeader('manifestUpload');
    await flushPromises();
    expect(host.getComponent({ name: 'MockManifestModal' }).props('open')).toBe(
      true,
    );
    host.unmount();
  });

  it('does not call degraded plugin health a successful check', async () => {
    mocks.health.mockResolvedValueOnce([
      {
        checkedAt: '2026-09-24',
        name: '示例插件',
        status: 'degraded',
      },
    ]);
    const page = mount(PluginList);
    await flushPromises();
    clickHeader('health');
    await flushPromises();
    expect(mocks.messageWarning).toHaveBeenCalled();
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    page.unmount();
  });

  it('uses success only for confirmed healthy results and warns on empty or offline', async () => {
    const page = mount(PluginList);
    await flushPromises();
    mocks.health.mockResolvedValueOnce([
      { checkedAt: '2026-09-24', name: '插件A', status: 'healthy' },
    ]);
    clickHeader('health');
    await flushPromises();
    expect(mocks.messageSuccess).toHaveBeenCalledWith(
      expect.stringContaining('健康'),
    );
    mocks.messageSuccess.mockClear();
    mocks.health.mockResolvedValueOnce([
      { checkedAt: '2026-09-24', name: '插件A', status: 'offline' },
    ]);
    clickHeader('health');
    await flushPromises();
    expect(mocks.messageWarning).toHaveBeenCalledWith(
      expect.stringContaining('离线'),
    );
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    mocks.health.mockResolvedValueOnce([]);
    clickHeader('health');
    await flushPromises();
    expect(mocks.messageWarning).toHaveBeenCalledWith('未返回插件健康结果');
    page.unmount();
  });

  it('deduplicates a pending manifest request and leaves failure open for explicit retry', async () => {
    const pending = deferred<unknown>();
    mocks.validate.mockReturnValueOnce(pending.promise);
    const page = mount(PluginList);
    await flushPromises();
    clickHeader('manifestValidate');
    await flushPromises();
    const manifest = page.getComponent({ name: 'MockManifestModal' });
    manifest.vm.$emit('submit');
    manifest.vm.$emit('submit');
    await flushPromises();
    expect(mocks.validate).toHaveBeenCalledOnce();
    pending.reject(new Error('validate unavailable'));
    await flushPromises();
    expect(manifest.props('open')).toBe(true);
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    manifest.vm.$emit('submit');
    await flushPromises();
    expect(mocks.validate).toHaveBeenCalledTimes(2);
    expect(manifest.props('open')).toBe(false);
    page.unmount();
  });
  it('renders the complete plugin name and version through the installed Antdv Tag', async () => {
    mocks.metadata.mockResolvedValueOnce({
      pluginMap: {
        'plugin-a': { name: '示例插件', version: '1.2.3' },
      },
      pluginOptions: [],
    });
    const page = mount(PluginList);
    await flushPromises();
    const Cell = defineComponent({
      setup() {
        return () =>
          mocks.tableSlots.bodyCell({
            column: { key: 'pluginKey' },
            record: { pluginKey: 'plugin-a' },
          });
      },
    });
    const cell = mount(Cell);
    expect(cell.text()).toBe('示例插件 v1.2.3');
    cell.unmount();
    page.unmount();
  });

  it('keeps events selected after an older installation request finishes', async () => {
    const older = deferred<any[]>();
    mocks.getInstallations.mockImplementationOnce(() => older.promise);
    const wrapper = mount(PluginList);
    clickHeader('installations');
    await flushPromises();
    expect(
      wrapper.findComponent({ name: 'MockPluginDrawer' }).props('open'),
    ).toBe(true);
    clickHeader('runtimeEvents');
    await flushPromises();
    expect(
      wrapper.get('[data-drawer-mode]').attributes('data-drawer-mode'),
    ).toBe('events');
    older.resolve([]);
    await flushPromises();
    expect(
      wrapper.get('[data-drawer-mode]').attributes('data-drawer-mode'),
    ).toBe('events');
    wrapper.unmount();
  });

  it('does not reopen a closed drawer after its pending request returns', async () => {
    const pending = deferred<any[]>();
    mocks.getInstallations.mockImplementationOnce(() => pending.promise);
    const wrapper = mount(PluginList);
    clickHeader('installations');
    wrapper.findComponent({ name: 'MockPluginDrawer' }).vm.$emit('close');
    pending.resolve([]);
    await flushPromises();
    expect(
      wrapper.get('[data-drawer-open]').attributes('data-drawer-open'),
    ).toBe('false');
    wrapper.unmount();
  });

  it('opens the intended drawer with a stable retry when installation reading fails', async () => {
    mocks.getInstallations.mockRejectedValueOnce(new Error('offline'));
    const wrapper = mount(PluginList);
    clickHeader('installations');
    await flushPromises();
    expect(
      wrapper.get('[data-drawer-open]').attributes('data-drawer-open'),
    ).toBe('true');
    expect(wrapper.text()).toContain('安装记录读取失败');
    const drawer = wrapper.findComponent({ name: 'MockPluginDrawer' });
    drawer.vm.$emit('retry', 'installations');
    await flushPromises();
    expect(drawer.props('error')).toBe('');
    expect(drawer.props('known')).toBe(true);
    expect(drawer.props('installations')).toEqual([]);
    wrapper.unmount();
  });

  it('does not let post-write installation refresh replace a newer event view', async () => {
    const pending = deferred<any[]>();
    mocks.getInstallations.mockResolvedValueOnce([
      { id: 'installation-1', status: 'installed' },
    ]);
    const wrapper = mount(PluginList);
    clickHeader('installations');
    await flushPromises();
    mocks.getInstallations.mockImplementationOnce(() => pending.promise);
    const drawer = wrapper.findComponent({ name: 'MockPluginDrawer' });
    drawer.vm.$emit(
      'installationAction',
      { id: 'installation-1', status: 'installed' },
      'enable',
      drawer.props('intentRevision'),
    );
    await flushPromises();
    expect(mocks.enable).toHaveBeenCalledWith('installation-1');
    clickHeader('runtimeEvents');
    await flushPromises();
    pending.resolve([]);
    await flushPromises();
    expect(
      wrapper.get('[data-drawer-mode]').attributes('data-drawer-mode'),
    ).toBe('events');
    wrapper.unmount();
  });

  it('accepts the newer same-mode retry and ignores the older installation result', async () => {
    const older = deferred<any[]>();
    mocks.getInstallations.mockImplementationOnce(() => older.promise);
    mocks.getInstallations.mockResolvedValueOnce([{ id: 'new' }]);
    const wrapper = mount(PluginList);
    clickHeader('installations');
    const drawer = wrapper.findComponent({ name: 'MockPluginDrawer' });
    drawer.vm.$emit('retry', 'installations');
    await flushPromises();
    older.resolve([{ id: 'old' }]);
    await flushPromises();
    expect(drawer.props('installations')).toEqual([{ id: 'new' }]);
    expect(drawer.props('known')).toBe(true);
    wrapper.unmount();
  });

  it('retries a failed event read and distinguishes a confirmed empty event list', async () => {
    mocks.getEvents.mockRejectedValueOnce(new Error('events offline'));
    const wrapper = mount(PluginList);
    clickHeader('runtimeEvents');
    await flushPromises();
    const drawer = wrapper.findComponent({ name: 'MockPluginDrawer' });
    expect(drawer.props('open')).toBe(true);
    expect(drawer.props('error')).toContain('运行事件读取失败');
    expect(drawer.props('known')).toBe(false);
    drawer.vm.$emit('retry', 'events');
    await flushPromises();
    expect(drawer.props('error')).toBe('');
    expect(drawer.props('known')).toBe(true);
    expect(drawer.props('runtimeEvents')).toEqual([]);
    wrapper.unmount();
  });

  it('keeps the installation view and refreshes its own rows once after a write succeeds', async () => {
    mocks.getInstallations.mockResolvedValueOnce([
      { id: 'installation-1', status: 'installed' },
    ]);
    mocks.getInstallations.mockResolvedValueOnce([
      { id: 'installation-1', status: 'enabled' },
    ]);
    const wrapper = mount(PluginList);
    clickHeader('installations');
    await flushPromises();
    const drawer = wrapper.findComponent({ name: 'MockPluginDrawer' });
    drawer.vm.$emit(
      'installationAction',
      { id: 'installation-1', status: 'installed' },
      'enable',
      drawer.props('intentRevision'),
    );
    await flushPromises();
    expect(mocks.enable).toHaveBeenCalledOnce();
    expect(mocks.getInstallations).toHaveBeenCalledTimes(2);
    expect(drawer.props('installations')).toEqual([
      { id: 'installation-1', status: 'enabled' },
    ]);
    expect(drawer.props('mode')).toBe('installations');
    expect(drawer.props('open')).toBe(true);
    wrapper.unmount();
  });

  it('deduplicates a pending installation write and rereads after failure without success', async () => {
    const pending = deferred<undefined>();
    mocks.getInstallations.mockResolvedValueOnce([
      { id: 'installation-1', status: 'installed' },
    ]);
    mocks.getInstallations.mockResolvedValueOnce([
      { id: 'installation-1', status: 'disabled' },
    ]);
    mocks.enable.mockImplementationOnce(() => pending.promise);
    const wrapper = mount(PluginList);
    clickHeader('installations');
    await flushPromises();
    const drawer = wrapper.findComponent({ name: 'MockPluginDrawer' });
    const intent = drawer.props('intentRevision');
    const row = { id: 'installation-1', status: 'installed' };
    drawer.vm.$emit('installationAction', row, 'enable', intent);
    drawer.vm.$emit('installationAction', row, 'enable', intent);
    await flushPromises();
    expect(mocks.enable).toHaveBeenCalledOnce();
    expect(drawer.props('pendingInstallationIds')).toContain('installation-1');
    pending.reject(new Error('network unknown'));
    await flushPromises();
    expect(mocks.messageSuccess).not.toHaveBeenCalled();
    expect(mocks.messageWarning).toHaveBeenCalled();
    expect(mocks.getInstallations).toHaveBeenCalledTimes(2);
    expect(drawer.props('installations')).toEqual([
      { id: 'installation-1', status: 'disabled' },
    ]);
    expect(drawer.props('pendingInstallationIds')).toEqual([]);
    wrapper.unmount();
  });

  it('rejects an installation confirmation from a prior drawer mode', async () => {
    mocks.getInstallations.mockResolvedValueOnce([
      { id: 'installation-1', status: 'installed' },
    ]);
    const wrapper = mount(PluginList);
    clickHeader('installations');
    await flushPromises();
    const drawer = wrapper.findComponent({ name: 'MockPluginDrawer' });
    const staleIntent = drawer.props('intentRevision');
    clickHeader('runtimeEvents');
    await flushPromises();
    drawer.vm.$emit(
      'installationAction',
      { id: 'installation-1', status: 'installed' },
      'uninstall',
      staleIntent,
    );
    await flushPromises();
    expect(mocks.uninstall).not.toHaveBeenCalled();
    expect(drawer.props('mode')).toBe('events');
    wrapper.unmount();
  });

  it('does not reopen or reread installations when a write finishes after close', async () => {
    const pendingWrite = deferred<undefined>();
    mocks.getInstallations.mockResolvedValueOnce([
      { id: 'installation-1', status: 'installed' },
    ]);
    mocks.enable.mockImplementationOnce(() => pendingWrite.promise);
    const wrapper = mount(PluginList);
    clickHeader('installations');
    await flushPromises();
    const drawer = wrapper.findComponent({ name: 'MockPluginDrawer' });
    drawer.vm.$emit(
      'installationAction',
      { id: 'installation-1', status: 'installed' },
      'enable',
      drawer.props('intentRevision'),
    );
    await flushPromises();
    drawer.vm.$emit('close');
    pendingWrite.resolve(undefined);
    await flushPromises();
    expect(drawer.props('open')).toBe(false);
    expect(mocks.getInstallations).toHaveBeenCalledOnce();
    expect(drawer.props('pendingInstallationIds')).toEqual([]);
    wrapper.unmount();
  });

  it('does not read installations after a pending write finishes in the events view', async () => {
    const pendingWrite = deferred<undefined>();
    mocks.getInstallations.mockResolvedValueOnce([
      { id: 'installation-1', status: 'installed' },
    ]);
    mocks.enable.mockImplementationOnce(() => pendingWrite.promise);
    const wrapper = mount(PluginList);
    clickHeader('installations');
    await flushPromises();
    const drawer = wrapper.findComponent({ name: 'MockPluginDrawer' });
    drawer.vm.$emit(
      'installationAction',
      { id: 'installation-1', status: 'installed' },
      'enable',
      drawer.props('intentRevision'),
    );
    await flushPromises();
    clickHeader('runtimeEvents');
    await flushPromises();
    pendingWrite.resolve(undefined);
    await flushPromises();
    expect(drawer.props('mode')).toBe('events');
    expect(drawer.props('open')).toBe(true);
    expect(mocks.getInstallations).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('keeps events open when a mocked local install requests a silent installation refresh', async () => {
    const wrapper = mount(PluginList);
    clickHeader('runtimeEvents');
    await flushPromises();
    clickHeader('manifestInstall');
    await flushPromises();
    const manifest = wrapper.findComponent({ name: 'MockManifestModal' });
    manifest.vm.$emit('update:packagePath', '/mock/package.zip');
    manifest.vm.$emit('submit');
    await flushPromises();
    expect(mocks.installLocal).toHaveBeenCalledOnce();
    expect(mocks.getInstallations).not.toHaveBeenCalled();
    expect(
      wrapper.findComponent({ name: 'MockPluginDrawer' }).props('mode'),
    ).toBe('events');
    wrapper.unmount();
  });

  it('keeps an in-flight installation write across page unmount and refreshes the new page on settle', async () => {
    const pendingWrite = deferred<undefined>();
    let saved = false;
    mocks.getInstallations.mockImplementation(async () => [
      { id: 'installation-1', status: saved ? 'enabled' : 'installed' },
    ]);
    mocks.enable.mockImplementationOnce(() => pendingWrite.promise);
    const first = mount(PluginList);
    clickHeader('installations');
    await flushPromises();
    const firstDrawer = first.findComponent({ name: 'MockPluginDrawer' });
    firstDrawer.vm.$emit(
      'installationAction',
      { id: 'installation-1', status: 'installed' },
      'enable',
      firstDrawer.props('intentRevision'),
    );
    await flushPromises();
    first.unmount();

    const second = mount(PluginList);
    clickHeader('installations');
    await flushPromises();
    const secondDrawer = second.findComponent({ name: 'MockPluginDrawer' });
    expect(secondDrawer.props('pendingInstallationIds')).toContain(
      'installation-1',
    );
    secondDrawer.vm.$emit(
      'installationAction',
      { id: 'installation-1', status: 'installed' },
      'enable',
      secondDrawer.props('intentRevision'),
    );
    await flushPromises();
    expect(mocks.enable).toHaveBeenCalledOnce();
    const readsBeforeSettle = mocks.getInstallations.mock.calls.length;
    saved = true;
    pendingWrite.resolve(undefined);
    await flushPromises();
    expect(mocks.getInstallations).toHaveBeenCalledTimes(readsBeforeSettle + 1);
    expect(secondDrawer.props('installations')).toEqual([
      { id: 'installation-1', status: 'enabled' },
    ]);
    expect(secondDrawer.props('pendingInstallationIds')).toEqual([]);
    second.unmount();
  });

  it.each(['events', 'closed'] as const)(
    'does not refresh a new %s page when an old installation write settles',
    async (view) => {
      const pendingWrite = deferred<undefined>();
      mocks.getInstallations.mockResolvedValue([
        { id: 'installation-1', status: 'installed' },
      ]);
      mocks.enable.mockImplementationOnce(() => pendingWrite.promise);
      const first = mount(PluginList);
      clickHeader('installations');
      await flushPromises();
      const firstDrawer = first.findComponent({ name: 'MockPluginDrawer' });
      firstDrawer.vm.$emit(
        'installationAction',
        { id: 'installation-1', status: 'installed' },
        'enable',
        firstDrawer.props('intentRevision'),
      );
      await flushPromises();
      first.unmount();

      const second = mount(PluginList);
      if (view === 'events') clickHeader('runtimeEvents');
      await flushPromises();
      const readsBeforeSettle = mocks.getInstallations.mock.calls.length;
      pendingWrite.resolve(undefined);
      await flushPromises();
      expect(mocks.getInstallations).toHaveBeenCalledTimes(readsBeforeSettle);
      const drawer = second.findComponent({ name: 'MockPluginDrawer' });
      expect(drawer.props('pendingInstallationIds')).toEqual([]);
      if (view === 'events') {
        expect(drawer.props('mode')).toBe('events');
        expect(drawer.props('open')).toBe(true);
      } else {
        expect(drawer.props('open')).toBe(false);
      }
      second.unmount();
    },
  );
});
