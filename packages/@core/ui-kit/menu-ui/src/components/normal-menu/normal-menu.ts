import type { MenuRecordRaw } from '@vben-core/typings';

interface NormalMenuProps {
  activePath?: string;
  collapse?: boolean;
  menus?: MenuRecordRaw[];
  rounded?: boolean;
  theme?: 'dark' | 'light';
}

export type { NormalMenuProps };
