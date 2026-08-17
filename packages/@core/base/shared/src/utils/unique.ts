/**
 * 根据指定字段值去重对象数组，并保留首次出现的记录。
 *
 * @param arr - 需要按字段去重的对象数组。
 * @param key - 对象去重时读取的字段名。
 * @returns 按字段值去重且保留首次出现记录的新数组。
 */
function uniqueByField<T>(arr: T[], key: keyof T): T[] {
  const seen = new Map<any, T>();
  return arr.filter((item) => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    return (seen.set(value, item), true);
  });
}

export { uniqueByField };
