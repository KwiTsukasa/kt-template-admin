import type { VueWrapper } from '@vue/test-utils';

import { createHash, webcrypto } from 'node:crypto';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { InputNumber, message, Select } from 'antdv-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getThemeConfig, saveThemeConfig, uploadBlogAsset } from '#/api/blog';

import ThemeConfigPage from '../apps/web-antdv-next/src/views/blog/theme/config';
import {
  cloneTheme,
  readTheme,
  themeGroups,
  writeTheme,
} from '../apps/web-antdv-next/src/views/blog/theme/form-model';
import { resolveThemeImagePreview } from '../apps/web-antdv-next/src/views/blog/theme/image-preview';
import { uploadThemeImage } from '../apps/web-antdv-next/src/views/blog/theme/image-upload';

const access = vi.hoisted(() => ({ allowed: true }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => access.allowed }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup(_, { slots }) {
      return () => h('section', slots.default?.());
    },
  }),
}));
vi.mock('#/api/blog', () => ({
  getThemeConfig: vi.fn(),
  saveThemeConfig: vi.fn(),
  uploadBlogAsset: vi.fn(),
  resolveKtBlogWebBaseUrl: () => 'https://example.test/blog/',
}));
// 根导出会加载未使用的日期组件；这里仅转发本页使用的真实发布组件。
vi.mock('antdv-next', async () => {
  const [
    buttonModule,
    inputModule,
    numberModule,
    selectModule,
    switchModule,
    messageModule,
    imageModule,
    uploadModule,
  ] = await Promise.all([
    import('antdv-next/dist/button/index'),
    import('antdv-next/dist/input/index'),
    import('antdv-next/dist/input-number/index'),
    import('antdv-next/dist/select/index'),
    import('antdv-next/dist/switch/index'),
    import('antdv-next/dist/message/index'),
    import('antdv-next/dist/image/index'),
    import('antdv-next/dist/upload/index'),
  ]);
  return {
    Button: buttonModule.default,
    Input: inputModule.default,
    InputNumber: numberModule.default,
    Select: selectModule.default,
    Switch: switchModule.default,
    message: messageModule.default,
    Image: imageModule.default,
    Upload: uploadModule.default,
  };
});

const fixture = {
  site: {
    title: '测试小站',
    description: '',
    home: '/',
    url: '',
    authorName: '作者',
    authorAvatar: '/avatar.jpg',
    extra: { enabled: false },
  },
  themeColor: '#c3a1ed',
  themeColorRgb: '195,161,237',
  themeVersion: '1.3.5',
  themeCardRadius: '0',
  enableCustomThemeColor: false,
  darkmodeAutoSwitch: 'legacy-mode',
  backgroundImage: '',
  backgroundOpacity: 0,
  backgroundDarkImage: '',
  backgroundDarkOpacity: 1,
  backgroundDarkBrightness: 0.65,
  argonConfig: {
    codeHighlight: {
      enable: true,
      breakLine: false,
      hideLinenumber: false,
      transparentLinenumber: false,
    },
    lazyload: { effect: 'fadeIn', threshold: 800 },
    dateFormat: 'YMD',
    disablePjax: true,
    foldLongComments: false,
    foldLongShuoshuo: false,
    headroom: 'false',
    language: 'zh_CN',
    pangu: 'article',
    pjaxAnimationDuration: 600,
    waterflowColumns: '1',
    wpPath: '/',
    zoomify: false,
    extra: null,
  },
  headerMenu: [
    { label: '首页', href: '/', metadata: { rank: 0 } },
    { label: '归档', href: '/archives', external: false },
  ],
  sidebarMenu: [],
  bodyClass: ['home', 'blog'],
  htmlClass: [],
  future: { nested: [null, false, 0, '', { title: '扩展' }] },
  'site.title': '带点的根扩展',
};
let wrapper: VueWrapper;

