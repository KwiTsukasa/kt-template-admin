import { describe, expect, it, vi } from 'vitest';

import { loopPortSides } from '#/views/workflow-engine/designer/workflow-edge-routing';

// 这里只测无 DOM 的端口与避让几何，X6 实际布线在 Edge 页面核验。
vi.mock('../apps/web-antdv-next/node_modules/@antv/x6', () => ({
  routerPresets: {},
}));

describe('循环端口与外侧回线', () => {
  it.each([
    ['left', 'right', 'top', 'bottom'],
    ['top', 'bottom', 'right', 'left'],
    ['right', 'left', 'bottom', 'top'],
    ['bottom', 'top', 'left', 'right'],
  ] as const)(
    '入口 %s、出口 %s 时返回与退出分侧',
    (inputSide, outputSide, repeat, done) => {
      expect(loopPortSides({ inputSide, outputSide })).toEqual({
        repeat,
        done,
      });
    },
  );

  it('主端口相邻时也不占用返回与退出方向', () => {
    const result = loopPortSides({ inputSide: 'top', outputSide: 'right' });
    expect(new Set([result.done, result.repeat, 'right', 'top']).size).toBe(4);
  });
});
