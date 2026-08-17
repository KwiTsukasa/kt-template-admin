/**
 * 将字符串首字符转换为大写，其余内容保持不变。
 *
 * @param string - 需要把首字符转换为大写的字符串。
 * @returns 仅首字符转为大写后的字符串；空字符串保持为空。
 */
function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * 将字符串的首字母转换为小写。
 *
 * @param str - 要把首字符转换为小写的字符串。
 * @returns 仅首字符转为小写后的字符串；空字符串保持为空。
 */
function toLowerCaseFirstLetter(str: string): string {
  if (!str) return str; // 如果字符串为空，直接返回
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * 把父级键与当前键组合并转换为小驼峰名称。
 *
 * @param key - 要与父级键拼接的当前属性名。
 * @param parentKey - 递归生成驼峰键时已经累积的父级键前缀。
 * @returns 父级前缀与当前键组合得到的小驼峰字段名。
 */
function toCamelCase(key: string, parentKey: string): string {
  if (!parentKey) {
    return key;
  }
  return parentKey + key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * 把短横线分隔的属性名转换为小驼峰形式，供组件属性查找使用。
 *
 * @param str - 要从短横线形式转换为小驼峰形式的属性名。
 * @returns 转换后的小驼峰属性名。
 */
function kebabToCamelCase(str: string): string {
  return str
    .split('-')
    .filter(Boolean)
    .map((word, index) => {
      if (index === 0) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

export {
  capitalizeFirstLetter,
  kebabToCamelCase,
  toCamelCase,
  toLowerCaseFirstLetter,
};
