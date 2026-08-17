import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

type FormatDate = Date | dayjs.Dayjs | number | string;

type Format =
  | 'HH'
  | 'HH:mm'
  | 'HH:mm:ss'
  | 'YYYY'
  | 'YYYY-MM'
  | 'YYYY-MM-DD'
  | 'YYYY-MM-DD HH'
  | 'YYYY-MM-DD HH:mm'
  | 'YYYY-MM-DD HH:mm:ss'
  | (string & {});

/**
 * 按当前时区把日期值格式化为指定模板，无效输入回退为原始字符串。
 *
 * @param time - 待格式化的日期、时间戳或 Day.js 值。
 * @param format - Day.js 接受的目标日期格式字符串；未传入时使用 `'YYYY-MM-DD'`。
 * @returns 按指定模板与当前时区格式化的文本；日期无效时返回原始输入的字符串形式。
 * @throws 当 Day.js 判定输入无效时由内部校验抛出；本函数捕获后记录错误并返回原始文本。
 */
export function formatDate(time?: FormatDate, format: Format = 'YYYY-MM-DD') {
  try {
    const date = (() => {
      if (dayjs.isDayjs(time)) {
        return time;
      }
      return dayjs(time);
    })();
    if (!date.isValid()) {
      throw new Error('Invalid date');
    }
    return date.tz().format(format);
  } catch (error) {
    console.error(`Error formatting date: ${error}`);
    return String(time ?? '');
  }
}

/**
 * 按当前时区把日期值格式化为完整年月日与时分秒。
 *
 * @param time - 待格式化的日期、时间戳或 Day.js 值。
 * @returns 按当前时区格式化的年月日时分秒文本；日期无效时返回原始输入的字符串形式。
 */
export function formatDateTime(time?: FormatDate) {
  return formatDate(time, 'YYYY-MM-DD HH:mm:ss');
}

/**
 * 通过 Date 实例检查识别原生日期对象。
 *
 * @param value - 待判别的值；仅原生 Date 实例通过检查。
 * @returns 输入是原生 Date 实例时返回 true，否则返回 false。
 */
export function isDate(value: any): value is Date {
  return value instanceof Date;
}

/**
 * 通过 Day.js 官方类型检查识别 Day.js 实例。
 *
 * @param value - 待判别的值；通过 Day.js 官方 isDayjs 检查才有效。
 * @returns 输入通过 Day.js 实例检查时返回 true，否则返回 false。
 */
export function isDayjsObject(value: any): value is dayjs.Dayjs {
  return dayjs.isDayjs(value);
}

export const getSystemTimezone = () => {
  return dayjs.tz.guess();
};

let currentTimezone = getSystemTimezone();

export const setCurrentTimezone = (timezone?: string) => {
  currentTimezone = timezone || getSystemTimezone();
  dayjs.tz.setDefault(currentTimezone);
};

export const getCurrentTimezone = () => {
  return currentTimezone;
};
