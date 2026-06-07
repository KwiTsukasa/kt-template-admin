import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

export interface CurrentUserProfileInput {
  avatar?: string;
  homePath?: string;
  realName?: string;
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/user/info');
}

/**
 * 更新当前用户基础资料
 */
export async function updateCurrentUserProfileApi(
  data: CurrentUserProfileInput,
) {
  return requestClient.put<UserInfo>('/user/profile', data);
}
