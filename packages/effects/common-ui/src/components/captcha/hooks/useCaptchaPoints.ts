import type { CaptchaPoint } from '../types';

import { reactive } from 'vue';

/**
 * 维护图片验证码点击坐标，限制最大点数并支持按点删除与全部清空。
 *
 * @returns 验证码坐标集合及添加、删除和清空方法。
 */
export function useCaptchaPoints() {
  const points = reactive<CaptchaPoint[]>([]);
  /**
   * 把新的验证码坐标点加入集合，并在达到上限前保持点击顺序。
   *
   * @param point - 验证码图片上新增或删除的坐标点。
   */
  function addPoint(point: CaptchaPoint) {
    points.push(point);
  }

  /**
   * 移除图片验证码已选择的全部坐标点，供用户重新选择验证位置。
   */
  function clearPoints() {
    points.splice(0);
  }
  return {
    addPoint,
    clearPoints,
    points,
  };
}
