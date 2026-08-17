import { ref, unref } from 'vue';

import { DEFAULT_TIME_ZONE_OPTIONS } from '@vben-core/preferences';
import {
  getCurrentTimezone,
  setCurrentTimezone,
} from '@vben-core/shared/utils';

import { acceptHMRUpdate, defineStore } from 'pinia';

interface TimezoneHandler {
  getTimezone?: () => Promise<null | string | undefined>;
  getTimezoneOptions?: () => Promise<
    {
      label: string;
      value: string;
    }[]
  >;
  setTimezone?: (timezone: string) => Promise<void>;
}

const getDefaultTimezoneHandler = (): TimezoneHandler => {
  return {
    getTimezoneOptions: () => {
      return Promise.resolve(
        DEFAULT_TIME_ZONE_OPTIONS.map((item) => {
          return {
            label: item.label,
            value: item.timezone,
          };
        }),
      );
    },
  };
};

let customTimezoneHandler: null | Partial<TimezoneHandler> = null;
const setTimezoneHandler = (handler: Partial<TimezoneHandler>) => {
  customTimezoneHandler = handler;
};

const getTimezoneHandler = () => {
  return {
    ...getDefaultTimezoneHandler(),
    ...customTimezoneHandler,
  };
};

const useTimezoneStore = defineStore(
  'core-timezone',
  () => {
    const timezoneRef = ref(getCurrentTimezone());

    /**
     * 从宿主时区处理器读取用户时区，并同步 store 与 Day.js 默认时区。
     */
    async function initTimezone() {
      const timezoneHandler = getTimezoneHandler();
      const timezone = await timezoneHandler.getTimezone?.();
      if (timezone) {
        timezoneRef.value = timezone;
      }
      // 设置dayjs默认时区
      setCurrentTimezone(unref(timezoneRef));
    }

    /**
     * 通过宿主时区处理器保存新时区，并同步 store 与 Day.js 默认时区。
     *
     * @param timezone - 要由宿主保存并同步为 Day.js 默认值的 IANA 时区。
     */
    async function setTimezone(timezone: string) {
      const timezoneHandler = getTimezoneHandler();
      await timezoneHandler.setTimezone?.(timezone);
      timezoneRef.value = timezone;
      // 设置dayjs默认时区
      setCurrentTimezone(timezone);
    }

    /**
     * 从宿主时区处理器读取可选 IANA 时区；未配置处理器时返回空数组。
     *
     * @returns 宿主处理器返回的 IANA 时区选项；未配置处理器或结果为空时返回空数组。
     */
    async function getTimezoneOptions() {
      const timezoneHandler = getTimezoneHandler();
      return (await timezoneHandler.getTimezoneOptions?.()) || [];
    }

    initTimezone().catch((error) => {
      console.error('Failed to initialize timezone during store setup:', error);
    });

    /**
     * 将时区 store 恢复为 Day.js 当前默认时区，避免持久化旧值继续影响页面。
     */
    function $reset() {
      timezoneRef.value = getCurrentTimezone();
    }

    return {
      timezone: timezoneRef,
      setTimezone,
      getTimezoneOptions,
      $reset,
    };
  },
  {
    persist: {
      // 持久化
      pick: ['timezone'],
    },
  },
);

export { setTimezoneHandler, useTimezoneStore };

// 解决热更新问题
const hot = import.meta.hot;
if (hot) {
  hot.accept(acceptHMRUpdate(useTimezoneStore, hot));
}
