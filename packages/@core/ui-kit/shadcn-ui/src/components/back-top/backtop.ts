export const backtopProps = {
  bottom: {
    default: 40,
    type: Number,
  },
  right: {
    default: 40,
    type: Number,
  },
  target: {
    default: '',
    type: String,
  },
  visibilityHeight: {
    default: 200,
    type: Number,
  },
} as const;

export interface BacktopProps {
  bottom?: number;
  isGroup?: boolean;
  right?: number;
  target?: string;
  visibilityHeight?: number;
}
