import type { PageProps } from '../page/types';

export interface ColPageProps extends PageProps {
  leftWidth?: number;
  leftMinWidth?: number;
  leftMaxWidth?: number;
  leftCollapsedWidth?: number;
  leftCollapsible?: boolean;
  rightWidth?: number;
  rightMinWidth?: number;
  rightCollapsedWidth?: number;
  rightMaxWidth?: number;
  rightCollapsible?: boolean;

  resizable?: boolean;
  splitLine?: boolean;
  splitHandle?: boolean;
}
