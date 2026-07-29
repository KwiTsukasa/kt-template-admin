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

export function getArticleList(params: BlogApi.ArticleQuery) {
  return requestClient.get<BlogApi.PageResult<BlogApi.Article>>(
    '/blog/article/list',
    { params },
  );
}

export function getArticleDetail(id: string) {
  return requestClient.get<BlogApi.Article>('/blog/article/detail', {
    params: { id },
  });
}

export function createArticle(data: BlogApi.ArticleBody) {
  return requestClient.post<BlogApi.Article>('/blog/article/save', data);
}

export function updateArticle(data: BlogApi.ArticleBody) {
  return requestClient.post<BlogApi.Article>('/blog/article/update', data);
}

export function deleteArticle(id: string) {
  return requestClient.post<BlogApi.Article>(`/blog/article/remove?id=${id}`);
}

export function getThemeConfig() {
  return requestClient.get<BlogApi.ThemeConfig>('/blog/theme/config');
}

export function saveThemeConfig(data: BlogApi.ThemeConfigBody) {
  return requestClient.post<BlogApi.ThemeConfig>('/blog/theme/save', data);
}

export function getArticleCategoryOptions(params: BlogApi.TermQuery = {}) {
  return requestClient.get<BlogApi.PageResult<BlogApi.Term>>(
    '/blog/article/category-options',
    { params },
  );
}

export function getArticleTagOptions(params: BlogApi.TermQuery = {}) {
  return requestClient.get<BlogApi.PageResult<BlogApi.Term>>(
    '/blog/article/tag-options',
    { params },
  );
}

export function getCategoryList(params: BlogApi.TermQuery = {}) {
  return requestClient.get<BlogApi.PageResult<BlogApi.Term>>(
    '/blog/category/list',
    { params },
  );
}

export function createCategory(data: BlogApi.TermBody) {
  return requestClient.post<BlogApi.Term>('/blog/category/save', data);
}

export function updateCategory(data: BlogApi.TermBody) {
  return requestClient.post<BlogApi.Term>('/blog/category/update', data);
}

export function deleteCategory(id: string, force = true) {
  return requestClient.post<BlogApi.Term>(
    `/blog/category/remove?id=${id}&force=${force}`,
  );
}

export function getTagList(params: BlogApi.TermQuery = {}) {
  return requestClient.get<BlogApi.PageResult<BlogApi.Term>>('/blog/tag/list', {
    params,
  });
}

export function createTag(data: BlogApi.TermBody) {
  return requestClient.post<BlogApi.Term>('/blog/tag/save', data);
}

export function updateTag(data: BlogApi.TermBody) {
  return requestClient.post<BlogApi.Term>('/blog/tag/update', data);
}

export function deleteTag(id: string, force = true) {
  return requestClient.post<BlogApi.Term>(
    `/blog/tag/remove?id=${id}&force=${force}`,
  );
}
