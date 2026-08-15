/* @vitest-environment happy-dom */

import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';

import KtActionGroup from '@test-source/apps/web-antdv-next/src/components/ktActionGroup/KtActionGroup';
import { isKtTableRowActionEvent } from '@test-source/apps/web-antdv-next/src/components/ktTable/utils';
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
});