/**
 * 从真实组件渲染结果找到指定中文按钮，避免依赖内部实例方法。
 * @param label - 要触发的按钮文字。
 * @param root - 可选的局部节点，省略时使用完整页面。
 * @returns 匹配文字的真实按钮包装器。
 * @throws 找不到匹配中文按钮时抛出错误，避免测试静默跳过操作。
 */
function button(label: string, root = wrapper) {
  const target = root
    .findAll('button')
    .find((item) => item.text().replaceAll(/\s/g, '') === label);
  if (!target) throw new Error(`未找到按钮：${label}`);
  return target;
}

/**
 * 挂载主题页面并等待首次请求与真实 Antdv 控件回填。
 * @returns 完成初次加载的页面包装器。
 */
async function openPage() {
  wrapper = mount(ThemeConfigPage, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

/**
 * 通过真实 Upload 文件输入选择图片，让组件走实际文件选择事件路径。
 * @param path - 图片字段的完整配置路径。
 * @param file - 要传入文件选择事件的本地图片。
 */
async function selectImage(path: string, file: File) {
  const input = wrapper.get(`[data-field="${path}"] input[type="file"]`);
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [file],
  });
  await input.trigger('change');
  await flushPromises();
}

/**
 * 点击保存并取得独立请求载荷，方便核对未编辑字段的原始类型。
 * @returns 最近一次主题保存请求载荷。
 */
