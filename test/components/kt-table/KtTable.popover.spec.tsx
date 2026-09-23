/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';

import KtActionGroup from '@test-source/apps/web-antdv-next/src/components/kt-action-group/KtActionGroup';
import { isKtTableRowActionEvent } from '@test-source/apps/web-antdv-next/src/components/kt-table/utils';
import Button from 'antdv-next/dist/button/index';
import { afterEach, describe, expect, it, vi } from 'vitest';

const AButton = Button as any;

vi.mock('antdv-next', async () => {
  const buttonModule = await import('antdv-next/dist/button/index');
  const popoverModule = await import('antdv-next/dist/popover/index');
  return {
    Button: buttonModule.default,
    Popover: popoverModule.default,
  };
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ktTable row action popover', () => {
  it('opens with antdv-next 1.5 without triggering the row action', async () => {
    const onRowClick = vi.fn();
    const Harness = defineComponent({
      setup() {
        return () => (
          <div
            onClick={(event: MouseEvent) => {
              if (isKtTableRowActionEvent(event)) return;
              onRowClick();
            }}
          >
            <KtActionGroup
              class="kt-table__row-actions"
              items={[
                { content: <AButton>查看</AButton>, key: 'view' },
                { content: <AButton>编辑</AButton>, key: 'edit' },
                { content: <AButton>删除</AButton>, key: 'delete' },
              ]}
              visibleCount={2}
            />
          </div>
        );
      },
    });
    const wrapper = mount(Harness, { attachTo: document.body });

    await wrapper.get('[aria-label="更多操作"]').trigger('click');
    await nextTick();

    expect(document.querySelector('.kt-action-group__popover')).not.toBeNull();
    expect(onRowClick).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('closes the native overflow popover after one enabled action', async () => {
    const onEdit = vi.fn();
    const onParentClick = vi.fn();
    const Harness = defineComponent({
      setup() {
        return () => (
          <div onClick={onParentClick}>
            <KtActionGroup
              items={[
                { content: <AButton>查看</AButton>, key: 'view' },
                {
                  content: (
                    <AButton
                      onClick={(event: MouseEvent) => {
                        event.stopPropagation();
                        onEdit();
                      }}
                    >
                      编辑
                    </AButton>
                  ),
                  key: 'edit',
                },
              ]}
              visibleCount={1}
            />
          </div>
        );
      },
    });
    const wrapper = mount(Harness, { attachTo: document.body });
    await wrapper.get('[aria-label="更多操作"]').trigger('click');
    await nextTick();
    const popup = document.querySelector('.kt-action-group__popover');
    expect(popup).not.toBeNull();
    const action = popup?.querySelector('button');
    expect(action).not.toBeNull();
    action?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(wrapper.get('[aria-label="更多操作"]').classes()).not.toContain(
      'ant-popover-open',
    );
    expect(
      wrapper.get('[aria-label="更多操作"]').attributes('aria-describedby'),
    ).toBeUndefined();
    expect(onParentClick).not.toHaveBeenCalled();
    await wrapper.get('[aria-label="更多操作"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[aria-label="更多操作"]').classes()).toContain(
      'ant-popover-open',
    );
    wrapper.unmount();
  });

  it('toggles the native trigger and stays reusable after Escape', async () => {
    const Harness = defineComponent({
      setup() {
        return () => (
          <KtActionGroup
            items={[
              { content: <AButton>查看</AButton>, key: 'view' },
              { content: <AButton>编辑</AButton>, key: 'edit' },
            ]}
            visibleCount={1}
          />
        );
      },
    });
    const wrapper = mount(Harness, { attachTo: document.body });
    const trigger = wrapper.get('[aria-label="更多操作"]');
    await trigger.trigger('click');
    expect(trigger.classes()).toContain('ant-popover-open');
    await trigger.trigger('click');
    expect(trigger.classes()).not.toContain('ant-popover-open');
    await trigger.trigger('click');
    expect(trigger.classes()).toContain('ant-popover-open');
    await trigger.trigger('keydown', { key: 'Escape', keyCode: 27 });
    expect(trigger.classes()).not.toContain('ant-popover-open');
    await trigger.trigger('click');
    expect(trigger.classes()).toContain('ant-popover-open');
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await nextTick();
    expect(trigger.classes()).not.toContain('ant-popover-open');
    wrapper.unmount();
  });

  it('ignores menu whitespace and disabled controls while preserving compact and balanced counts', async () => {
    const disabledAction = vi.fn();
    const enabledAction = vi.fn();
    const Harness = defineComponent({
      setup() {
        return () => (
          <div>
            <KtActionGroup
              items={[
                { content: <AButton>查看</AButton>, key: 'view' },
                {
                  content: (
                    <AButton disabled onClick={disabledAction}>
                      禁用
                    </AButton>
                  ),
                  key: 'disabled',
                },
                {
                  content: (
                    <a aria-disabled="true" href="#" onClick={disabledAction}>
                      禁用链接
                    </a>
                  ),
                  key: 'disabled-link',
                },
                {
                  content: <AButton onClick={enabledAction}>执行</AButton>,
                  key: 'enabled',
                },
              ]}
              visibleCount={1}
            />
            <KtActionGroup
              items={[
                { content: <AButton>对话</AButton>, key: 'chat' },
                { content: <AButton>详情</AButton>, key: 'detail' },
                { content: <AButton>编辑</AButton>, key: 'edit' },
              ]}
              layout="balanced"
              moreLabel="卡片更多"
              visibleCount={2}
            />
          </div>
        );
      },
    });
    const wrapper = mount(Harness, { attachTo: document.body });
    expect(
      wrapper
        .get('.kt-action-group--compact')
        .attributes('data-inline-action-count'),
    ).toBe('1');
    expect(
      wrapper
        .get('.kt-action-group--balanced')
        .attributes('data-inline-action-count'),
    ).toBe('2');
    await wrapper.get('[aria-label="更多操作"]').trigger('click');
    const popup = document.querySelector('.kt-action-group__popover-content');
    expect(popup).not.toBeNull();
    popup?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    popup
      ?.querySelector('button[disabled]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    popup
      ?.querySelector('a[aria-disabled="true"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(disabledAction).not.toHaveBeenCalled();
    expect(wrapper.get('[aria-label="更多操作"]').classes()).toContain(
      'ant-popover-open',
    );
    popup
      ?.querySelectorAll('button')[1]
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(enabledAction).toHaveBeenCalledOnce();
    expect(wrapper.get('[aria-label="更多操作"]').classes()).not.toContain(
      'ant-popover-open',
    );
    wrapper.unmount();
  });

  it('opens a balanced card menu by keyboard without activating the parent card', async () => {
    const onCardOpen = vi.fn();
    const Harness = defineComponent({
      setup() {
        return () => (
          <div
            onClick={(event: MouseEvent) => {
              if (event.target === event.currentTarget) onCardOpen();
            }}
            onKeydown={(event: KeyboardEvent) => {
              if (event.target === event.currentTarget && event.key === 'Enter')
                onCardOpen();
            }}
            role="button"
            tabindex={0}
          >
            <KtActionGroup
              items={[
                { content: <AButton>进入对话</AButton>, key: 'chat' },
                { content: <AButton>查看详情</AButton>, key: 'view' },
                { content: <AButton>编辑</AButton>, key: 'edit' },
              ]}
              layout="balanced"
              visibleCount={2}
            />
          </div>
        );
      },
    });
    const wrapper = mount(Harness, { attachTo: document.body });
    const trigger = wrapper.get('[aria-label="更多操作"]');
    await trigger.trigger('keydown', { key: 'Enter', keyCode: 13 });
    await trigger.trigger('click');
    expect(trigger.classes()).toContain('ant-popover-open');
    expect(onCardOpen).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it.each(['items', 'visibleCount'])(
    'keeps the restored overflow menu closed after %s removes it',
    async (mode) => {
      const items = [
        { content: <AButton>查看</AButton>, key: 'view' },
        { content: <AButton>编辑</AButton>, key: 'edit' },
      ];
      const wrapper = mount(KtActionGroup, {
        attachTo: document.body,
        props: { items, visibleCount: 1 },
      });
      await wrapper.get('[aria-label="更多操作"]').trigger('click');
      expect(wrapper.get('[aria-label="更多操作"]').classes()).toContain(
        'ant-popover-open',
      );
      if (mode === 'items') {
        await wrapper.setProps({ items: items.slice(0, 1) });
      } else {
        await wrapper.setProps({ visibleCount: 2 });
      }
      expect(wrapper.find('[aria-label="更多操作"]').exists()).toBe(false);
      if (mode === 'items') {
        await wrapper.setProps({ items });
      } else {
        await wrapper.setProps({ visibleCount: 1 });
      }
      expect(wrapper.get('[aria-label="更多操作"]').classes()).not.toContain(
        'ant-popover-open',
      );
      wrapper.unmount();
    },
  );
});
