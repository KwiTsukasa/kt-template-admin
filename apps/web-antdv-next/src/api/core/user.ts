import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

export interface CurrentUserProfileInput {
  avatar?: string;
  homePath?: string;
  realName?: string;
}

/**
 * 从后端读取当前登录用户的资料与角色信息。
 *
 * @returns 当前登录用户的资料、角色与首页信息。
 */
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/user/info');
}

/**
 * 将昵称、头像等基础资料保存到当前用户记录，并取得更新后的资料。
 *
 * @param data - 当前用户要保存的昵称、头像等基础资料。
 * @returns 保存后由服务端返回的最新用户资料。
 */
export async function updateCurrentUserProfileApi(
  data: CurrentUserProfileInput,
) {
  return requestClient.put<UserInfo>('/user/profile', data);
}
