import type { CSSProperties } from 'vue';

import type { ClassType } from '@vben/types';

export interface CaptchaData {
  x: number;
  y: number;
  t: number;
}
export interface CaptchaPoint extends CaptchaData {
  i: number;
}
export interface PointSelectionCaptchaCardProps {
  captchaImage: string;
  height?: number | string;
  paddingX?: number | string;
  paddingY?: number | string;
  title?: string;
  width?: number | string;
}

export interface PointSelectionCaptchaProps extends PointSelectionCaptchaCardProps {
  showConfirm?: boolean;
  hintImage?: string;
  hintText?: string;
}

export interface SliderCaptchaProps {
  class?: ClassType;
  actionStyle?: CSSProperties;

  barStyle?: CSSProperties;

  contentStyle?: CSSProperties;

  wrapperStyle?: CSSProperties;

  isSlot?: boolean;

  successText?: string;

  text?: string;
}

export interface SliderRotateCaptchaProps {
  diffDegree?: number;

  imageSize?: number;

  imageWrapperStyle?: CSSProperties;

  maxDegree?: number;

  minDegree?: number;

  src?: string;
  defaultTip?: string;
}

export interface SliderTranslateCaptchaProps {
  canvasWidth?: number;
  canvasHeight?: number;
  squareLength?: number;
  circleRadius?: number;
  src?: string;
  diffDistance?: number;
  defaultTip?: string;
}

export interface CaptchaVerifyPassingData {
  isPassing: boolean;
  time: number | string;
}

export interface SliderCaptchaActionType {
  resume: () => void;
}

export interface SliderRotateVerifyPassingData {
  event: MouseEvent | TouchEvent;
  moveDistance: number;
  moveX: number;
}
