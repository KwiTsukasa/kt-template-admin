import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace WordpressBlogApi {
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
    id: number | string;
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
    id?: number | string;
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

  export interface ArticleImportWordpressBody {
    all?: boolean;
    overwrite?: boolean;
    pageNo?: number;
    pageSize?: number;
  }

  export interface ArticleImportWordpressResult {
    created: number;
    items: Array<{
      action: 'created' | 'skipped' | 'updated';
      id: string;
      slug: string;
      title: string;
    }>;
    pageCount?: number;
    skipped: number;
    total: number;
    updated: number;
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
    id: number | string;
    name: string;
    parent?: number | string;
    slug?: string;
  }

  export interface TermBody {
    description?: string;
    id?: number | string;
    name: string;
    parent?: number | string;
    slug?: string;
  }

  export interface TermQuery extends Recordable<any> {
    hide_empty?: boolean;
    pageNo?: number;
    pageSize?: number;
    parent?: number | string;
    search?: string;
  }
}

export function getArticleList(params: WordpressBlogApi.ArticleQuery) {
  return requestClient.get<
    WordpressBlogApi.PageResult<WordpressBlogApi.Article>
  >('/blog/article/list', { params });
}

export function getArticleDetail(id: number | string) {
  return requestClient.get<WordpressBlogApi.Article>('/blog/article/detail', {
    params: { id },
  });
}

export function createArticle(data: WordpressBlogApi.ArticleBody) {
  return requestClient.post<WordpressBlogApi.Article>(
    '/blog/article/save',
    data,
  );
}

export function updateArticle(data: WordpressBlogApi.ArticleBody) {
  return requestClient.post<WordpressBlogApi.Article>(
    '/blog/article/update',
    data,
  );
}

export function deleteArticle(id: number | string) {
  return requestClient.post<WordpressBlogApi.Article>(
    `/blog/article/remove?id=${id}`,
  );
}

export function importWordpressArticles(
  data: WordpressBlogApi.ArticleImportWordpressBody,
) {
  return requestClient.post<WordpressBlogApi.ArticleImportWordpressResult>(
    '/blog/article/import-wordpress',
    data,
  );
}

export function getThemeConfig() {
  return requestClient.get<WordpressBlogApi.ThemeConfig>('/blog/theme/config');
}

export function saveThemeConfig(data: WordpressBlogApi.ThemeConfigBody) {
  return requestClient.post<WordpressBlogApi.ThemeConfig>(
    '/blog/theme/save',
    data,
  );
}

export function importWordpressThemeConfig() {
  return requestClient.post<WordpressBlogApi.ThemeConfig>(
    '/blog/theme/import-wordpress',
  );
}

export function getArticleCategoryOptions(
  params: WordpressBlogApi.TermQuery = {},
) {
  return requestClient.get<WordpressBlogApi.PageResult<WordpressBlogApi.Term>>(
    '/blog/article/category-options',
    { params },
  );
}

export function getArticleTagOptions(params: WordpressBlogApi.TermQuery = {}) {
  return requestClient.get<WordpressBlogApi.PageResult<WordpressBlogApi.Term>>(
    '/blog/article/tag-options',
    { params },
  );
}

export function getCategoryList(params: WordpressBlogApi.TermQuery = {}) {
  return requestClient.get<WordpressBlogApi.PageResult<WordpressBlogApi.Term>>(
    '/blog/category/list',
    { params },
  );
}

export function createCategory(data: WordpressBlogApi.TermBody) {
  return requestClient.post<WordpressBlogApi.Term>('/blog/category/save', data);
}

export function updateCategory(data: WordpressBlogApi.TermBody) {
  return requestClient.post<WordpressBlogApi.Term>(
    '/blog/category/update',
    data,
  );
}

export function deleteCategory(id: number | string, force = true) {
  return requestClient.post<WordpressBlogApi.Term>(
    `/blog/category/remove?id=${id}&force=${force}`,
  );
}

export function getTagList(params: WordpressBlogApi.TermQuery = {}) {
  return requestClient.get<WordpressBlogApi.PageResult<WordpressBlogApi.Term>>(
    '/blog/tag/list',
    { params },
  );
}

export function createTag(data: WordpressBlogApi.TermBody) {
  return requestClient.post<WordpressBlogApi.Term>('/blog/tag/save', data);
}

export function updateTag(data: WordpressBlogApi.TermBody) {
  return requestClient.post<WordpressBlogApi.Term>('/blog/tag/update', data);
}

export function deleteTag(id: number | string, force = true) {
  return requestClient.post<WordpressBlogApi.Term>(
    `/blog/tag/remove?id=${id}&force=${force}`,
  );
}
