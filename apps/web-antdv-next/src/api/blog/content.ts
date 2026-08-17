import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace BlogApi {
  export interface PageResult<T> {
    list: T[];
    total: number;
  }

  export interface RenderedField {
    raw?: string;
    rendered?: string;
  }

  export interface Article {
    categories?: string[];
    categoriesResolved?: Term[];
    content?: RenderedField | string;
    contentHtml?: string;
    contentMarkdown?: string;
    date?: string;
    excerpt?: RenderedField | string;
    id: string;
    link?: string;
    modified?: string;
    slug?: string;
    status?: string;
    sticky?: boolean;
    tags?: string[];
    tagsResolved?: Term[];
    title?: RenderedField | string;
  }

  export interface ArticleBody {
    authorName?: string;
    categories?: string[];
    content?: string;
    contentFormat?: 'html' | 'markdown';
    cover?: string;
    excerpt?: string;
    id?: string;
    slug?: string;
    status?: string;
    sticky?: boolean;
    tags?: string[];
    title: string;
  }

  export interface ArticleQuery extends Recordable<any> {
    categories?: string | string[];
    pageNo?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    tags?: string | string[];
  }

  export interface ThemeConfig {
    argonConfig?: Record<string, any>;
    backgroundDarkBrightness?: number;
    backgroundDarkImage?: string;
    backgroundDarkOpacity?: number;
    backgroundImage?: string;
    backgroundOpacity?: number;
    bodyClass?: string[];
    darkmodeAutoSwitch?: string;
    enableCustomThemeColor?: boolean;
    headerMenu?: ThemeMenuItem[];
    htmlClass?: string[];
    site?: {
      authorAvatar?: string;
      authorName?: string;
      description?: string;
      home?: string;
      title?: string;
      url?: string;
    };
    sidebarMenu?: ThemeMenuItem[];
    themeCardRadius?: number | string;
    themeColor?: string;
    themeColorRgb?: string;
    themeVersion?: string;
  }

  export interface ThemeMenuItem {
    external?: boolean;
    href: string;
    icon?: string;
    label: string;
  }

  export interface ThemeConfigBody {
    config?: ThemeConfig;
    source?: string;
  }

  export interface Term {
    count?: number;
    description?: string;
    id: string;
    name: string;
    parent?: string;
    slug?: string;
  }

  export interface TermBody {
    description?: string;
    id?: string;
    name: string;
    parent?: string;
    slug?: string;
  }

  export interface TermQuery extends Recordable<any> {
    hide_empty?: boolean;
    pageNo?: number;
    pageSize?: number;
    parent?: string;
    search?: string;
  }
}

/**
 * 根据关键词、状态、分类、标签和分页条件查询博客文章。
 *
 * @param params - 文章关键词、状态、分类、标签和分页条件。
 * @returns 包含匹配文章记录和总数的分页结果；没有匹配文章时记录数组为空。
 */
export function getArticleList(params: BlogApi.ArticleQuery) {
  return requestClient.get<BlogApi.PageResult<BlogApi.Article>>(
    '/blog/article/list',
    { params },
  );
}

/**
 * 根据文章标识读取正文、内容格式、分类标签与发布状态。
 *
 * @param id - 需要加载正文、分类和标签等详情的文章标识。
 * @returns 与标识匹配的文章正文、内容格式、分类标签和发布状态。
 */
export function getArticleDetail(id: string) {
  return requestClient.get<BlogApi.Article>('/blog/article/detail', {
    params: { id },
  });
}

/**
 * 持久化文章标题、正文、分类标签和发布状态，并返回新记录。
 *
 * @param data - 新文章的标题、正文、内容格式、发布状态、分类与标签等字段。
 * @returns 持久化后的完整文章记录，包含后端分配的标识和规范化字段。
 */
export function createArticle(data: BlogApi.ArticleBody) {
  return requestClient.post<BlogApi.Article>('/blog/article/save', data);
}

/**
 * 根据载荷中的文章标识保存正文、分类标签与发布状态变更。
 *
 * @param data - 包含文章标识及待保存标题、正文、状态、分类和标签的字段。
 * @returns 保存后的完整文章记录，包含最新正文、分类、标签和发布状态。
 */
export function updateArticle(data: BlogApi.ArticleBody) {
  return requestClient.post<BlogApi.Article>('/blog/article/update', data);
}

/**
 * 删除指定文章，并返回服务端删除后的文章记录。
 *
 * @param id - 需要移除的文章标识。
 * @returns 服务端删除后返回的文章记录。
 */
export function deleteArticle(id: string) {
  return requestClient.post<BlogApi.Article>(`/blog/article/remove?id=${id}`);
}

/**
 * 读取博客站点当前主题配置，供管理端 JSON 编辑器回填。
 *
 * @returns 博客站点当前持久化的主题配置对象。
 */
