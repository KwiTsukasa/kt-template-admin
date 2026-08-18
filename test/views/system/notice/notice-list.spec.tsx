/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import type { SystemNoticeApi } from '#/api/system/notice';

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import NoticeList from '@test-source/apps/web-antdv-next/src/views/system/notice/list';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  api: {
    batchRead: vi.fn(),
    delete: vi.fn(),
    getList: vi.fn(),
    toggleStatus: vi.fn(),
    toggleTop: vi.fn(),
  },
  message: {
    loading: vi.fn(() => vi.fn()),
    success: vi.fn(),
    warning: vi.fn(),
  },
  tableApi: {
    reload: vi.fn(async () => {}),
  },
  tableOptions: undefined as any,
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  }),
}));

vi.mock('antdv-next', () => ({
  message: mocks.message,
  Tag: defineComponent({
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock('#/api/system/notice', () => ({
  deleteNotice: mocks.api.delete,
  getNoticeList: mocks.api.getList,
  markNoticesRead: mocks.api.batchRead,
  toggleNoticeStatus: mocks.api.toggleStatus,
  toggleNoticeTop: mocks.api.toggleTop,
}));

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    render: () => h('section', { 'data-testid': 'notice-table' }),
  }),
  useKtTable: vi.fn((options) => {
    mocks.tableOptions = options;
    return [vi.fn(), mocks.tableApi];
  }),
}));

vi.mock('#/locales', () => ({
  $t: (key: string, values?: unknown[]) => {
    if (!values) return key;
    return `${key}:${values.join(',')}`;
  },
}));

vi.mock('#/store', () => ({
  useMessageCenterStore: () => ({ changeRevision: 0 }),
}));

/**
 * 构造可切换已读状态的消息中心列表行。
 *
 * @param id - 测试行使用的稳定站内信标识。
 * @param status - 1 表示未读，0 表示已读。
 * @returns 可直接交给消息中心批量操作的站内信行。
 */
function createNotice(
  id: string,
  status: SystemNoticeApi.NoticeItem['status'],
): SystemNoticeApi.NoticeItem {
  return {
    content: 'content',
    id,
    isDeleted: false,
    isTop: false,
    level: 1,
    status,
    title: `message-${id}`,
  };
}

describe('message center notice list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.batchRead.mockResolvedValue({ updated: 1 });
    mocks.api.getList.mockResolvedValue({ items: [], total: 0 });
  });

  it('enables selection and marks only selected unread messages in one request', async () => {
    mount(NoticeList);
    const unread = createNotice('2041700000000300001', 1);
    const read = createNotice('2041700000000300002', 0);
    const context = {
      reload: vi.fn(async () => {}),
      selectedRows: vi.fn(() => [unread, read]),
    };
    const action = mocks.tableOptions.buttons.find(
      (button: any) => button.key === 'batchRead',
    );

    expect(mocks.tableOptions.showSelection).toBe(true);
    expect(action.visible).toBe(true);
    expect(action.disabled).toBeUndefined();
    await action.onClick(context);

    expect(mocks.api.batchRead).toHaveBeenCalledWith([unread.id]);
    expect(mocks.message.success).toHaveBeenCalledWith(
      'system.notice.batchReadSuccess:1',
    );
    expect(context.reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the batch action visible and warns when no unread row is selected', async () => {
    mount(NoticeList);
    const context = {
      reload: vi.fn(async () => {}),
      selectedRows: vi.fn(() => [createNotice('2041700000000300002', 0)]),
    };
    const action = mocks.tableOptions.buttons.find(
      (button: any) => button.key === 'batchRead',
    );

    expect(action.visible).toBe(true);
    expect(action.disabled).toBeUndefined();
    await action.onClick(context);

    expect(mocks.api.batchRead).not.toHaveBeenCalled();
    expect(mocks.message.warning).toHaveBeenCalledWith(
      'system.notice.selectUnreadFirst',
    );
    expect(context.reload).not.toHaveBeenCalled();
  });
});
