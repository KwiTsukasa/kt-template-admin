/**
 * 将变量映射写入指定 style 元素；元素不存在时先创建并挂载。
 *
 * @param variables - 需要写入 document 根节点的 CSS 变量名和值。
 * @param id - 承载动态 CSS 变量的 style 元素标识；未传入时使用 `'__vben-styles__'`。
 */
function updateCSSVariables(
  variables: { [key: string]: string },
  id = '__vben-styles__',
): void {
  // 获取或创建内联样式表元素
  const styleElement =
    document.querySelector(`#${id}`) || document.createElement('style');

  styleElement.id = id;

  // 构建要更新的 CSS 变量的样式文本
  let cssText = ':root {';
  for (const key in variables) {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      cssText += `${key}: ${variables[key]};`;
    }
  }
  cssText += '}';

  // 将样式文本赋值给内联样式表
  styleElement.textContent = cssText;

  // 将内联样式表添加到文档头部
  if (!document.querySelector(`#${id}`)) {
    setTimeout(() => {
      document.head.append(styleElement);
    });
  }
}

export { updateCSSVariables };
