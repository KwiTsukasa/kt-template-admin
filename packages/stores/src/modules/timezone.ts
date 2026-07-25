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

    async function initTimezone() {
      const timezoneHandler = getTimezoneHandler();
      const timezone = await timezoneHandler.getTimezone?.();
      if (timezone) {
        timezoneRef.value = timezone;
      }
      // 设置dayjs默认时区
      setCurrentTimezone(unref(timezoneRef));
    }

    async function setTimezone(timezone: string) {
      const timezoneHandler = getTimezoneHandler();
      await timezoneHandler.setTimezone?.(timezone);
      timezoneRef.value = timezone;
      // 设置dayjs默认时区
      setCurrentTimezone(timezone);
    }

    async function getTimezoneOptions() {
      const timezoneHandler = getTimezoneHandler();
      return (await timezoneHandler.getTimezoneOptions?.()) || [];
    }

    initTimezone().catch((error) => {
      console.error('Failed to initialize timezone during store setup:', error);
    });

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
