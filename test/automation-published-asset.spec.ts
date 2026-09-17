import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { expect, it, vi } from 'vitest';

import { usePublishedAsset } from '#/components/kt-definition-list/usePublishedAsset';

it('同版本合并请求，不同版本独立缓存，卸载后的结果不再写入', async () => {
  let finish: (value: string) => void = () => {};
  const loader = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const failure = vi.fn();
  let assets!: ReturnType<typeof usePublishedAsset<string>>;
  const wrapper = mount(
    defineComponent({
      setup() {
        assets = usePublishedAsset(loader, failure);
        return () => null;
      },
    }),
  );
  const first = { id: '1', version: 1 };
  const requests = [assets.load(first), assets.load(first)];
  expect(loader).toHaveBeenCalledTimes(1);
  finish('v1');
  await Promise.all(requests);
  expect(assets.get(first)).toBe('v1');
  const next = { id: '1', version: 2 };
  const pending = assets.load(next);
  wrapper.unmount();
  finish('v2');
  await pending;
  expect(assets.get(next)).toBeUndefined();
  expect(assets.get(first)).toBe('v1');
  expect(failure).not.toHaveBeenCalled();
});
