import { requestClient } from '#/api/request';

/**
 * 从后端读取系统允许选择的 IANA 时区标签和值。
 *
 * @returns 系统支持的时区标签和值数组。
 */
export async function getTimezoneOptionsApi() {
  return await requestClient.get<
    {
      label: string;
      value: string;
    }[]
  >('/timezone/getTimezoneOptions');
}
/**
 * 从后端读取当前用户时区；尚未设置时保留接口的 null 或 undefined。
 *
 * @returns 当前用户的 IANA 时区名称；尚未设置时为 null 或 undefined。
 */
export async function getTimezoneApi(): Promise<null | string | undefined> {
  return requestClient.get<null | string | undefined>('/timezone/getTimezone');
}
/**
 * 将 IANA 时区名称保存为当前用户偏好。
 *
 * @param timezone - 要保存为当前用户偏好的 IANA 时区名称。
 * @returns 时区保存请求完成后兑现的 Promise，不携带业务数据。
 */
export async function setTimezoneApi(timezone: string): Promise<void> {
  return requestClient.post('/timezone/setTimezone', { timezone });
}
