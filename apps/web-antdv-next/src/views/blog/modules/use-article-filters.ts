export interface BlogArticleFilters {
  categories?: string[];
  tags?: string[];
}

let pendingFilters: BlogArticleFilters | null = null;

/**
 * 复制分类与标签筛选到一次性缓存，避免调用方后续修改原数组影响待恢复条件。
 *
 * @param filters - 要复制进一次性缓存的分类与标签筛选条件。
 */
export function setBlogArticleFilters(filters: BlogArticleFilters) {
  pendingFilters = {
    categories: (() => {
      if (filters.categories) {
        return [...filters.categories];
      }
      return undefined;
    })(),
    tags: (() => {
      if (filters.tags) {
        return [...filters.tags];
      }
      return undefined;
    })(),
  };
}

/**
 * 读取并清除一次性的文章筛选缓存，避免返回列表时重复套用旧条件。
 *
 * @returns 尚未消费的文章筛选条件；没有缓存时返回 undefined。
 */
export function consumeBlogArticleFilters() {
  const filters = pendingFilters;
  pendingFilters = null;

  return filters;
}
