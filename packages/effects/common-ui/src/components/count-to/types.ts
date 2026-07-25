import type { CubicBezierPoints, EasingFunction } from '@vueuse/core';

import type { StyleValue } from 'vue';

import { TransitionPresets as TransitionPresetsData } from '@vueuse/core';

export type TransitionPresets = keyof typeof TransitionPresetsData;

export const TransitionPresetsKeys = Object.keys(
  TransitionPresetsData,
) as TransitionPresets[];

export interface CountToProps {
  startVal?: number;
  endVal: number;
  disabled?: boolean;
  delay?: number;
  duration?: number;
  decimals?: number;
  decimal?: string;
  separator?: string;
  prefix?: string;
  suffix?: string;
  transition?: CubicBezierPoints | EasingFunction | TransitionPresets;
  mainClass?: string;
  decimalClass?: string;
  prefixClass?: string;
  suffixClass?: string;

  mainStyle?: StyleValue;
  decimalStyle?: StyleValue;
  prefixStyle?: StyleValue;
  suffixStyle?: StyleValue;
}
