import type { Ref } from 'vue';

import { computed, ref, unref, watch } from 'vue';

/**
 * 根据一基页码和页容量截取列表，末页只返回剩余元素。
 *
 * @param list - 需要按一基页码切片的完整数据集合。
 * @param pageNo - 要截取的一基页码，必须大于或等于 1。
 * @param pageSize - 每页允许的记录数量，必须大于或等于 1。
 * @returns 当前页对应的列表切片；末页可能少于 pageSize 个元素。
 * @throws 页码或每页数量小于 1 时抛出。
 */
function pagination<T = any>(list: T[], pageNo: number, pageSize: number): T[] {
  if (pageNo < 1) throw new Error('Page number must be positive');
  if (pageSize < 1) throw new Error('Page size must be positive');

  const offset = (pageNo - 1) * Number(pageSize);
  const ret = (() => {
    if (offset + pageSize >= list.length) {
      return list.slice(offset);
    }
    return list.slice(offset, offset + pageSize);
  })();
  return ret;
}

/**
 * 维护一基页码、页容量和总数，并在总数变化时校正越界页码。
 *
 * @param list - 需要在响应式页码和页容量之间分页的数据集合。
 * @param pageSize - 每页允许的记录数量，必须大于或等于 1。
 * @param totalChangeToFirstPage - 总记录数变化时是否自动回到第一页；未传入时使用 `true`。
 * @returns 当前页码、页容量、总数及带边界校验的更新方法。
 */
export function usePagination<T = any>(
  list: Ref<T[]>,
  pageSize: number,
  totalChangeToFirstPage = true,
) {
  const currentPage = ref(1);
  const pageSizeRef = ref(pageSize);

  const totalPages = computed(() =>
    Math.ceil(unref(list).length / unref(pageSizeRef)),
  );

  const paginationList = computed(() => {
    return pagination(unref(list), unref(currentPage), unref(pageSizeRef));
  });

  const total = computed(() => {
    return unref(list).length;
  });

  if (totalChangeToFirstPage) {
    watch(total, () => {
      setCurrentPage(1);
    });
  }

  /**
   * 把分页切换到有效的一基页码；空列表只允许第一页，其他越界页码抛出。
   *
   * @param page - 目标的一基页码。
   * @throws 非空列表下目标页码小于 1 或超过总页数时抛出。
   */
  function setCurrentPage(page: number) {
    if (page === 1 && unref(totalPages) === 0) {
      currentPage.value = 1;
    } else {
      if (page < 1 || page > unref(totalPages)) {
        throw new Error('Invalid page number');
      }
      currentPage.value = page;
    }
  }

  /**
   * 设置正数页容量并重置到第一页，非正数直接抛出。
   *
   * @param pageSize - 每页允许的记录数量，必须大于或等于 1。
   * @throws 目标每页数量小于 1 时抛出。
   */
  function setPageSize(pageSize: number) {
    if (pageSize < 1) {
      throw new Error('Page size must be positive');
    }
    pageSizeRef.value = pageSize;
    // Reset to first page to prevent invalid state
    currentPage.value = 1;
  }

  return { setCurrentPage, total, setPageSize, paginationList, currentPage };
}
