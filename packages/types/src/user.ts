import type { BasicUserInfo } from '@vben-core/typings';

interface UserInfo extends BasicUserInfo {
  desc: string;
  homePath: string;

  token: string;
}

export type { UserInfo };
