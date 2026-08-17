import { createHash } from 'node:crypto';

/**
 * 根据内容生成指定长度的稳定十六进制哈希。
 *
 * @param content - 需要生成稳定摘要的文件或配置内容。
 * @param hashLSize - 最终十六进制哈希的字符长度。
 * @returns 截取到指定长度的十六进制内容哈希。
 */
function generatorContentHash(content: string, hashLSize?: number) {
  const hash = createHash('md5').update(content, 'utf8').digest('hex');

  if (hashLSize) {
    return hash.slice(0, hashLSize);
  }

  return hash;
}

export { generatorContentHash };
