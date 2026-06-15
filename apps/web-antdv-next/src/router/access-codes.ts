interface RefreshAccessCodesOptions {
  loadAccessCodes: () => Promise<string[]>;
  setAccessCodes: (codes: string[]) => void;
}

export async function refreshAccessCodes({
  loadAccessCodes,
  setAccessCodes,
}: RefreshAccessCodesOptions) {
  const accessCodes = await loadAccessCodes();
  setAccessCodes(accessCodes);
  return accessCodes;
}
