import { ref } from 'vue';

const openPreferences = ref(false);

/**
 * 维护偏好设置面板显隐状态，并提供打开与关闭操作。
 *
 * @returns 偏好面板显隐状态及打开、关闭方法。
 */
function useOpenPreferences() {
  /**
   * 把偏好设置面板切换为打开状态。
   */
  function handleOpenPreference() {
    openPreferences.value = true;
  }

  return {
    handleOpenPreference,
    openPreferences,
  };
}

export { useOpenPreferences };
