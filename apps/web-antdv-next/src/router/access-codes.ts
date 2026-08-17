interface RefreshAccessCodesOptions {
  loadAccessCodes: () => Promise<string[]>;
  setAccessCodes: (codes: string[]) => void;
}

/**
 * 重新读取当前用户访问码并同步权限 store，返回本次加载到的完整访问码集合。
 *
 * @returns 从后端重新加载并写入 store 的访问码集合。
 */
export async function refreshAccessCodes({
  loadAccessCodes,
  setAccessCodes,
}: RefreshAccessCodesOptions) {
  const accessCodes = await loadAccessCodes();
  setAccessCodes(accessCodes);
  return accessCodes;
}
