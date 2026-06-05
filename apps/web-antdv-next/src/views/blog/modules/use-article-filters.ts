export interface BlogArticleFilters {
  categories?: Array<number | string>;
  tags?: Array<number | string>;
}

let pendingFilters: BlogArticleFilters | null = null;

export function setBlogArticleFilters(filters: BlogArticleFilters) {
  pendingFilters = {
    categories: filters.categories ? [...filters.categories] : undefined,
    tags: filters.tags ? [...filters.tags] : undefined,
  };
}

export function consumeBlogArticleFilters() {
  const filters = pendingFilters;
  pendingFilters = null;

  return filters;
}
