import type { Component } from 'vue';

interface VbenDropdownMenuItem {
  disabled?: boolean;
  handler?: (data: any) => void;
  icon?: Component;
  label: string;
  separator?: boolean;
  value: string;
}

interface DropdownMenuProps {
  menus: VbenDropdownMenuItem[];
}

export type { DropdownMenuProps, VbenDropdownMenuItem };
