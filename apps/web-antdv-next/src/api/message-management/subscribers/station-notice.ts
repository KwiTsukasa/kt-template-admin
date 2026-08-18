import type { MessageManagementApi } from '../index';

import { requestClient } from '#/api/request';

export namespace StationNoticeMessageSubscriberApi {
  export interface BindingInput {
    enabled: boolean;
    notifyRoleCode: string;
    subscriptionId: string;
    title: string;
  }

  export interface BindingView {
    available: boolean;
    createTime: string;
    enabled: boolean;
    id: string;
    invalidReasonCode: null | string;
    notifyRoleCode: string;
    sourceKey: string;
    sourceName: string;
    subscriptionId: string;
    subscriptionName: string;
    templates: MessageManagementApi.MessageTemplateReference[];
    title: string;
    updateTime: string;
  }
}

const STATION_NOTICE_BINDING_PATH =
  '/message-management/subscribers/station-notice/bindings';

/**
 * 读取站内信订阅者对统一消息订阅的全部私有配置。
 *
 * @returns 带多模板摘要、接收角色和可用状态的站内信配置数组。
 */
export function getStationNoticeMessageBindings() {
  return requestClient.get<StationNoticeMessageSubscriberApi.BindingView[]>(
    STATION_NOTICE_BINDING_PATH,
  );
}

/**
 * 把统一订阅映射到站内信标题和接收角色，模板仍完全由通用订阅管理。
 *
 * @param data - 通用订阅、站内信标题、角色和启用状态。
 * @returns 创建后的站内信订阅者配置视图。
 */
export function createStationNoticeMessageBinding(
  data: StationNoticeMessageSubscriberApi.BindingInput,
) {
  return requestClient.post<StationNoticeMessageSubscriberApi.BindingView>(
    STATION_NOTICE_BINDING_PATH,
    data,
  );
}

/**
 * 原子替换站内信的统一订阅、标题和角色，保持每个订阅只有一个有效绑定。
 *
 * @param id - 待更新的站内信私有配置标识。
 * @param data - 新的通用订阅、标题、角色和启用状态。
 * @returns 更新后的站内信订阅者配置视图。
 */
export function updateStationNoticeMessageBinding(
  id: string,
  data: StationNoticeMessageSubscriberApi.BindingInput,
) {
  return requestClient.put<StationNoticeMessageSubscriberApi.BindingView>(
    `${STATION_NOTICE_BINDING_PATH}/${encodeURIComponent(id)}`,
    data,
  );
}

/**
 * `enabled=false` 仅阻止后续 `admin_notice` 物化，已经生成的站内信保持可审计。
 *
 * @param id - 待切换的站内信私有配置标识。
 * @param enabled - 目标启用状态。
 * @returns 状态更新后的站内信订阅者配置视图。
 */
export function setStationNoticeMessageBindingEnabled(
  id: string,
  enabled: boolean,
) {
  return requestClient.put<StationNoticeMessageSubscriberApi.BindingView>(
    `${STATION_NOTICE_BINDING_PATH}/${encodeURIComponent(id)}/enabled`,
    { enabled },
  );
}

/**
 * 移除站内信与统一订阅的私有关联，同时保留已经物化的通知历史。
 *
 * @param id - 待删除的站内信私有配置标识。
 * @returns 后端返回的空成功结果。
 */
export function deleteStationNoticeMessageBinding(id: string) {
  return requestClient.delete<null>(
    `${STATION_NOTICE_BINDING_PATH}/${encodeURIComponent(id)}`,
  );
}
