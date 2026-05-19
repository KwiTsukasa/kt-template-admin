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
    categories?: number[];
    content?: RenderedField | string;
    date?: string;
    excerpt?: RenderedField | string;
    id: number;
    link?: string;
    modified?: string;
    slug?: string;
    status?: string;
    sticky?: boolean;
    tags?: number[];
    title?: RenderedField | string;
  }

  export interface ArticleBody {
    categories?: number[];
    content?: string;
    excerpt?: string;
    id?: number;
    slug?: string;
    status?: string;
    sticky?: boolean;
    tags?: number[];
    title: string;
  }

  export interface ArticleQuery extends Recordable<any> {
    categories?: number[] | string;
    pageNo?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    tags?: number[] | string;
  }

  export interface Term {
    count?: number;
    description?: string;
    id: number;
    name: string;
    parent?: number;
    slug?: string;
  }

  export interface TermBody {
    description?: string;
    id?: number;
    name: string;
    parent?: number;
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
  >('/wordpress/article/list', { params });
}

export function getArticleDetail(id: number | string) {
  return requestClient.get<WordpressBlogApi.Article>(
    '/wordpress/article/detail',
    { params: { id } },
  );
}

export function createArticle(data: WordpressBlogApi.ArticleBody) {
  return requestClient.post<WordpressBlogApi.Article>(
    '/wordpress/article/save',
    data,
  );
}

export function updateArticle(data: WordpressBlogApi.ArticleBody) {
  return requestClient.post<WordpressBlogApi.Article>(
    '/wordpress/article/update',
    data,
  );
}

export function deleteArticle(id: number | string, force = true) {
  return requestClient.post<WordpressBlogApi.Article>(
    `/wordpress/article/remove?id=${id}&force=${force}`,
  );
}

export function getCategoryList(params: WordpressBlogApi.TermQuery = {}) {
  return requestClient.get<WordpressBlogApi.PageResult<WordpressBlogApi.Term>>(
    '/wordpress/category/list',
    { params },
  );
}

export function createCategory(data: WordpressBlogApi.TermBody) {
  return requestClient.post<WordpressBlogApi.Term>(
    '/wordpress/category/save',
    data,
  );
}

export function updateCategory(data: WordpressBlogApi.TermBody) {
  return requestClient.post<WordpressBlogApi.Term>(
    '/wordpress/category/update',
    data,
  );
}

export function deleteCategory(id: number | string, force = true) {
  return requestClient.post<WordpressBlogApi.Term>(
    `/wordpress/category/remove?id=${id}&force=${force}`,
  );
}

export function getTagList(params: WordpressBlogApi.TermQuery = {}) {
  return requestClient.get<WordpressBlogApi.PageResult<WordpressBlogApi.Term>>(
    '/wordpress/tag/list',
    { params },
  );
}

export function createTag(data: WordpressBlogApi.TermBody) {
  return requestClient.post<WordpressBlogApi.Term>('/wordpress/tag/save', data);
}

export function updateTag(data: WordpressBlogApi.TermBody) {
  return requestClient.post<WordpressBlogApi.Term>(
    '/wordpress/tag/update',
    data,
  );
}

export function deleteTag(id: number | string, force = true) {
  return requestClient.post<WordpressBlogApi.Term>(
    `/wordpress/tag/remove?id=${id}&force=${force}`,
  );
}