async function saved() {
  await button('保存配置').trigger('click');
  await flushPromises();
  return vi.mocked(saveThemeConfig).mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  access.allowed = true;
  vi.stubGlobal('crypto', webcrypto);
  vi.mocked(getThemeConfig).mockResolvedValue(cloneTheme(fixture));
  vi.mocked(saveThemeConfig).mockImplementation(async (payload) =>
    cloneTheme(payload.config ?? {}),
  );
  vi.mocked(uploadBlogAsset).mockImplementation(async (file, options) => ({
    bucketName: 'default',
    objectName: options?.objectName ?? '',
    url: '/api/minio/download',
    mimeType: file.type,
    size: file.size,
    etag: 'etag',
  }));
  vi.spyOn(message, 'success').mockImplementation(() => undefined as never);
  vi.spyOn(message, 'error').mockImplementation(() => undefined as never);
  vi.spyOn(message, 'warning').mockImplementation(() => undefined as never);
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('博客主题可视化表单（真实 Antdv 控件）', () => {
  it('所有分组同时位于一个大表单，没有分组切页或 JSON 文本编辑区，缺省字段不补写', async () => {
    await openPage();
    expect(wrapper.find('textarea').exists()).toBe(false);
    expect(wrapper.findAll('form')).toHaveLength(1);
    expect(wrapper.find('nav').exists()).toBe(false);
    expect(
      wrapper
        .findAll('button')
        .some((item) =>
          /^移除(?:列表)?$/.test(item.text().replaceAll(/\s/g, '')),
        ),
    ).toBe(false);
    for (const title of [
      '站点信息',
      '外观与背景',
      '文章与交互',
      '菜单与样式',
      '扩展字段',
    ])
      expect(wrapper.text()).toContain(title);
    expect(
      wrapper
        .findAll('button')
        .every((item) => item.attributes('type') === 'button'),
    ).toBe(true);
    for (const group of themeGroups) {
      for (const field of group.fields)
        expect(wrapper.find(`[data-field="${field.path}"]`).exists()).toBe(
          true,
        );
    }
    expect(await saved()).toEqual({ config: fixture, source: 'admin' });
  });

  it('局部修改保留 null、false、0、空字符串、数值字符串和未知字段', async () => {
    await openPage();
    await wrapper.get('[data-field="site.title"] input').setValue('新的标题');
    const expected = cloneTheme(fixture);
    expected.site.title = '新的标题';
    expect(await saved()).toEqual({ config: expected, source: 'admin' });
    expect(fixture.site.title).toBe('测试小站');
  });

  it('缺省开关只能明确设置，空值未编辑时原样保存，设置和切换立即刷新控件', async () => {
    vi.mocked(getThemeConfig).mockResolvedValue({
      site: { title: '最小配置', description: null },
    } as any);
    await openPage();
    expect(await saved()).toEqual({
      config: { site: { title: '最小配置', description: null } },
      source: 'admin',
    });
    const field = wrapper.get('[data-field="headerMenuVisible"]');
    await field
      .findAll('button')
      .find((item) => item.text().replaceAll(/\s/g, '') === '设置')
      ?.trigger('click');
    expect(
      wrapper
        .get('[data-field="headerMenuVisible"] [role="switch"]')
        .attributes('aria-checked'),
    ).toBe('true');
    await wrapper
      .get('[data-field="headerMenuVisible"] [role="switch"]')
      .trigger('click');
    expect(
      wrapper
        .get('[data-field="headerMenuVisible"] [role="switch"]')
        .attributes('aria-checked'),
    ).toBe('false');
    expect(await saved()).toEqual({
      config: {
        site: { title: '最小配置', description: null },
        headerMenuVisible: false,
      },
      source: 'admin',
    });
  });

  it('主题色合法修改联动 RGB 并立即刷新显示，原色不编辑时不重算', async () => {
    await openPage();
    await wrapper.get('[data-field="themeColor"] input').setValue('#abc');
    expect(
      (
        wrapper.get('[data-field="themeColorRgb"] input')
          .element as HTMLInputElement
      ).value,
    ).toBe('170,187,204');
    const payload = await saved();
    expect(payload?.config?.themeColorRgb).toBe('170,187,204');
    await wrapper.get('[data-field="themeColor"] input').setValue('invalid');
    await button('保存配置').trigger('click');
    expect(saveThemeConfig).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('请输入 #RGB');
  });

  it('原有开关和列数字符串只在编辑时更新，数值范围错误阻止保存', async () => {
    await openPage();
    await wrapper
      .get('[data-field="argonConfig.headroom"] [role="switch"]')
      .trigger('click');
    const columns = wrapper
      .get('[data-field="argonConfig.waterflowColumns"]')
      .findComponent(InputNumber);
    columns.vm.$emit('update:value', 3);
    await flushPromises();
    const payload = await saved();
    expect(payload?.config?.argonConfig).toMatchObject({
      headroom: 'true',
      waterflowColumns: '3',
    });
    columns.vm.$emit('update:value', 9);
    await flushPromises();
    await button('保存配置').trigger('click');
    expect(saveThemeConfig).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('请输入 1 至 6');
  });

  it('历史未知枚举具有编辑入口且未操作时仍保留', async () => {
    await openPage();
    await wrapper
      .get('[aria-label="深色模式自定义值"]')
      .setValue('future-mode');
    const payload = await saved();
    expect(payload?.config?.darkmodeAutoSwitch).toBe('future-mode');
  });

  it('菜单新增删除和上下移动保留额外字段及顺序', async () => {
    await openPage();
    await wrapper
      .get('[data-menu-item="headerMenu.1"]')
      .findAll('button')
      .find((item) => item.text().replaceAll(/\s/g, '') === '上移')
      ?.trigger('click');
    expect(
      (
        wrapper.get('[data-field="headerMenu.0.label"] input')
          .element as HTMLInputElement
      ).value,
    ).toBe('归档');
    await wrapper
      .get('[data-menu="headerMenu"]')
      .findAll('button')
      .find((item) => item.text().replaceAll(/\s/g, '') === '新增菜单')
      ?.trigger('click');
    await wrapper
      .get('[data-field="headerMenu.2.label"] input')
      .setValue('新菜单');
    await wrapper
      .get('[data-field="headerMenu.2.href"] input')
      .setValue('/new');
    await wrapper
      .get('[data-menu-item="headerMenu.0"]')
      .findAll('button')
      .find((item) => item.text().replaceAll(/\s/g, '') === '删除菜单')
      ?.trigger('click');
    const payload = await saved();
    expect(payload?.config?.headerMenu).toEqual([
      fixture.headerMenu[0],
      { label: '新菜单', href: '/new' },
    ]);
  });

  it('未知嵌套对象和数组可编辑，新键和类型切换立即更新 DOM，点号键不会遗漏', async () => {
    await openPage();
    expect(
      (
        wrapper.get('.theme-extension[data-field="site.title"] .ant-input')
          .element as HTMLInputElement
      ).value,
    ).toBe('带点的根扩展');
    await wrapper
      .get('[data-field="future.nested.4.title"] .ant-input')
      .setValue('新扩展');
    const nullType = wrapper
      .get('[data-field="future.nested.0"]')
      .findComponent(Select);
    nullType.vm.$emit('update:value', 'object');
    await flushPromises();
    await wrapper
      .get('[aria-label="future.nested.0新字段名"]')
      .setValue('child');
    await wrapper
      .get('[data-field="future.nested.0"]')
      .findAll('button')
      .find((item) => item.text().replaceAll(/\s/g, '') === '添加字段')
      ?.trigger('click');
    expect(
      wrapper.find('[data-field="future.nested.0.child"] .ant-input').exists(),
    ).toBe(true);
    await wrapper
      .get('[data-field="future.nested.0.child"] .ant-input')
      .setValue('新值');
    const payload = await saved();
    expect(payload?.config?.future).toEqual({
      nested: [{ child: '新值' }, false, 0, '', { title: '新扩展' }],
    });
  });

  it('保存失败和刷新失败保留编辑草稿', async () => {
    await openPage();
    await wrapper.get('[data-field="site.title"] input').setValue('失败时保留');
    vi.mocked(saveThemeConfig).mockRejectedValue(new Error('save failed'));
    await saved();
    expect(
      (
        wrapper.get('[data-field="site.title"] input')
          .element as HTMLInputElement
      ).value,
    ).toBe('失败时保留');
    vi.mocked(getThemeConfig).mockRejectedValue(new Error('load failed'));
    await button('刷新').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('加载失败');
    expect(
      (
        wrapper.get('[data-field="site.title"] input')
          .element as HTMLInputElement
      ).value,
    ).toBe('失败时保留');
  });

  it('样式类列表支持文本修改、新增、向下排序和删除', async () => {
    await openPage();
    await wrapper.get('[data-field="bodyClass.0"] input').setValue('page-home');
    await wrapper
      .get('[data-field="bodyClass.0"]')
      .findAll('button')
      .find((item) => item.text().replaceAll(/\s/g, '') === '下移')
      ?.trigger('click');
    expect(
      (
        wrapper.get('[data-field="bodyClass.1"] input')
          .element as HTMLInputElement
      ).value,
    ).toBe('page-home');
    await wrapper
      .get('[data-classes="bodyClass"]')
      .findAll('button')
      .find((item) => item.text().replaceAll(/\s/g, '') === '新增样式类')
      ?.trigger('click');
    await wrapper.get('[data-field="bodyClass.2"] input').setValue('custom');
    await wrapper
      .get('[data-field="bodyClass.0"]')
      .findAll('button')
      .find((item) => item.text().replaceAll(/\s/g, '') === '删除')
      ?.trigger('click');
    const payload = await saved();
    expect(payload?.config?.bodyClass).toEqual(['page-home', 'custom']);
  });

  it('首次加载失败禁止保存，缺少权限始终显示禁用操作', async () => {
    vi.mocked(getThemeConfig).mockRejectedValue(new Error('load failed'));
    await openPage();
    expect(button('保存配置').attributes('disabled')).toBeDefined();
    await button('保存配置').trigger('click');
    expect(saveThemeConfig).not.toHaveBeenCalled();
    wrapper.unmount();
    access.allowed = false;
    vi.mocked(getThemeConfig).mockResolvedValue(cloneTheme(fixture));
    await openPage();
    expect(button('保存配置').attributes('disabled')).toBeDefined();
    expect(
      wrapper.get('[data-field="site.title"] input').attributes('disabled'),
    ).toBeDefined();
  });

  it('加载与保存互斥，请求期间编辑和重复保存均被禁用', async () => {
    let resolveSave: ((value: any) => void) | undefined;
    await openPage();
    vi.mocked(saveThemeConfig).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    await button('保存配置').trigger('click');
    expect(button('刷新').attributes('disabled')).toBeDefined();
    expect(
      wrapper.get('[data-field="site.title"] input').attributes('disabled'),
    ).toBeDefined();
    await button('保存配置').trigger('click');
    expect(saveThemeConfig).toHaveBeenCalledTimes(1);
    resolveSave?.(fixture);
    await flushPromises();
  });

  it('危险键仅作为自己的配置字段读写，不污染对象原型', () => {
    const config = {};
    expect(readTheme(config, ['constructor'])).toBeUndefined();
    writeTheme(config, ['__proto__', 'polluted'], 'local');
    writeTheme(config, ['constructor', 'prototype', 'polluted'], 'local');
    expect(readTheme(config, ['__proto__', 'polluted'])).toBe('local');
    expect(readTheme(config, ['constructor', 'prototype', 'polluted'])).toBe(
      'local',
    );
    expect(({} as any).polluted).toBeUndefined();
    const copy = cloneTheme(config);
    expect(Object.hasOwn(copy, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
  });

  it('图片仅提供上传和回显，旧 Argon 图片映射不会改变未编辑原值', async () => {
    const config = cloneTheme(fixture);
    config.site.authorAvatar = '/argon/theme/profile.jpg';
    config.backgroundImage = '/argon/theme/img-2-1200x1000.jpg';
    config.backgroundDarkImage = '/argon/theme/img-1-1200x1000.jpg';
    vi.mocked(getThemeConfig).mockResolvedValue(config);
    await openPage();
    expect(
      wrapper.get('[data-field="site.authorAvatar"] img').attributes('src'),
    ).toBe('https://example.test/blog/blog-assets/avatar-tsukasa-1.jpg');
    for (const path of ['backgroundImage', 'backgroundDarkImage'])
      expect(wrapper.get(`[data-field="${path}"] img`).attributes('src')).toBe(
        'https://example.test/blog/blog-assets/bg-donggungun.png',
      );
    for (const path of [
      'site.authorAvatar',
      'backgroundImage',
      'backgroundDarkImage',
    ]) {
      expect(
        wrapper.get(`[data-field="${path}"] input`).attributes('type'),
      ).toBe('file');
      expect(
        wrapper.find(`[data-field="${path}"] input[type="text"]`).exists(),
      ).toBe(false);
    }
    expect(await saved()).toEqual({ config, source: 'admin' });
  });

  it('图片回显保留根路径、相对路径和协议相对 URL 语义，拒绝非 HTTP 图片地址', () => {
    const resolve = (value: string) =>
      resolveThemeImagePreview(
        value,
        'https://example.test/blog/',
        'https://admin.test',
      );
    expect(resolve('/blog/blog-assets/x.png')).toBe(
      'https://example.test/blog/blog-assets/x.png',
    );
    expect(resolve('/images/x.png')).toBe('https://example.test/images/x.png');
    expect(resolve('images/x.png')).toBe(
      'https://example.test/blog/images/x.png',
    );
    expect(resolve('//cdn.test/x.png')).toBe('https://cdn.test/x.png');
    expect(resolve('/api/blog/asset/x/x.png')).toBe(
      'https://admin.test/api/blog/asset/x/x.png',
    );
    expect(resolve('ftp://cdn.test/x.png')).toBe('');
    expect(resolve('blob:https://example.test/preview')).toBe('');
    expect(resolve('data:image/png;base64,abc')).toBe('');
  });

  it('真实图片选择计算摘要和安全对象键，成功回填公开持久 URL，忽略鉴权或临时返回 URL', async () => {
    await openPage();
    const file = new File(['png-content'], '背景图片.png', {
      type: 'image/png',
    });
    const sha = createHash('sha256').update('png-content').digest('hex');
    vi.mocked(uploadBlogAsset).mockImplementation(async (_, options) => ({
      bucketName: 'default',
      objectName: options?.objectName ?? '',
      url: 'blob:temporary-upload-preview',
      mimeType: 'image/png',
      size: 11,
      etag: 'etag',
    }));
    await selectImage('site.authorAvatar', file);
    expect(uploadBlogAsset).toHaveBeenCalledWith(file, {
      objectName: `blog/migrated/${sha}/theme-image.png`,
    });
    const url = `/api/blog/asset/${sha}/theme-image.png`;
    expect(
      wrapper.get('[data-field="site.authorAvatar"] img').attributes('src'),
    ).toBe(new URL(url, window.location.origin).href);
    const payload = await saved();
    expect(payload?.config?.site?.authorAvatar).toBe(url);
    expect(JSON.stringify(payload)).not.toContain('blob:');
    expect(JSON.stringify(payload)).not.toContain('/minio/download');
  });

  it('上传失败或资源身份错误保留此前图片，格式和大小无效时不调用接口', async () => {
    await openPage();
    const file = new File(['png-content'], 'photo.png', { type: 'image/png' });
    vi.mocked(uploadBlogAsset).mockRejectedValueOnce(new Error('上传失败模拟'));
    await selectImage('site.authorAvatar', file);
    expect(wrapper.text()).toContain('上传失败模拟');
    const firstPayload = await saved();
    expect(firstPayload?.config?.site?.authorAvatar).toBe(
      fixture.site.authorAvatar,
    );
    vi.mocked(uploadBlogAsset).mockResolvedValueOnce({
      bucketName: 'default',
      objectName: 'wrong-object',
      url: '/wrong',
      mimeType: 'image/png',
      size: 1,
      etag: 'etag',
    });
    await selectImage('site.authorAvatar', file);
    expect(wrapper.text()).toContain('资源身份不匹配');
    await selectImage(
      'site.authorAvatar',
      new File(['text'], 'bad.txt', { type: 'text/plain' }),
    );
    const large = new File(['png'], 'large.png', { type: 'image/png' });
    Object.defineProperty(large, 'size', { value: 6 * 1024 * 1024 });
    await selectImage('site.authorAvatar', large);
    expect(uploadBlogAsset).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('不能超过 5 MiB');
    const payload = await saved();
    expect(payload?.config?.site?.authorAvatar).toBe(fixture.site.authorAvatar);
  });

  it('上传中锁定保存刷新和重复上传，受控成功路径仍写入草稿；无权限拒绝上传', async () => {
    await openPage();
    let resolveUpload: ((value: any) => void) | undefined;
    vi.mocked(uploadBlogAsset).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const file = new File(['png-content'], 'photo.png', { type: 'image/png' });
    await selectImage('backgroundImage', file);
    expect(button('保存配置').attributes('disabled')).toBeDefined();
    expect(button('刷新').attributes('disabled')).toBeDefined();
    expect(
      wrapper
        .get('[data-field="site.authorAvatar"] input[type="file"]')
        .attributes('disabled'),
    ).toBeDefined();
    await selectImage('site.authorAvatar', file);
    expect(uploadBlogAsset).toHaveBeenCalledTimes(1);
    const sha = createHash('sha256').update('png-content').digest('hex');
    resolveUpload?.({ objectName: `blog/migrated/${sha}/theme-image.png` });
    await flushPromises();
    const payload = await saved();
    expect(payload?.config?.backgroundImage).toBe(
      `/api/blog/asset/${sha}/theme-image.png`,
    );
    wrapper.unmount();
    access.allowed = false;
    await openPage();
    await selectImage('site.authorAvatar', file);
    expect(uploadBlogAsset).toHaveBeenCalledTimes(1);
  });

  it('浏览器缺少安全摘要能力时明确失败且不发起上传', async () => {
    vi.stubGlobal('crypto', {});
    await expect(
      uploadThemeImage(new File(['png'], 'photo.png', { type: 'image/png' })),
    ).rejects.toThrow('安全浏览器环境');
    expect(uploadBlogAsset).not.toHaveBeenCalled();
  });
});
