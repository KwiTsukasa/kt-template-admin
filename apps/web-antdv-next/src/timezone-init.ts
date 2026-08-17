import { setTimezoneHandler } from '@vben/stores';

import { getTimezoneApi, getTimezoneOptionsApi, setTimezoneApi } from '#/api';

/**
 * 注册时区读取、保存和候选项加载处理器，使偏好模块统一通过后端 API 管理 IANA 时区。
 */
export function initTimezone() {
  setTimezoneHandler({
    /**
     * 从后端读取当前用户时区，并同步 Day.js 默认时区。
     *
     * @returns 后端返回并已同步到 Day.js 的当前用户时区。
     */
    getTimezone() {
      return getTimezoneApi();
    },
    /**
     * 把选定 IANA 时区提交到后端，返回服务端保存结果。
     *
     * @param timezone - 要提交到后端持久化的 IANA 时区。
     * @returns 服务端保存时区后的确认结果。
     */
    setTimezone(timezone: string) {
      return setTimezoneApi(timezone);
    },
    /**
     * 返回后端支持的 IANA 时区选项，供个人设置下拉框使用。
     *
     * @returns 后端支持的 IANA 时区选项数组。
     */
    getTimezoneOptions() {
      return getTimezoneOptionsApi();
    },
  });
}
