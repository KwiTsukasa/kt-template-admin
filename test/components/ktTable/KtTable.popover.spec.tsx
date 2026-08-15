/* @vitest-environment happy-dom */

import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';

import { isKtTableRowActionEvent } from '@test-source/apps/web-antdv-next/src/components/ktTable/utils';
import Button from 'antdv-next/dist/button/index';
import Popover from 'antdv-next/dist/popover/index';
import Space from 'antdv-next/dist/space/index';
import { afterEach, describe, expect, it, vi } from 'vitest';

const AButton = Button as any;
const APopover = Popover as any;
const ASpace = Space as any;

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
            <ASpace class="kt-table__row-actions" size={0}>
              <APopover
                classes={{ container: 'kt-table__row-action-popover' }}
                trigger="click"
              >
                {{
                  content: () => <span>删除</span>,
                  default: () => <AButton aria-label="更多操作">更多</AButton>,
                }}
              </APopover>
            </ASpace>
          </div>
        );
      },
    });
    const wrapper = mount(Harness, { attachTo: document.body });

    await wrapper.get('button').trigger('click');
    await nextTick();

    expect(
      document.querySelector('.kt-table__row-action-popover'),
    ).not.toBeNull();
    expect(onRowClick).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
