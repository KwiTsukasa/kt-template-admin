import type { Component } from 'vue';

interface IContextMenuItem {
  disabled?: boolean;
  handler?: (data: any) => void;
  hidden?: boolean;
  icon?: Component;
  inset?: boolean;
  key: string;
  separator?: boolean;
  shortcut?: string;
  text: string;
}
export type { IContextMenuItem };
