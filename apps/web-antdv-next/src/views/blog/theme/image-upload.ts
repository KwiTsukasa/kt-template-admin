import { uploadBlogAsset } from '#/api/blog';

const imageExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};
export const themeImageAccept = Object.keys(imageExtensions).join(',');
export const themeImageMaxBytes = 5 * 1024 * 1024;

/**
 * 按文件内容摘要上传到既有博客公开资源目录，仅返回游客可读的持久资源地址。
 * @param file - 用户选择的图片，格式和大小通过校验后才计算摘要及上传。
 * @returns 与 SHA-256 对象键对应的博客公开资源路径，不使用鉴权下载或临时图片地址。
 * @throws 图片格式或大小不合法、浏览器无安全摘要能力、返回对象身份不匹配时拒绝上传结果。
 */
export async function uploadThemeImage(file: File) {
  const extension = imageExtensions[file.type];
  if (!Object.hasOwn(imageExtensions, file.type) || !extension)
    throw new Error('请选择 PNG、JPEG、GIF、WebP、AVIF、BMP 或 ICO 图片');
  if (file.size === 0 || file.size > themeImageMaxBytes)
    throw new Error('图片不能为空且不能超过 5 MiB');
  if (!globalThis.crypto?.subtle)
    throw new Error('图片上传需要安全浏览器环境，请使用 HTTPS 或本机地址');
  const bytes = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const basename = `theme-image.${extension}`;
  const objectName = `blog/migrated/${sha256}/${basename}`;
  const uploaded = await uploadBlogAsset(file, { objectName });
  if (uploaded.objectName !== objectName)
    throw new Error('上传图片的资源身份不匹配，原图片已保留');
  return `/api/blog/asset/${sha256}/${basename}`;
}
