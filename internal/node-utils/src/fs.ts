import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

/**
 * 创建目标目录并按指定缩进写入 JSON 文件，保证 UTF-8 文本输出。
 *
 * @param filePath - JSON 文本最终写入的文件路径；父目录不存在时会创建。
 * @param data - 需要序列化并写入目标文件的 JSON 数据。
 * @param spaces - JSON 序列化使用的缩进空格数；未传入时使用 `2`。
 * @throws 创建目录、序列化或写入文件失败时重新抛出原始异常。
 */
export async function outputJSON(
  filePath: string,
  data: any,
  spaces: number = 2,
) {
  try {
    const dir = dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const jsonData = JSON.stringify(data, null, spaces);
    await fs.writeFile(filePath, jsonData, 'utf8');
  } catch (error) {
    console.error('Error writing JSON file:', error);
    throw error;
  }
}

/**
 * 递归创建目标父目录并以追加模式确保文件存在，文件系统错误会记录后重新抛出。
 *
 * @param filePath - 需要确保存在的文件路径；父目录不存在时会创建。
 * @throws 创建父目录或确保文件存在失败时重新抛出原始文件系统异常。
 */
export async function ensureFile(filePath: string) {
  try {
    const dir = dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, '', { flag: 'a' });
  } catch (error) {
    console.error('Error ensuring file:', error);
    throw error;
  }
}

/**
 * 以 UTF-8 读取目标文件并解析 JSON，解析或读取失败时保留原始异常。
 *
 * @param filePath - 需要以 UTF-8 读取并解析的 JSON 文件路径。
 * @returns 目标文件解析得到的 JSON 值。
 * @throws 读取文件或解析 JSON 失败时重新抛出原始异常。
 */
export async function readJSON(filePath: string) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading JSON file:', error);
    throw error;
  }
}
