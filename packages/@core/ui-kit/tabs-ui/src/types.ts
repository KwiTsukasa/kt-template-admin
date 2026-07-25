import type { IContextMenuItem } from '@vben-core/shadcn-ui';
import type { TabDefinition, TabsStyleType } from '@vben-core/typings';

export type TabsEmits = {
  close: [string];
  sortTabs: [number, number];
  unpin: [TabDefinition];
};

export interface TabsProps {
  active?: string;
  contentClass?: string;
  contextMenus?: (data: any) => IContextMenuItem[];
  draggable?: boolean;
  gap?: number;
  maxWidth?: number;
  middleClickToClose?: boolean;

  minWidth?: number;

  showIcon?: boolean;
  styleType?: TabsStyleType;

  tabs?: TabDefinition[];

  wheelable?: boolean;
}

export interface TabConfig extends TabDefinition {
  affixTab: boolean;
  closable: boolean;
  icon: string;
  key: string;
  title: string;
}