export function getThemeConfig() {
  return requestClient.get<BlogApi.ThemeConfig>('/blog/theme/config');
}

/**
 * 把管理端主题配置提交给后端持久化，并返回服务端保存后的配置。
 *
 * @param data - 主题配置对象及其可选源码文本；后端保存后返回规范化配置。
 * @returns 后端保存并规范化后的主题配置对象。
 */
export function saveThemeConfig(data: BlogApi.ThemeConfigBody) {
  return requestClient.post<BlogApi.ThemeConfig>('/blog/theme/save', data);
}

/**
 * 根据搜索词与分页条件读取可绑定到文章的分类记录。
 *
 * @param params - 分类名称、父级、空分类开关和分页条件；省略时加载默认分类页。
 * @returns 包含匹配分类记录和总数的分页结果；没有匹配项时记录数组为空。
 */
export function getArticleCategoryOptions(params: BlogApi.TermQuery = {}) {
  return requestClient.get<BlogApi.PageResult<BlogApi.Term>>(
    '/blog/article/category-options',
    { params },
  );
}

/**
 * 根据搜索词与分页条件读取可绑定到文章的标签记录。
 *
 * @param params - 标签名称、父级、空标签开关和分页条件；省略时加载默认标签页。
 * @returns 包含匹配标签记录和总数的分页结果；没有匹配项时记录数组为空。
 */
export function getArticleTagOptions(params: BlogApi.TermQuery = {}) {
  return requestClient.get<BlogApi.PageResult<BlogApi.Term>>(
    '/blog/article/tag-options',
    { params },
  );
}

/**
 * 根据搜索词、父级和分页条件查询博客分类。
 *
 * @param params - 分类搜索词、父级、空分类开关和分页条件；缺省时不附加筛选。
 * @returns 包含匹配分类记录和总数的分页结果；没有匹配分类时记录数组为空。
 */
export function getCategoryList(params: BlogApi.TermQuery = {}) {
  return requestClient.get<BlogApi.PageResult<BlogApi.Term>>(
    '/blog/category/list',
    { params },
  );
}

/**
 * 持久化分类名称、别名、父级和说明，并返回新分类。
 *
 * @param data - 新分类的名称及可选 slug、父级和描述。
 * @returns 持久化后的分类记录，包含后端分配的标识。
 */
export function createCategory(data: BlogApi.TermBody) {
  return requestClient.post<BlogApi.Term>('/blog/category/save', data);
}

/**
 * 根据分类标识保存名称、别名、父级和说明变更。
 *
 * @param data - 包含分类标识及待保存名称、slug、父级和描述的字段。
 * @returns 保存名称、slug、父级和描述后的分类记录。
 */
export function updateCategory(data: BlogApi.TermBody) {
  return requestClient.post<BlogApi.Term>('/blog/category/update', data);
}

/**
 * 按 force 参数删除指定分类；省略时请求永久删除。
 *
 * @param id - 需要删除或移入回收站的分类标识。
 * @param force - 是否跳过回收站直接永久删除；省略时为 true。
 * @returns 服务端删除或回收处理后返回的分类记录。
 */
export function deleteCategory(id: string, force = true) {
  return requestClient.post<BlogApi.Term>(
    `/blog/category/remove?id=${id}&force=${force}`,
  );
}

/**
 * 根据搜索词、父级和分页条件查询博客标签。
 *
 * @param params - 标签搜索词、父级、空标签开关和分页条件；缺省时不附加筛选。
 * @returns 包含匹配标签记录和总数的分页结果；没有匹配标签时记录数组为空。
 */
export function getTagList(params: BlogApi.TermQuery = {}) {
  return requestClient.get<BlogApi.PageResult<BlogApi.Term>>('/blog/tag/list', {
    params,
  });
}

/**
 * 持久化标签名称、别名和说明，并返回新标签。
 *
 * @param data - 新标签的名称及可选 slug、父级和描述。
 * @returns 持久化后的标签记录，包含后端分配的标识。
 */
export function createTag(data: BlogApi.TermBody) {
  return requestClient.post<BlogApi.Term>('/blog/tag/save', data);
}

/**
 * 根据标签标识保存名称、别名和说明变更。
 *
 * @param data - 包含标签标识及待保存名称、slug、父级和描述的字段。
 * @returns 保存名称、slug、父级和描述后的标签记录。
 */
export function updateTag(data: BlogApi.TermBody) {
  return requestClient.post<BlogApi.Term>('/blog/tag/update', data);
}

/**
 * 按 force 参数删除指定标签；省略时请求永久删除。
 *
 * @param id - 需要删除或移入回收站的标签标识。
 * @param force - 是否跳过回收站直接永久删除；省略时为 true。
 * @returns 服务端删除或回收处理后返回的标签记录。
 */
export function deleteTag(id: string, force = true) {
  return requestClient.post<BlogApi.Term>(
    `/blog/tag/remove?id=${id}&force=${force}`,
  );
}
