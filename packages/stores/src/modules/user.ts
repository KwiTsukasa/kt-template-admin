import { acceptHMRUpdate, defineStore } from 'pinia';

interface BasicUserInfo {
  [key: string]: any;
  avatar: string;
  realName: string;
  roles?: string[];
  userId: string;
  username: string;
}

interface AccessState {
  userInfo: BasicUserInfo | null;
  userRoles: string[];
}

export const useUserStore = defineStore('core-user', {
  actions: {
    /**
     * 写入当前用户资料，并同步从资料中提取的角色集合。
     *
     * @param userInfo - 当前登录用户的资料记录。
     */
    setUserInfo(userInfo: BasicUserInfo | null) {
      // 设置用户信息
      this.userInfo = userInfo;
      // 设置角色信息
      const roles = userInfo?.roles ?? [];
      this.setUserRoles(roles);
    },
    /**
     * 替换用户 store 中用于权限判断的角色集合。
     *
     * @param roles - 用于构建角色选择项或权限判断的角色集合。
     */
    setUserRoles(roles: string[]) {
      this.userRoles = roles;
    },
  },
  state: (): AccessState => ({
    userInfo: null,
    userRoles: [],
  }),
});

// 解决热更新问题
const hot = import.meta.hot;
if (hot) {
  hot.accept(acceptHMRUpdate(useUserStore, hot));
}
