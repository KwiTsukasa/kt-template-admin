import type { BasicUserInfo } from '@vben/types';

export interface Props {
  avatarEditable?: boolean;
  title?: string;
  userInfo: BasicUserInfo | null;
  tabs: {
    label: string;
    value: string;
  }[];
}

export interface FormSchemaItem {
  description: string;
  fieldName: string;
  label: string;
  value: boolean;
}

export interface SettingProps {
  formSchema: FormSchemaItem[];
}
