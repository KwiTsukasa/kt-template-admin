export interface JsonViewerProps {
  value: any;
  expandDepth?: number;
  copyable?: boolean;
  sort?: boolean;
  boxed?: boolean;
  theme?: string;
  expanded?: boolean;
  timeformat?: (time: Date | number | string) => string;
  previewMode?: boolean;
  showArrayIndex?: boolean;
  showDoubleQuotes?: boolean;
}

export interface JsonViewerAction {
  action: string;
  text: string;
  trigger: HTMLElement;
}

export interface JsonViewerValue {
  value: any;
  path: string;
  depth: number;
  el: HTMLElement;
}

export interface JsonViewerToggle {
  event: MouseEvent;
  open: boolean;
}
